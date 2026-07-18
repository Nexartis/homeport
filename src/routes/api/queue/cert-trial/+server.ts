/**
 * POST /api/queue/cert-trial
 *
 * SvelteKit route endpoint for processing a single certification trial.
 * Called inline by the certifier service or directly via HTTP.
 *
 * Auth: Requires X-Cron-Auth header matching CRON_AUTH_TOKEN.
 *
 * @swagger
 * /api/queue/cert-trial:
 *   post:
 *     summary: Process a certification trial (internal)
 *     description: Processes a single certification trial. Requires X-Cron-Auth header.
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
 *               - job_id
 *               - agent_id
 *               - capability
 *               - trial_num
 *               - pass_threshold
 *             properties:
 *               job_id:
 *                 type: string
 *               agent_id:
 *                 type: string
 *               capability:
 *                 type: string
 *               trial_num:
 *                 type: integer
 *                 minimum: 1
 *               pass_threshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *     responses:
 *       200:
 *         description: Trial processed
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import type { CertJobMessage } from '$lib/types';
import { json } from '@sveltejs/kit';
import { processSingleTrial } from '$lib/services/certifier/queue-handler';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';

const log = createLogger(undefined, 'queue-cert-trial');

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;

	// Auth: only allow internal calls
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	if (!env?.KYM_NANDA_EVIDENCE) {
		return json({ error: 'KYM_NANDA_EVIDENCE R2 bucket not available' }, { status: 500 });
	}

	const hmacSecret = await resolveSecret(
		env?.KYM_NANDA_HMAC_SECRET,
		kvFallback(env ?? {}, SECRET_KEYS.HMAC_SECRET)
	);
	if (!hmacSecret) {
		return json({ error: 'KYM_NANDA_HMAC_SECRET not configured' }, { status: 500 });
	}

	let body: CertJobMessage;
	try {
		const parsed = await request.json();
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return json({ error: 'Body must be a JSON object' }, { status: 400 });
		}
		body = parsed as CertJobMessage;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate required fields — strings must be non-empty strings, trial_num must be an integer
	if (
		!body.job_id ||
		typeof body.job_id !== 'string' ||
		!body.agent_id ||
		typeof body.agent_id !== 'string' ||
		!body.capability ||
		typeof body.capability !== 'string' ||
		body.trial_num == null ||
		typeof body.trial_num !== 'number' ||
		!Number.isInteger(body.trial_num) ||
		body.trial_num < 1
	) {
		return json({ error: 'Missing or invalid required fields' }, { status: 400 });
	}

	// Validate pass_threshold is a finite number in [0, 1]
	if (
		body.pass_threshold == null ||
		typeof body.pass_threshold !== 'number' ||
		!Number.isFinite(body.pass_threshold) ||
		body.pass_threshold < 0 ||
		body.pass_threshold > 1
	) {
		return json({ error: 'pass_threshold must be a number between 0 and 1' }, { status: 400 });
	}

	try {
		await processSingleTrial(body, env);
		return json({ ok: true });
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('POST', `Trial processing failed job=${body.job_id} trial=${body.trial_num}`, {
			error: errMsg
		});
		return json({ error: 'Trial processing failed' }, { status: 500 });
	}
};
