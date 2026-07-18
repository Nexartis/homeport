/**
 * GET /api/analytics/behavior
 *
 * Lane C (M2M): any authenticated caller — developer API key or admin
 * session — may query agent behavior analytics.
 *
 * Ownership scoping note: the `agent_behavior_metrics` and `agent_addrs`
 * tables do not carry an `owner_id` column, so per-owner filtering is not
 * yet possible at this layer. `requireAuthenticated` is the tightest
 * meaningful guard until a schema migration introduces owner linkage.
 *
 * Query params:
 *   ?agent=ID        — Agent identifier (required)
 *   ?period=daily    — Period type: 'daily' | 'weekly' (default 'daily')
 *   ?limit=30        — Max results (1–90, default 30)
 *
 * Response:
 *   { metrics, trends, anomalies, fetchedAt }
 *
 * @swagger
 * /api/analytics/behavior:
 *   get:
 *     summary: Behavior analytics
 *     description: Agent behavior analytics including probe success rates, latency trends, and anomaly detection.
 *     tags:
 *       - Analytics
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: agent
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Behavior metrics with trends and anomalies
 *       400:
 *         description: Missing agent parameter
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getAgentTrends } from '$lib/services/analytics/behavior';
import { computeTrend, detectAnomalies, formatTrendSummary } from '$lib/services/analytics/trends';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-analytics-behavior');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const agentId = url.searchParams.get('agent')?.trim();
	if (!agentId) {
		return json({ error: 'Missing required query parameter: agent' }, { status: 400 });
	}

	const period = (url.searchParams.get('period')?.trim() || 'daily') as 'daily' | 'weekly';
	if (period !== 'daily' && period !== 'weekly') {
		return json({ error: 'Invalid period — must be "daily" or "weekly"' }, { status: 400 });
	}

	const limit = Math.min(
		90,
		Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10) || 30)
	);

	const db = createDbClient(platform.env.DB);

	try {
		const metrics = await getAgentTrends(db, agentId, period, limit);

		// Extract reputation scores for trend/anomaly analysis (reverse to chronological order)
		const reputationValues = metrics
			.filter((m) => m.reputationScore != null)
			.map((m) => m.reputationScore as number)
			.reverse();

		const uptimeValues = metrics
			.filter((m) => m.uptimePct != null)
			.map((m) => m.uptimePct as number)
			.reverse();

		const trends = {
			reputation: computeTrend(reputationValues),
			uptime: computeTrend(uptimeValues),
			reputation_summary: formatTrendSummary(computeTrend(reputationValues)),
			uptime_summary: formatTrendSummary(computeTrend(uptimeValues))
		};

		const anomalies = {
			reputation: detectAnomalies(reputationValues),
			uptime: detectAnomalies(uptimeValues)
		};

		return json({
			agent: agentId,
			period,
			metrics,
			trends,
			anomalies,
			fetchedAt: new Date().toISOString()
		});
	} catch (err) {
		log.error('GET', 'Behavior analytics query failed', {
			agent: agentId,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
