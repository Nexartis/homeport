/**
 * GET /.well-known/nanda-index/diff?since=<ISO-8601|unix>
 *
 * Returns agents added, updated, or removed since the given timestamp.
 * Used by SDK's `subscribeToIndex` polling mechanism for incremental sync.
 *
 * @swagger
 * /.well-known/nanda-index/diff:
 *   get:
 *     summary: Incremental index diff
 *     description: Returns agents added, updated, or removed since a timestamp. Used for incremental sync by SDK polling.
 *     tags:
 *       - Discovery
 *     parameters:
 *       - in: query
 *         name: since
 *         required: true
 *         schema:
 *           type: string
 *         description: ISO-8601 timestamp or Unix epoch seconds
 *     responses:
 *       200:
 *         description: Diff of agents (added, updated, removed)
 *       400:
 *         description: Missing or invalid since parameter
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import { gte, and, eq, lt, notInArray, or, isNull, isNotNull } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';
import { toAgentRecord } from '$lib/services/registry';

const log = createLogger(undefined, 'nanda-index-diff');

/**
 * Parse a `since` parameter — accepts ISO-8601 strings or raw unix-epoch seconds.
 * Returns unix seconds or null on invalid input.
 */
function parseSince(raw: string | null): number | null {
	if (!raw) return null;
	// Try as numeric unix epoch (seconds)
	const asNum = Number(raw);
	if (!Number.isNaN(asNum) && Number.isFinite(asNum) && asNum >= 0) {
		// Detect millisecond timestamps (> 10^12) and normalise to seconds
		return Math.floor(asNum > 1e12 ? asNum / 1000 : asNum);
	}
	// Try as ISO-8601
	const d = new Date(raw);
	if (!Number.isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
	return null;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const sinceEpoch = parseSince(url.searchParams.get('since'));
	if (sinceEpoch === null) {
		return json(
			{ error: 'Missing or invalid `since` parameter (ISO-8601 or unix epoch seconds)' },
			{ status: 400 }
		);
	}

	try {
		const db = createDbClient(platform.env.DB);

		// Added: registered_at >= since AND status is alive (NULL status treated as alive)
		const aliveCondition = or(eq(agentAddrs.status, 'alive'), isNull(agentAddrs.status));
		const added = await db
			.select()
			.from(agentAddrs)
			.where(and(gte(agentAddrs.registeredAt, sinceEpoch), aliveCondition));

		// Updated: updated_at >= since AND registered_at < since AND still alive
		const updated = await db
			.select()
			.from(agentAddrs)
			.where(
				and(
					gte(agentAddrs.updatedAt, sinceEpoch),
					lt(agentAddrs.registeredAt, sinceEpoch),
					aliveCondition
				)
			);

		// Filter: exclude items that are in `added` (registered after `since`)
		const addedIds = new Set(added.map((a) => a.agentId));
		const updatedFiltered = updated.filter((a) => !addedIds.has(a.agentId));

		// Removed: status changed to a non-alive value after `since` (only explicit non-alive statuses)
		const removed = await db
			.select({ agentId: agentAddrs.agentId })
			.from(agentAddrs)
			.where(
				and(
					gte(agentAddrs.updatedAt, sinceEpoch),
					isNotNull(agentAddrs.status),
					notInArray(agentAddrs.status, ['alive'])
				)
			);

		log.info('GET', 'Index diff computed', {
			since: sinceEpoch,
			added: added.length,
			updated: updatedFiltered.length,
			removed: removed.length
		});

		// Normalize status: null → 'alive' so clients get a consistent value
		const normalizeStatus = (rec: Record<string, unknown>) => ({
			...rec,
			status: rec.status ?? 'alive'
		});

		return json(
			{
				since: new Date(sinceEpoch * 1000).toISOString(),
				added: added.map(toAgentRecord).map(normalizeStatus),
				updated: updatedFiltered.map(toAgentRecord).map(normalizeStatus),
				removed: removed.map((r) => r.agentId)
			},
			{
				headers: {
					'Cache-Control': 'no-cache',
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('GET', 'Failed to compute index diff', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
