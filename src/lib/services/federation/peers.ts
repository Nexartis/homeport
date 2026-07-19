/**
 * Peer Management Service — Federation v2
 *
 * Manages federation peer lifecycle: registration, health tracking,
 * failure threshold (3 strikes → offline), and recovery.
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase D — Peer Management
 */

import { eq, sql, ne } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { federationPeers } from '$lib/db/schema';
import type { FederationPeer } from '$lib/types/federation-v2';
import { createLogger } from '$lib/utils/logger';
import { getChangeCount } from '$lib/utils/drizzle-helpers';

const log = createLogger(undefined, 'peers');

/** Max consecutive failures before marking peer as offline */
const FAILURE_THRESHOLD = 3;

/** Degraded threshold: 1+ failure but < 3 */
const DEGRADED_THRESHOLD = 1;

export class PeerService {
	constructor(private db: DbClient) {}

	/**
	 * Register a new federation peer.
	 */
	async registerPeer(
		peer: Pick<FederationPeer, 'peer_id' | 'peer_url' | 'node_id'> & {
			capabilities?: string[];
			quilt_types?: string[];
		}
	): Promise<FederationPeer> {
		const now = Math.floor(Date.now() / 1000);
		const record = {
			peerId: peer.peer_id,
			peerUrl: peer.peer_url,
			nodeId: peer.node_id,
			status: 'active' as const,
			lastSyncAt: now,
			lastGossipAt: 0,
			vectorClock: '{}',
			failureCount: 0,
			capabilities: JSON.stringify(peer.capabilities ?? []),
			quiltTypes: JSON.stringify(peer.quilt_types ?? ['native']),
			createdAt: now,
			updatedAt: now
		};

		await this.db
			.insert(federationPeers)
			.values(record)
			.onConflictDoUpdate({
				target: federationPeers.peerId,
				set: {
					peerUrl: record.peerUrl,
					nodeId: record.nodeId,
					status: 'active',
					failureCount: 0,
					capabilities: record.capabilities,
					quiltTypes: record.quiltTypes,
					updatedAt: now
				}
			});

		return {
			peer_id: peer.peer_id,
			peer_url: peer.peer_url,
			node_id: peer.node_id,
			status: 'active',
			last_sync_at: now,
			last_gossip_at: 0,
			vector_clock: {},
			failure_count: 0,
			capabilities: peer.capabilities ?? [],
			quilt_types: peer.quilt_types ?? ['native'],
			created_at: now
		};
	}

	/**
	 * Get a peer by ID, returning typed FederationPeer.
	 */
	async getPeer(peerId: string): Promise<FederationPeer | null> {
		const row = await this.db.query.federationPeers.findFirst({
			where: eq(federationPeers.peerId, peerId)
		});

		if (!row) return null;
		return this.rowToPeer(row);
	}

	/**
	 * Get all peers with status != 'offline'.
	 */
	async getHealthyPeers(): Promise<FederationPeer[]> {
		const rows = await this.db
			.select()
			.from(federationPeers)
			.where(ne(federationPeers.status, 'offline'));

		return rows.map(this.rowToPeer);
	}

	/**
	 * Get ALL peers (including offline).
	 */
	async getAllPeers(): Promise<FederationPeer[]> {
		const rows = await this.db.select().from(federationPeers);
		return rows.map(this.rowToPeer);
	}

	/**
	 * Update peer status based on success/failure of interaction.
	 * Implements 3-strike rule for failure → offline promotion.
	 */
	async updatePeerStatus(peerId: string, success: boolean): Promise<void> {
		const now = Math.floor(Date.now() / 1000);

		if (success) {
			await this.db
				.update(federationPeers)
				.set({
					status: 'active',
					failureCount: 0,
					lastGossipAt: now,
					updatedAt: now
				})
				.where(eq(federationPeers.peerId, peerId));
			return;
		}

		// Failure path — increment failure count
		await this.db
			.update(federationPeers)
			.set({
				failureCount: sql`${federationPeers.failureCount} + 1`,
				updatedAt: now
			})
			.where(eq(federationPeers.peerId, peerId));

		// Check if we've crossed the threshold
		const peer = await this.getPeer(peerId);
		if (!peer) return;

		let newStatus: 'active' | 'degraded' | 'offline' = 'active';
		if (peer.failure_count >= FAILURE_THRESHOLD) {
			newStatus = 'offline';
		} else if (peer.failure_count >= DEGRADED_THRESHOLD) {
			newStatus = 'degraded';
		}

		if (newStatus !== peer.status) {
			await this.db
				.update(federationPeers)
				.set({ status: newStatus, updatedAt: now })
				.where(eq(federationPeers.peerId, peerId));

			log.info('updatePeerStatus', `Peer ${peerId} status changed: ${peer.status} → ${newStatus}`, {
				peerId,
				failureCount: peer.failure_count,
				newStatus
			});
		}
	}

	/**
	 * Remove a peer registration.
	 */
	async removePeer(peerId: string): Promise<boolean> {
		const result = await this.db.delete(federationPeers).where(eq(federationPeers.peerId, peerId));
		return getChangeCount(result) === 1;
	}

	/**
	 * Get peer count summary for /federation/status.
	 */
	async getPeerSummary(): Promise<{
		total: number;
		active: number;
		degraded: number;
		offline: number;
	}> {
		const rows = await this.db
			.select({
				status: federationPeers.status,
				count: sql<number>`count(*)`
			})
			.from(federationPeers)
			.groupBy(federationPeers.status);

		let active = 0,
			degraded = 0,
			offline = 0;
		for (const row of rows) {
			if (row.status === 'active') active = row.count;
			else if (row.status === 'degraded') degraded = row.count;
			else if (row.status === 'offline') offline = row.count;
		}

		return { total: active + degraded + offline, active, degraded, offline };
	}

	/**
	 * Convert a DB row to a typed FederationPeer.
	 */
	private rowToPeer(row: {
		peerId: string;
		peerUrl: string;
		nodeId: string;
		status: string;
		lastSyncAt: number | null;
		lastGossipAt: number | null;
		vectorClock: string | null;
		failureCount: number | null;
		capabilities: string | null;
		quiltTypes: string | null;
		createdAt: number | null;
	}): FederationPeer {
		return {
			peer_id: row.peerId,
			peer_url: row.peerUrl,
			node_id: row.nodeId,
			status: row.status as 'active' | 'degraded' | 'offline',
			last_sync_at: row.lastSyncAt ?? 0,
			last_gossip_at: row.lastGossipAt ?? 0,
			vector_clock: row.vectorClock ? JSON.parse(row.vectorClock) : {},
			failure_count: row.failureCount ?? 0,
			capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
			quilt_types: row.quiltTypes ? JSON.parse(row.quiltTypes) : ['native'],
			created_at: row.createdAt ?? 0
		};
	}
}
