/**
 * Gossip Protocol Handler — Federation v2
 *
 * Delta-based gossip with Ed25519 signature verification.
 * Signs outbound messages, verifies inbound, rate-limits per peer.
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase D — Gossip Protocol
 */

import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import { gossipLog, federationPeers } from '$lib/db/schema';
import type {
	GossipMessage,
	MergeResult,
	VectorClock,
	PostGossipPublishHook
} from '$lib/types/federation-v2';
import type { CRDTMergeEngine } from './crdt';
import type { PeerService } from './peers';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'gossip');

/** Minimum interval between gossip pushes to the same peer (seconds) */
const GOSSIP_PUSH_INTERVAL_SEC = 60;

export class GossipService {
	private publishHook: PostGossipPublishHook | null = null;

	constructor(
		private db: DbClient,
		private crdt: CRDTMergeEngine,
		private peers: PeerService,
		private nodeId: string,
		private federationAdminKey?: string,
		private ed25519PrivateKeyBase64?: string
	) {}

	// ── Ed25519 Gossip Signing ─────────────────────────────────────

	/**
	 * Sign a gossip message body using Ed25519.
	 * @throws Error if Ed25519 key is not configured — gossip MUST be signed.
	 */
	private async signMessage(payload: Omit<GossipMessage, 'signature_hex'>): Promise<string> {
		if (!this.ed25519PrivateKeyBase64) {
			throw new Error(
				'Ed25519 private key not configured. Gossip messages must be signed — ' +
					'set KYM_NANDA_ED25519_PRIVATE_KEY_v1 or initialize keys via /admin/keys.'
			);
		}
		const der = Uint8Array.from(atob(this.ed25519PrivateKeyBase64), (c) => c.charCodeAt(0));
		const key = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
		const data = new TextEncoder().encode(JSON.stringify(payload));
		const sig = await crypto.subtle.sign('Ed25519', key, data);
		return Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Verify a gossip message signature using the sender's public key.
	 * Rejects unsigned messages — every gossip message MUST carry a signature.
	 */
	async verifySignature(message: GossipMessage, publicKeyBase64?: string): Promise<boolean> {
		if (!message.signature_hex) {
			log.warn('verifySignature', 'Rejected unsigned gossip message', {
				source: message.node_id
			});
			return false;
		}
		if (!publicKeyBase64) {
			log.warn('verifySignature', 'No public key for peer — cannot verify', {
				source: message.node_id
			});
			return false;
		}
		try {
			const der = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));
			const key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, [
				'verify'
			]);
			const { signature_hex, ...payload } = message;
			const data = new TextEncoder().encode(JSON.stringify(payload));
			const sig = new Uint8Array((signature_hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
			return crypto.subtle.verify('Ed25519', key, sig, data);
		} catch (err) {
			log.warn('verifySignature', 'Signature verification failed', {
				error: err instanceof Error ? err.message : String(err)
			});
			return false;
		}
	}

	/**
	 * Register a post-gossip publish hook (e.g., AGNTCY Directory bridge).
	 * @see COMPATIBILITY_AUDIT.md — Gossip Peers Can Publish to AGNTCY
	 */
	setPublishHook(hook: PostGossipPublishHook): void {
		this.publishHook = hook;
	}

	/** Minimum seconds between inbound gossip from the same peer */
	private static readonly INBOUND_RATE_LIMIT_SECS = 30;

	/**
	 * Handle inbound gossip message from a peer.
	 * Verifies structure, merges deltas via CRDT, updates peer state.
	 */
	async handleInbound(message: GossipMessage, peerId: string): Promise<MergeResult> {
		// Rate-limit inbound gossip per peer
		const peer = await this.peers.getPeer(peerId);
		if (peer && peer.last_gossip_at) {
			const elapsed = Math.floor(Date.now() / 1000) - peer.last_gossip_at;
			if (elapsed < GossipService.INBOUND_RATE_LIMIT_SECS) {
				log.warn('handleInbound', `Rate-limited gossip from peer ${peerId}`, {
					elapsed,
					limit: GossipService.INBOUND_RATE_LIMIT_SECS
				});
				return {
					accepted: 0,
					rejected: message.agent_addr_deltas.length,
					conflicts: 0,
					tombstones: 0,
					acceptedIndices: []
				};
			}
		}

		const result = await this.crdt.merge(message.agent_addr_deltas);

		// Update peer's vector clock and advance our own past the sender's
		if (peer) {
			const mergedClock = this.crdt.mergeVectorClocks(peer.vector_clock, message.vector_clock);

			// Advance our clock past the sender's to maintain causal ordering
			const senderClock = message.vector_clock[message.node_id] ?? 0;
			const advancedOurClock = this.crdt.advancePastRemote(this.nodeId, mergedClock, senderClock);
			mergedClock[this.nodeId] = advancedOurClock;

			await this.db
				.update(federationPeers)
				.set({
					vectorClock: JSON.stringify(mergedClock),
					lastGossipAt: Math.floor(Date.now() / 1000),
					updatedAt: sql`(unixepoch())`
				})
				.where(eq(federationPeers.peerId, peerId));
		}

		// Log gossip exchange
		await this.logGossip(peerId, 'inbound', message, result);

		// Mark peer as healthy
		await this.peers.updatePeerStatus(peerId, true);

		// Fire publish hook for newly-accepted deltas
		if (this.publishHook && result.accepted > 0) {
			try {
				const acceptedDeltas = result.acceptedIndices.map((idx) => message.agent_addr_deltas[idx]);
				await this.publishHook.onGossipAccepted(acceptedDeltas);
			} catch (err) {
				log.warn('handleInbound', 'Publish hook failed (non-fatal)', {
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}

		return result;
	}

	/**
	 * Push gossip to all healthy peers (called by cron).
	 */
	async pushToAllPeers(): Promise<Map<string, MergeResult>> {
		const results = new Map<string, MergeResult>();
		const healthyPeers = await this.peers.getHealthyPeers();

		// Fan out gossip to all peers in parallel
		await Promise.allSettled(
			healthyPeers.map(async (peer) => {
				try {
					const result = await this.pushToPeer(peer.peer_id);
					results.set(peer.peer_id, result);
				} catch (err) {
					log.error('pushToAllPeers', `Failed to push to ${peer.peer_id}`, {
						error: err instanceof Error ? err.message : String(err)
					});
					await this.peers.updatePeerStatus(peer.peer_id, false);
				}
			})
		);

		return results;
	}

	/**
	 * Push gossip to a specific peer.
	 */
	async pushToPeer(peerId: string): Promise<MergeResult> {
		const peer = await this.peers.getPeer(peerId);
		if (!peer) throw new Error(`Unknown peer: ${peerId}`);

		// Rate limit: max 1 push per peer per 60 seconds
		const now = Math.floor(Date.now() / 1000);
		if (peer.last_gossip_at && now - peer.last_gossip_at < GOSSIP_PUSH_INTERVAL_SEC) {
			return { accepted: 0, rejected: 0, conflicts: 0, tombstones: 0, acceptedIndices: [] };
		}

		const message = await this.buildMessage(peer.vector_clock);
		if (message.agent_addr_deltas.length === 0) {
			return { accepted: 0, rejected: 0, conflicts: 0, tombstones: 0, acceptedIndices: [] };
		}

		// Send gossip to peer (with federation admin key for authentication)
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': 'KYM-NANDA-Gossip/2.0'
		};
		if (this.federationAdminKey) {
			headers['Authorization'] = `Bearer ${this.federationAdminKey}`;
		}

		const resp = await fetch(`${peer.peer_url}/federation/gossip`, {
			method: 'POST',
			headers,
			body: JSON.stringify(message),
			signal: AbortSignal.timeout(10_000)
		});

		if (!resp.ok) {
			throw new Error(`Peer returned ${resp.status}: ${resp.statusText}`);
		}

		const result = (await resp.json()) as MergeResult;

		// Log and update peer state
		await this.logGossip(peerId, 'outbound', message, result);
		await this.peers.updatePeerStatus(peerId, true);

		return result;
	}

	/**
	 * Build a gossip message for outbound sync.
	 * Contains deltas not yet seen by the peer (based on vector clock diff).
	 * Uses hybrid Lamport tick for monotonic vector clock advancement.
	 */
	async buildMessage(peerClock: VectorClock): Promise<GossipMessage> {
		const deltas = await this.crdt.getDeltasSince(peerClock);

		// Use hybrid Lamport tick — monotonic and wall-clock grounded
		const newTick = this.crdt.tick(this.nodeId, peerClock);

		const unsigned = {
			node_id: this.nodeId,
			timestamp: Math.floor(Date.now() / 1000),
			agent_addr_deltas: deltas,
			vector_clock: { [this.nodeId]: newTick }
		};

		const signature_hex = await this.signMessage(unsigned);

		return { ...unsigned, signature_hex };
	}

	/**
	 * Log a gossip exchange for audit purposes.
	 */
	private async logGossip(
		peerId: string,
		direction: 'inbound' | 'outbound',
		message: GossipMessage,
		result: MergeResult
	): Promise<void> {
		try {
			await this.db.insert(gossipLog).values({
				id: nanoid(),
				peerId,
				direction,
				messageJson: JSON.stringify({
					node_id: message.node_id,
					timestamp: message.timestamp,
					deltas_count: message.agent_addr_deltas.length,
					vector_clock: message.vector_clock
				}),
				deltasCount: message.agent_addr_deltas.length,
				accepted: result.accepted,
				rejected: result.rejected,
				createdAt: Math.floor(Date.now() / 1000)
			});
		} catch (err) {
			log.warn('logGossip', 'Failed to log gossip (non-fatal)', {
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	/**
	 * Get gossip statistics for the /federation/status endpoint.
	 */
	async getStats(): Promise<{
		total_exchanges: number;
		inbound: number;
		outbound: number;
	}> {
		const rows = await this.db
			.select({
				direction: gossipLog.direction,
				count: sql<number>`count(*)`
			})
			.from(gossipLog)
			.groupBy(gossipLog.direction);

		let inbound = 0,
			outbound = 0;
		for (const row of rows) {
			if (row.direction === 'inbound') inbound = row.count;
			else if (row.direction === 'outbound') outbound = row.count;
		}

		return { total_exchanges: inbound + outbound, inbound, outbound };
	}
}
