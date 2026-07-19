/**
 * POST /api/cron/sweep-intents
 *
 * Cron-triggered endpoint that sweeps expired audit intents and creates
 * `no_show` reconciliation records. Called hourly by the injected scheduled
 * handler via self-fetch with CRON_AUTH_TOKEN authentication.
 *
 * Reference: P3-3 / P3-7 — Intent Expiry Sweeper + no_show verdict
 * Pattern: knowyourmodel-ai cron self-fetch pattern
 *
 * @swagger
 * /api/cron/sweep-intents:
 *   post:
 *     summary: Sweep expired audit intents (internal cron)
 *     description: Sweeps expired intents and creates no_show reconciliation records. Requires X-Cron-Auth header.
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
 *                 swept:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sweepExpiredIntents } from '$lib/services/auditor/service';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'cron-sweep-intents');

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
		const result = await sweepExpiredIntents(db);
		return json({ ok: true, ...result });
	} catch (err) {
		log.error('POST', 'Sweep error', { error: err instanceof Error ? err.message : String(err) });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
