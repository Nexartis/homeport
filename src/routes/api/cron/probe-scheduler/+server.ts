/**
 * POST /api/cron/probe-scheduler
 *
 * Cron-triggered endpoint that runs health probes for all alive agents
 * inline. Called hourly by the injected scheduled handler via self-fetch
 * with CRON_AUTH_TOKEN authentication.
 *
 * Reference: P3-6 — Probe Scheduler
 * Pattern: knowyourmodel-ai cron self-fetch pattern (see sweep-intents)
 *
 * @swagger
 * /api/cron/probe-scheduler:
 *   post:
 *     summary: Run probe jobs for all agents (internal cron)
 *     description: Cron-triggered endpoint that runs health probes for every alive agent inline. Requires X-Cron-Auth header.
 *     tags:
 *       - Cron (Internal)
 *     security:
 *       - cronAuth: []
 *     responses:
 *       200:
 *         description: Probes completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 probed:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { runScheduledProbes } from '$lib/services/observer/service';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'cron-probe-scheduler');

export const POST: RequestHandler = async ({ request, platform }) => {
	// Auth: only allow calls from the scheduled handler
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	const env = platform?.env;
	if (!env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const db = createDbClient(env.DB);
	try {
		const result = await runScheduledProbes(db, env);
		log.info('POST', `Probed ${result.probed} agents (${result.failed} failed)`);
		return json({ ok: true, ...result });
	} catch (err) {
		log.error('POST', 'Probe scheduler error', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
