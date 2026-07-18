/**
 * Trust Score API Service — builds public API response objects from
 * cross-registry scores + local reputation data.
 *
 * Phase 3 — Agent Alpha
 */

import type { DbClient } from '$lib/db/client';
import {
	getLatestReputations,
	getCrossRegistryScore,
	getAllCrossRegistryScores,
	getFederationTrustScores
} from '$lib/db/repositories';
import { computeTrustBadge } from '$lib/services/observer/trust-badges';
import type { TrustBadgeTier } from '$lib/services/observer/trust-badges';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrustScoreEntry {
	agent_id: string;
	local_reputation: number | null;
	federated_reputation: number | null;
	combined_reputation: number | null;
	peer_count: number;
	confidence: number;
	badge: {
		tier: TrustBadgeTier;
		label: string;
		emoji: string;
	};
	peers: Array<{
		peer_url: string;
		reputation: number | null;
		badge_tier: string | null;
		fetched_at: number | null;
	}>;
}

export interface TrustScoreListResponse {
	agents: TrustScoreEntry[];
	total: number;
	badge_distribution: Record<TrustBadgeTier, number>;
	fetchedAt: string;
}

export interface TrustScoreSingleResponse {
	agent: TrustScoreEntry;
	fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Build a single agent's trust score response including federated peer breakdown.
 */
export async function getTrustScoreForAgent(
	db: DbClient,
	agentId: string
): Promise<TrustScoreEntry | null> {
	// Get local reputation
	const allReps = await getLatestReputations(db);
	const localRep = allReps.find((r) => r.agent_id === agentId);
	if (!localRep) return null;

	// Get cross-registry score
	const crossScore = await getCrossRegistryScore(db, agentId);

	// Get peer breakdown
	const peerScores = await getFederationTrustScores(db, agentId);

	// Compute badge on combined score (or local if no cross-registry data)
	const effectiveReputation = crossScore?.combinedReputation ?? localRep.reputation ?? 0;
	const badge = computeTrustBadge({
		reputation: effectiveReputation,
		availability: localRep.availability,
		cert_score: localRep.cert_score,
		fraud_rate: localRep.fraud_rate
	});

	return {
		agent_id: agentId,
		local_reputation: localRep.reputation,
		federated_reputation: crossScore?.federatedReputation ?? null,
		combined_reputation: crossScore?.combinedReputation ?? localRep.reputation,
		peer_count: crossScore?.peerCount ?? 0,
		confidence: crossScore?.confidence ?? 0,
		badge: { tier: badge.tier, label: badge.label, emoji: badge.emoji },
		peers: peerScores.map((p) => ({
			peer_url: p.peerUrl,
			reputation: p.reputation,
			badge_tier: p.badgeTier,
			fetched_at: p.fetchedAt
		}))
	};
}

/**
 * Build a paginated list of all agents' trust scores.
 */
export async function listTrustScores(
	db: DbClient,
	offset: number = 0,
	limit: number = 50
): Promise<TrustScoreListResponse> {
	const allReps = await getLatestReputations(db);
	const crossScores = await getAllCrossRegistryScores(db);
	const crossMap = new Map(crossScores.map((c) => [c.agentId, c]));

	const distribution: Record<TrustBadgeTier, number> = { none: 0, bronze: 0, silver: 0, gold: 0 };

	const allEntries: TrustScoreEntry[] = allReps.map((r) => {
		const cs = crossMap.get(r.agent_id);
		const effectiveRep = cs?.combinedReputation ?? r.reputation ?? 0;
		const badge = computeTrustBadge({
			reputation: effectiveRep,
			availability: r.availability,
			cert_score: r.cert_score,
			fraud_rate: r.fraud_rate
		});
		distribution[badge.tier]++;

		return {
			agent_id: r.agent_id,
			local_reputation: r.reputation,
			federated_reputation: cs?.federatedReputation ?? null,
			combined_reputation: cs?.combinedReputation ?? r.reputation,
			peer_count: cs?.peerCount ?? 0,
			confidence: cs?.confidence ?? 0,
			badge: { tier: badge.tier, label: badge.label, emoji: badge.emoji },
			peers: [] // Peer breakdown omitted in list view for performance
		};
	});

	const paginated = allEntries.slice(offset, offset + limit);

	return {
		agents: paginated,
		total: allEntries.length,
		badge_distribution: distribution,
		fetchedAt: new Date().toISOString()
	};
}
