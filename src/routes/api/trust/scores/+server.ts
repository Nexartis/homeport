/**
 * GET /api/trust/scores
 *
 * Public API endpoint for querying cross-registry trust scores.
 * Requires a valid developer API key (nanda_ prefix, Bearer token).
 *
 * Query params:
 *   ?agent=ID      — Filter to a single agent (returns detailed peer breakdown)
 *   ?offset=N      — Pagination offset (default 0)
 *   ?limit=N       — Page size, max 100 (default 50)
 *
 * Response (list):
 *   { agents, total, badge_distribution, fetchedAt }
 *
 * Response (single):
 *   { agent, fetchedAt }
 *
 * @swagger
 * /api/trust/scores:
 *   get:
 *     summary: Query cross-registry trust scores (API key required)
 *     tags:
 *       - Trust Scores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: agent
 *         in: query
 *         schema: { type: string }
 *       - name: offset
 *         in: query
 *         schema: { type: integer, default: 0 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 50, maximum: 100 }
 *     responses:
 *       200:
 *         description: Trust scores
 *       401:
 *         description: API key required
 *       404:
 *         description: Agent not found
 *       503:
 *         description: Database unavailable
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getTrustScoreForAgent, listTrustScores } from '$lib/services/trust/trust-score-api';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-trust-scores');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const db = createDbClient(platform.env.DB);
	const agentFilter = url.searchParams.get('agent')?.trim() || null;

	try {
		if (agentFilter) {
			// Single-agent detailed view with peer breakdown
			const entry = await getTrustScoreForAgent(db, agentFilter);
			if (!entry) {
				return json({ error: 'Agent not found' }, { status: 404 });
			}
			return json({ agent: entry, fetchedAt: new Date().toISOString() });
		}

		// Paginated list view
		const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
		const limit = Math.min(
			100,
			Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50)
		);

		const result = await listTrustScores(db, offset, limit);
		return json(result);
	} catch (err) {
		log.error('GET', 'Trust score query failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
