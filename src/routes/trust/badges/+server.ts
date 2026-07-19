/**
 * GET /trust/badges
 *
 * Public endpoint returning trust badges computed from reputation data.
 * Badges are computed on-the-fly — no additional DB schema needed.
 *
 * Query params:
 *   ?agent=ID  — Filter to a single agent's badge
 *
 * Response:
 *   { agents: [...], total, badge_distribution, fetchedAt }
 *
 * @swagger
 * /trust/badges:
 *   get:
 *     summary: Trust badges
 *     description: Public endpoint returning trust badges computed from reputation data. Filterable by agent ID.
 *     tags:
 *       - Trust
 *     parameters:
 *       - in: query
 *         name: agent
 *         schema:
 *           type: string
 *         description: Agent ID to filter
 *     responses:
 *       200:
 *         description: Trust badges with distribution
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getLatestReputations } from '$lib/db/repositories';
import { computeTrustBadge, type TrustBadgeTier } from '$lib/services/observer/trust-badges';

export const GET: RequestHandler = async ({ url, platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const db = createDbClient(platform.env.DB);
	const agentFilter = url.searchParams.get('agent')?.trim() || null;

	// Badge computation uses cert_score from reputation_snapshots (the Observer's
	// last computed snapshot).  The /reputation route merges with the certificates
	// table for the most up-to-date cert data, but badges intentionally use the
	// snapshot for a consistent, point-in-time view.
	const reputations = await getLatestReputations(db);

	// Build badge entries
	const allEntries = reputations.map((r) => {
		const badge = computeTrustBadge({
			reputation: r.reputation,
			availability: r.availability,
			cert_score: r.cert_score,
			fraud_rate: r.fraud_rate
		});

		return {
			agent_id: r.agent_id,
			badge,
			reputation_snapshot: {
				reputation: r.reputation,
				availability: r.availability,
				error_rate: r.error_rate,
				fraud_rate: r.fraud_rate,
				p95_latency_ms: r.p95_latency_ms,
				probe_success: r.probe_success,
				cert_score: r.cert_score,
				snapshot_at: r.created_at
			}
		};
	});

	// Filter by agent if requested
	const agents = agentFilter ? allEntries.filter((e) => e.agent_id === agentFilter) : allEntries;

	// Compute badge distribution across ALL agents (unfiltered)
	const distribution: Record<TrustBadgeTier, number> = { none: 0, bronze: 0, silver: 0, gold: 0 };
	for (const entry of allEntries) {
		distribution[entry.badge.tier]++;
	}

	return json({
		agents,
		total: agents.length,
		badge_distribution: distribution,
		fetchedAt: new Date().toISOString()
	});
};
