/**
 * POST /api/queue/probe-run
 *
 * SvelteKit route endpoint for processing a single health probe.
 * Called inline by the observer service or directly via HTTP.
 *
 * Auth: Requires X-Cron-Auth header matching CRON_AUTH_TOKEN.
 *
 * @swagger
 * /api/queue/probe-run:
 *   post:
 *     summary: Process a health probe (internal)
 *     description: Runs a health probe and computes reputation for a single agent. Includes idempotency and partial-failure recovery. Requires X-Cron-Auth header.
 *     tags:
 *       - Internal
 *     security:
 *       - cronAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agent_id
 *               - agent_url
 *             properties:
 *               agent_id:
 *                 type: string
 *               agent_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Probe processed (may include skipped or recovered flags)
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import type { ProbeJobMessage } from '$lib/types';
import { json } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { getRecentProbeRun, getRecentReputationSnapshot } from '$lib/db/repositories';
import { runProbe, computeReputation } from '$lib/services/observer/service';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'queue-probe-run');

/** Idempotency window in seconds — skip re-probe if a run exists within this period. */
const IDEMPOTENCY_WINDOW_SEC = 300;

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;

	// Auth: only allow internal calls
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	let body: ProbeJobMessage;
	try {
		const parsed = await request.json();
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return json({ error: 'Body must be a JSON object' }, { status: 400 });
		}
		body = parsed as ProbeJobMessage;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { agent_id, agent_url } = body;

	// Validate payload
	if (!agent_id || typeof agent_id !== 'string') {
		return json({ error: 'Invalid agent_id' }, { status: 400 });
	}
	if (!agent_url || typeof agent_url !== 'string') {
		return json({ error: 'Invalid agent_url' }, { status: 400 });
	}

	try {
		const db = createDbClient(env.DB);

		// Idempotency check — skip if a probe run AND reputation snapshot both exist within the window.
		// Checking both prevents a partial-failure retry (runProbe succeeded but computeReputation
		// failed) from being silently skipped, which would leave the agent without an updated snapshot.
		const cutoff = Math.floor(Date.now() / 1000) - IDEMPOTENCY_WINDOW_SEC;
		const existingProbe = await getRecentProbeRun(db, agent_id, cutoff);

		if (existingProbe) {
			const existingSnapshot = await getRecentReputationSnapshot(db, agent_id, cutoff);
			if (existingSnapshot) {
				log.info('POST', `Skipping duplicate probe for ${agent_id}`, { run_id: existingProbe.id });
				return json({ ok: true, skipped: true, reason: 'idempotency' });
			}
			// Probe exists but snapshot is missing — partial failure; re-run reputation only
			log.info('POST', `Re-running computeReputation for ${agent_id} (partial failure recovery)`);
			await computeReputation(db, agent_id, env);
			return json({ ok: true, recovered: true });
		}

		// Full pipeline: probe + reputation computation
		await runProbe(db, agent_id, agent_url, undefined, env);
		await computeReputation(db, agent_id, env);

		return json({ ok: true });
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('POST', `Probe failed for agent=${agent_id}`, { error: errMsg });
		return json({ error: 'Probe processing failed' }, { status: 500 });
	}
};
