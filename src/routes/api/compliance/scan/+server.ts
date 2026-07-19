/**
 * POST /api/compliance/scan
 *
 * Cron-triggered (or manual) endpoint that runs compliance scans for all
 * alive agents. Evaluates each agent's latest reputation against minimum
 * compliance thresholds and persists results to compliance_scan_runs.
 *
 * Auth: X-Cron-Auth header matching CRON_AUTH_TOKEN.
 *
 * Agent Beta — Phase 3 (S6-B4)
 *
 * @swagger
 * /api/compliance/scan:
 *   post:
 *     summary: Run compliance scan for all agents (internal cron / admin)
 *     description: Scans all alive agents against minimum compliance thresholds. Requires X-Cron-Auth header.
 *     tags:
 *       - Cron (Internal)
 *     security:
 *       - cronAuth: []
 *     responses:
 *       200:
 *         description: Scan complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 scanned:
 *                   type: integer
 *                 results:
 *                   type: array
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { scanAllAgents } from '$lib/services/compliance/scanner';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'cron-compliance-scan');

export const POST: RequestHandler = async ({ request, platform }) => {
	// Auth: only allow calls from the scheduled handler or admin
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	const d1 = platform?.env?.DB;
	if (!d1) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const db = createDbClient(d1);
	try {
		const result = await scanAllAgents(db);
		log.info('POST', `Compliance scan complete: ${result.scanned} agents scanned`);
		return json({ ok: true, ...result });
	} catch (err) {
		log.error('POST', 'Compliance scan error', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
