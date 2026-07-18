/**
 * Trust Repository — typed data access for federation_trust_scores
 * and cross_registry_scores tables.
 *
 * Phase 3 — Agent Alpha
 */

import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	federationTrustScores,
	crossRegistryScores,
	type NewFederationTrustScore,
	type NewCrossRegistryScore
} from '../schema';

// ===================================================================
// Federation Trust Scores
// ===================================================================

/**
 * Upsert a trust score fetched from a federation peer.
 * Uses INSERT OR REPLACE on the (agent_id, peer_url) unique constraint.
 */
export async function upsertFederationTrustScore(db: DbClient, score: NewFederationTrustScore) {
	return await db
		.insert(federationTrustScores)
		.values(score)
		.onConflictDoUpdate({
			target: [federationTrustScores.agentId, federationTrustScores.peerUrl],
			set: {
				reputation: score.reputation,
				availability: score.availability,
				probeSuccess: score.probeSuccess,
				certScore: score.certScore,
				fraudRate: score.fraudRate,
				badgeTier: score.badgeTier,
				fetchedAt: score.fetchedAt ?? sql`(unixepoch())`
			}
		});
}

/**
 * Get all federation trust scores for a specific agent.
 * Returns one row per peer that has reported scores for this agent.
 */
export async function getFederationTrustScores(db: DbClient, agentId: string) {
	return await db
		.select()
		.from(federationTrustScores)
		.where(eq(federationTrustScores.agentId, agentId));
}

/**
 * Get all federation trust scores (bulk read-only).
 * Used during cross-registry aggregation.
 */
export async function getAllFederationTrustScores(db: DbClient) {
	return await db.select().from(federationTrustScores);
}

// ===================================================================
// Cross-Registry Scores
// ===================================================================

/**
 * Upsert a cross-registry aggregated score for an agent.
 * Uses INSERT OR REPLACE on the agent_id unique constraint.
 */
export async function upsertCrossRegistryScore(db: DbClient, score: NewCrossRegistryScore) {
	return await db
		.insert(crossRegistryScores)
		.values(score)
		.onConflictDoUpdate({
			target: crossRegistryScores.agentId,
			set: {
				localReputation: score.localReputation,
				federatedReputation: score.federatedReputation,
				combinedReputation: score.combinedReputation,
				peerCount: score.peerCount,
				confidence: score.confidence,
				badgeTier: score.badgeTier,
				computedAt: score.computedAt ?? sql`(unixepoch())`
			}
		});
}

/**
 * Get the cross-registry score for a specific agent.
 */
export async function getCrossRegistryScore(db: DbClient, agentId: string) {
	return (
		(await db.query.crossRegistryScores.findFirst({
			where: eq(crossRegistryScores.agentId, agentId)
		})) ?? null
	);
}

/**
 * Get all cross-registry scores (bulk read-only).
 * Used for the public trust score API listing.
 */
export async function getAllCrossRegistryScores(db: DbClient) {
	return await db
		.select()
		.from(crossRegistryScores)
		.orderBy(sql`combined_reputation DESC`);
}
