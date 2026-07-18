/**
 * Cross-Registry Trust Aggregation Service
 *
 * Fetches trust/reputation data from federation peer registries and aggregates
 * local + federated scores into a unified cross-registry score with confidence.
 *
 * Formula:
 *   combined = LOCAL_WEIGHT × local + (1 − LOCAL_WEIGHT) × federated
 *   confidence = min(1.0, peer_count / 3)
 *
 * Phase 3 — Agent Alpha
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { Env } from '$lib/types';
import {
	upsertFederationTrustScore,
	getFederationTrustScores,
	upsertCrossRegistryScore,
	getLatestReputations
} from '$lib/db/repositories';
import { computeTrustBadge } from '$lib/services/observer/trust-badges';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'cross-registry');

/** Default weight for local reputation in the combined score */
const DEFAULT_LOCAL_WEIGHT = 0.6;

/** Number of peers required for full confidence (1.0) */
const FULL_CONFIDENCE_PEERS = 3;

/** RFC 1918 / loopback / link-local patterns (mirrors federation.ts SSRF protection) */
const PRIVATE_IP_PATTERNS = [
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2[0-9]|3[01])\./,
	/^192\.168\./,
	/^0\./,
	/^169\.254\./,
	/^::1$/,
	/^fc00:/i,
	/^fd[0-9a-f]{2}:/i,
	/^fe80:/i
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a trust/badges response from a peer's GET /trust/badges */
export interface PeerBadgeEntry {
	agent_id: string;
	reputation: number | null;
	availability: number | null;
	probe_success: number | null;
	cert_score: number | null;
	fraud_rate: number | null;
	badge?: { tier?: string };
}

export interface PeerFetchResult {
	peerUrl: string;
	agents: number;
	errors: number;
	durationMs: number;
}

// ---------------------------------------------------------------------------
// Fetch peer trust scores
// ---------------------------------------------------------------------------

/**
 * Fetch trust badge data from a single peer's GET /trust/badges endpoint,
 * validate the URL for SSRF safety, and persist the scores.
 */
export async function fetchPeerTrustScores(
	db: DbClient,
	peerUrl: string,
	environment?: string
): Promise<PeerFetchResult> {
	const start = Date.now();
	const result: PeerFetchResult = { peerUrl, agents: 0, errors: 0, durationMs: 0 };

	try {
		// Validate peer URL — same SSRF checks as federation.ts validatePeerUrl()
		const parsed = new URL(peerUrl);
		if (environment === 'production' && parsed.protocol !== 'https:') {
			throw new Error(`SSRF: peer URL must use HTTPS in production: ${peerUrl}`);
		}
		const hostname = parsed.hostname;
		if (hostname === 'localhost' || PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) {
			throw new Error(`SSRF: peer URL resolves to a private/loopback address: ${hostname}`);
		}

		const resp = await fetch(`${peerUrl}/trust/badges`, {
			headers: { Accept: 'application/json', 'User-Agent': 'KYM-NANDA-Trust/1.0' },
			signal: AbortSignal.timeout(10_000)
		});

		if (!resp.ok) {
			throw new Error(`Peer returned ${resp.status}: ${resp.statusText}`);
		}

		const body = (await resp.json()) as { agents?: PeerBadgeEntry[] };
		const entries = body?.agents ?? [];

		for (const entry of entries) {
			if (!entry.agent_id) continue;
			try {
				await upsertFederationTrustScore(db, {
					id: nanoid(),
					agentId: entry.agent_id,
					peerUrl,
					reputation: entry.reputation ?? null,
					availability: entry.availability ?? null,
					probeSuccess: entry.probe_success ?? null,
					certScore: entry.cert_score ?? null,
					fraudRate: entry.fraud_rate ?? null,
					badgeTier: entry.badge?.tier ?? 'none'
				});
				result.agents++;
			} catch {
				result.errors++;
			}
		}
	} catch (err) {
		result.errors++;
		log.error('fetchPeerTrustScores', `Fetch from ${peerUrl} failed`, {
			error: err instanceof Error ? err.message : String(err)
		});
	}

	result.durationMs = Date.now() - start;
	return result;
}

// ---------------------------------------------------------------------------
// Aggregate cross-registry scores
// ---------------------------------------------------------------------------

/**
 * Compute the combined cross-registry score for a single agent.
 *
 * @param localReputation  - The agent's local reputation (0–1)
 * @param peerScores       - Array of reputation values from peers
 * @param localWeight      - Weight for local score (0–1), remainder goes to federated avg
 */
export function aggregateCrossRegistryScore(
	localReputation: number,
	peerScores: number[],
	localWeight: number = DEFAULT_LOCAL_WEIGHT
): { combined: number; federated: number; confidence: number; peerCount: number } {
	const peerCount = peerScores.length;
	const confidence = Math.min(1.0, peerCount / FULL_CONFIDENCE_PEERS);

	if (peerCount === 0) {
		// No federated data — combined equals local, low confidence
		return { combined: localReputation, federated: 0, confidence: 0, peerCount: 0 };
	}

	const federated = peerScores.reduce((a, b) => a + b, 0) / peerCount;
	const combined = clamp(localWeight * localReputation + (1 - localWeight) * federated);

	return {
		combined: round(combined),
		federated: round(federated),
		confidence: round(confidence),
		peerCount
	};
}

/**
 * Compute and persist cross-registry scores for all agents that have local
 * reputation data. Fetches federated trust scores from the DB (already
 * synced) and merges with local reputations.
 */
export async function computeCrossRegistryScores(
	db: DbClient,
	env?: Env
): Promise<{ computed: number; errors: number }> {
	const localWeight = parseFloat(env?.TRUST_LOCAL_WEIGHT ?? '') || DEFAULT_LOCAL_WEIGHT;

	// 1. Fetch all local reputations
	const localReps = await getLatestReputations(db);

	let computed = 0;
	let errors = 0;

	for (const local of localReps) {
		try {
			// 2. Fetch federated scores for this agent
			const fedScores = await getFederationTrustScores(db, local.agent_id);
			const peerReps = fedScores.map((s) => s.reputation).filter((r): r is number => r != null);

			// 3. Aggregate
			const agg = aggregateCrossRegistryScore(local.reputation ?? 0, peerReps, localWeight);

			// 4. Compute badge on the combined score
			const badge = computeTrustBadge({
				reputation: agg.combined,
				availability: local.availability ?? null,
				cert_score: local.cert_score ?? null,
				fraud_rate: local.fraud_rate ?? null
			});

			// 5. Persist
			await upsertCrossRegistryScore(db, {
				id: nanoid(),
				agentId: local.agent_id,
				localReputation: round(local.reputation ?? 0),
				federatedReputation: agg.federated,
				combinedReputation: agg.combined,
				peerCount: agg.peerCount,
				confidence: agg.confidence,
				badgeTier: badge.tier
			});

			computed++;
		} catch (err) {
			errors++;
			log.error('computeCrossRegistryScores', `Failed for ${local.agent_id}`, {
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	return { computed, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value to [0, 1] */
function clamp(n: number): number {
	return Math.max(0, Math.min(1, n));
}

/** Round to 4 decimal places */
function round(n: number): number {
	return Math.round(n * 10000) / 10000;
}
