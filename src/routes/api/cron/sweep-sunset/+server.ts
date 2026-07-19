/**
 * POST /api/cron/sweep-sunset
 *
 * Cron-triggered endpoint that sweeps deprecated agents past their sunset date
 * and tombstones them. Called hourly by the injected scheduled handler via
 * self-fetch with CRON_AUTH_TOKEN authentication.
 *
 * Phase 4 — Agent Gamma: Deprecation lifecycle automation
 * Pattern: matches sweep-intents / probe-scheduler cron self-fetch pattern
 *
 * @swagger
 * /api/cron/sweep-sunset:
 *   post:
 *     summary: Sweep sunset-expired agents (internal cron)
 *     description: >
 *       Finds deprecated agents whose sunset date has passed and tombstones them.
 *       Dispatches 'tombstoned' webhook events inline for each affected agent
 *       (best-effort — agents are tombstoned regardless). Requires X-Cron-Auth header.
 *     tags:
 *       - Cron (Internal)
 *     security:
 *       - cronAuth: []
 *     responses:
 *       200:
 *         description: Sweep completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean

 *                 tombstoned:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sweepSunsetAgents } from '$lib/services/deprecation/service';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'cron-sweep-sunset');

export const POST: RequestHandler = async ({ request, platform }) => {
	// Auth: only allow calls from the scheduled handler
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	const d1 = platform?.env?.DB;
	if (!d1) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const db = createDbClient(d1);

	try {
		const result = await sweepSunsetAgents(db);
		if (result.tombstoned.length > 0) {
			log.info('POST', `Tombstoned ${result.tombstoned.length} sunset-expired agents`, {
				agents: result.tombstoned
			});
		}
		return json({ ok: true, ...result });
	} catch (err) {
		log.error('POST', 'Sweep error', { error: err instanceof Error ? err.message : String(err) });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
