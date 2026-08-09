/**
 * CRDT Merge Engine — Last-Writer-Wins Register per AgentAddr
 *
 * Core convergence algorithm for gossip-based federation.
 * Guarantees: commutative, associative, and idempotent merges.
 *
 * Conflict resolution rules:
 *  1. Higher `updated_at` timestamp wins
 *  2. On timestamp tie: lexicographic `agent_id` tiebreak (deterministic)
 *  3. Tombstones propagate: null AgentAddr = deletion
 *  4. Tombstone TTL: 7 days, then garbage collected
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase D — CRDT Update Protocol
 */

import { eq, sql, and, gt, inArray } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import type { AgentAddrDelta, VectorClock, MergeResult } from '$lib/types/federation-v2';
import { createLogger } from '$lib/utils/logger';
import { getChangeCount } from '$lib/utils/drizzle-helpers';
import { signAgentAddr } from '$lib/crypto/sign-agent';
import { DISCOVERABLE_VISIBILITIES, normalizeVisibility } from '$lib/types/agent-visibility';

const log = createLogger(undefined, 'crdt-merge');

/** Tombstone TTL in seconds (7 days) */
const TOMBSTONE_TTL_SEC = 7 * 24 * 3600;

export class CRDTMergeEngine {
	/**
	 * @param db - Database client
	 * @param signingKey - Ed25519 private key for re-signing federated entries.
	 *   Every entry stored locally is signed with OUR key to assert provenance.
	 */
	constructor(
		private db: DbClient,
		private signingKey: CryptoKey
	) {}

	/**
	 * Merge a batch of AgentAddr deltas into local state.
	 * Each delta is independently resolved using LWW semantics.
	 *
	 * Writes to `agent_addrs` table (H3 — federation isolation).
	 */
	async merge(deltas: AgentAddrDelta[]): Promise<MergeResult> {
		const result: MergeResult = {
			accepted: 0,
			rejected: 0,
			conflicts: 0,
			tombstones: 0,
			acceptedIndices: []
		};

		for (let i = 0; i < deltas.length; i++) {
			const delta = deltas[i];
			try {
				if (delta.agent_addr === null) {
					const applied = await this.applyTombstone(delta);
					if (applied) {
						result.tombstones++;
						result.accepted++;
						result.acceptedIndices.push(i);
					} else {
						result.rejected++;
					}
					continue;
				}

				const deltaVisibility = normalizeVisibility(delta.agent_addr.visibility) ?? 'public';
				if (!(DISCOVERABLE_VISIBILITIES as readonly string[]).includes(deltaVisibility)) {
					result.rejected++;
					continue;
				}

				// Look up in agent_addrs
				const local = await this.db.query.agentAddrs.findFirst({
					where: eq(agentAddrs.agentId, delta.agent_id)
				});

				if (!local) {
					// No local record — accept the remote delta, re-sign with our key
					const sig = await signAgentAddr(delta.agent_id, this.signingKey);
					await this.db.insert(agentAddrs).values({
						agentId: delta.agent_id,
						publicKeyHex: sig.publicKeyHex,
						factsUrl: delta.agent_addr.facts_url ?? null,
						signatureHex: sig.signatureHex,
						signerId: sig.signerId,
						ttlSeconds: 3600,
						source: `federated:${delta.source_node}`,
						quiltType: 'native',
						agentUrl: delta.agent_addr.agent_url,
						apiUrl: delta.agent_addr.api_url ?? null,
						capabilities: delta.agent_addr.capabilities
							? JSON.stringify(delta.agent_addr.capabilities)
							: null,
						tags: delta.agent_addr.tags ? JSON.stringify(delta.agent_addr.tags) : null,
						status: delta.agent_addr.status ?? 'alive',
						visibility: deltaVisibility,
						updatedAt: delta.updated_at
					});
					result.accepted++;
					result.acceptedIndices.push(i);
					continue;
				}

				// Guard: never overwrite locally-registered entries with federated data
				if (!local.source || local.source === 'local') {
					result.rejected++;
					continue;
				}

				// Resolve conflict using LWW (only for federated entries)
				const winner = this.resolveConflict(local, delta);
				if (winner === 'remote') {
					// Re-sign with our key on update too
					const updateSig = await signAgentAddr(delta.agent_id, this.signingKey);
					await this.db
						.update(agentAddrs)
						.set({
							factsUrl: delta.agent_addr.facts_url ?? local.factsUrl,
							publicKeyHex: updateSig.publicKeyHex,
							signatureHex: updateSig.signatureHex,
							signerId: updateSig.signerId,
							source: `federated:${delta.source_node}`,
							agentUrl: delta.agent_addr.agent_url,
							apiUrl: delta.agent_addr.api_url ?? null,
							capabilities: delta.agent_addr.capabilities
								? JSON.stringify(delta.agent_addr.capabilities)
								: null,
							tags: delta.agent_addr.tags ? JSON.stringify(delta.agent_addr.tags) : null,
							status: delta.agent_addr.status ?? 'alive',
							visibility: deltaVisibility,
							updatedAt: delta.updated_at
						})
						.where(eq(agentAddrs.agentId, delta.agent_id));
					result.accepted++;
					result.acceptedIndices.push(i);
					result.conflicts++;
				} else {
					result.rejected++;
					result.conflicts++;
				}
			} catch (err) {
				log.error('merge', `Failed to merge delta for ${delta.agent_id}`, {
					error: err instanceof Error ? err.message : String(err)
				});
				result.rejected++;
			}
		}

		return result;
	}

	/**
	 * Compare local agent_addr state with a remote delta.
	 * Returns 'local' if local wins, 'remote' if remote wins.
	 */
	resolveConflict(
		local: { updatedAt: number | null; agentId: string },
		remote: AgentAddrDelta
	): 'local' | 'remote' {
		const localTs = local.updatedAt ?? 0;
		const remoteTs = remote.updated_at;

		if (remoteTs > localTs) return 'remote';
		if (remoteTs < localTs) return 'local';

		// Timestamp tie — deterministic tiebreak: higher agent_id lexicographically wins
		return remote.agent_id > local.agentId ? 'remote' : 'local';
	}

	/** Apply a tombstone — mark agent_addr as dead (only for federated entries).
	 *  Returns true if the tombstone was applied, false if rejected. */
	private async applyTombstone(delta: AgentAddrDelta): Promise<boolean> {
		const existing = await this.db.query.agentAddrs.findFirst({
			where: eq(agentAddrs.agentId, delta.agent_id)
		});

		if (!existing) return false; // Nothing to tombstone

		// Guard: never tombstone locally-registered entries via federation
		if (!existing.source || existing.source === 'local') return false;

		const localTs = existing.updatedAt ?? 0;
		if (delta.updated_at >= localTs) {
			await this.db
				.update(agentAddrs)
				.set({
					status: 'dead',
					source: `federated:${delta.source_node}`,
					updatedAt: delta.updated_at
				})
				.where(eq(agentAddrs.agentId, delta.agent_id));
			return true;
		}
		return false;
	}

	/**
	 * Merge two vector clocks — take max of each node's counter.
	 * Pure function, no side effects.
	 */
	mergeVectorClocks(local: VectorClock, remote: VectorClock): VectorClock {
		const merged: VectorClock = { ...local };
		for (const [nodeId, counter] of Object.entries(remote)) {
			merged[nodeId] = Math.max(merged[nodeId] ?? 0, counter);
		}
		return merged;
	}

	/**
	 * Get deltas since a given vector clock (for outbound gossip).
	 * Returns agent_addrs updated more recently than the peer's last known state.
	 */
	async getDeltasSince(peerClock: VectorClock): Promise<AgentAddrDelta[]> {
		const clockValues = Object.values(peerClock);
		const minTs = clockValues.length > 0 ? Math.max(...clockValues) : 0;

		const rows = await this.db
			.select()
			.from(agentAddrs)
			.where(
				and(
					gt(agentAddrs.updatedAt, minTs),
					inArray(agentAddrs.visibility, [...DISCOVERABLE_VISIBILITIES])
				)
			)
			.limit(1000);

		return rows.map((row) => ({
			agent_id: row.agentId,
			agent_addr:
				row.status === 'dead'
					? null
					: {
							agent_id: row.agentId,
							agent_url: row.agentUrl ?? '',
							api_url: row.apiUrl ?? undefined,
							facts_url: row.factsUrl ?? undefined,
							capabilities: row.capabilities ? JSON.parse(row.capabilities) : undefined,
							tags: row.tags ? JSON.parse(row.tags) : undefined,
							source: row.source ?? undefined,
							status: row.status ?? undefined,
							visibility: normalizeVisibility(row.visibility) ?? 'public'
						},
			updated_at: row.updatedAt ?? Math.floor(Date.now() / 1000),
			source_node: this.deriveSourceNode(row.source)
		}));
	}

	/**
	 * Derive the originating source node from the agent's `source` column.
	 * - `null` / `'local'` → `'local'` (this node originated the agent)
	 * - `'federated:kym-dev'` → `'kym-dev'`
	 * - `'external:hol-nanda'` → `'external:hol-nanda'`
	 * - `'https://nanda.nexartis.com'` → `'https://nanda.nexartis.com'` (v1 source)
	 */
	private deriveSourceNode(source: string | null | undefined): string {
		if (!source || source === 'local') return 'local';
		if (source.startsWith('federated:')) return source.slice('federated:'.length);
		return source;
	}

	/**
	 * Hybrid Lamport tick — advance the node's logical clock.
	 *
	 * Guarantees:
	 *  - Monotonic: always returns at least current + 1
	 *  - Wall-clock grounded: won't drift below real time
	 *
	 * @returns The new clock value (always > current entry for this node)
	 */
	tick(nodeId: string, currentClock: VectorClock): number {
		const wallClock = Math.floor(Date.now() / 1000);
		const current = currentClock[nodeId] ?? 0;
		return Math.max(wallClock, current + 1);
	}

	/**
	 * Advance the local clock past a remote sender's clock.
	 * Used after receiving inbound gossip to maintain causal ordering.
	 *
	 * @returns The advanced clock value
	 */
	advancePastRemote(nodeId: string, localClock: VectorClock, remoteClock: number): number {
		const wallClock = Math.floor(Date.now() / 1000);
		const local = localClock[nodeId] ?? 0;
		return Math.max(wallClock, local, remoteClock) + 1;
	}

	/**
	 * Garbage-collect tombstones older than TTL.
	 * Called periodically to reclaim space.
	 */
	async gcTombstones(): Promise<number> {
		const cutoff = Math.floor(Date.now() / 1000) - TOMBSTONE_TTL_SEC;
		const result = await this.db
			.delete(agentAddrs)
			.where(and(eq(agentAddrs.status, 'dead'), sql`${agentAddrs.updatedAt} < ${cutoff}`));

		const deleted = getChangeCount(result);
		if (deleted > 0) {
			log.info('gcTombstones', `Garbage-collected ${deleted} tombstoned agents`, { deleted });
		}
		return deleted;
	}
}
