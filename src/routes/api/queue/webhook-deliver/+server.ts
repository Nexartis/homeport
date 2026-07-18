/**
 * POST /api/queue/webhook-deliver
 *
 * SvelteKit route endpoint for processing a single webhook delivery.
 * Called inline by the webhooks service or directly via HTTP.
 *
 * Auth: Requires X-Cron-Auth header matching CRON_AUTH_TOKEN.
 *
 * @swagger
 * /api/queue/webhook-deliver:
 *   post:
 *     summary: Deliver a webhook notification (internal)
 *     description: Processes a single webhook delivery. Requires X-Cron-Auth header.
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
 *               - subscription_id
 *               - event_type
 *               - payload
 *               - idempotency_key
 *             properties:
 *               subscription_id:
 *                 type: string
 *               event_type:
 *                 type: string
 *               payload:
 *                 type: object
 *               idempotency_key:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import type { WebhookJobMessage } from '$lib/services/webhooks/service';
import { json } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { processWebhookDelivery } from '$lib/services/webhooks/delivery';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'webhook-deliver');

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;

	// Auth: only allow internal calls
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	let body: WebhookJobMessage;
	try {
		const parsed = await request.json();
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return json({ error: 'Body must be a JSON object' }, { status: 400 });
		}
		body = parsed as WebhookJobMessage;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate required fields
	if (!body.subscription_id || typeof body.subscription_id !== 'string') {
		return json({ error: 'Invalid subscription_id' }, { status: 400 });
	}
	if (!body.event_type || typeof body.event_type !== 'string') {
		return json({ error: 'Invalid event_type' }, { status: 400 });
	}
	if (!body.idempotency_key || typeof body.idempotency_key !== 'string') {
		return json({ error: 'Invalid idempotency_key' }, { status: 400 });
	}
	if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
		return json({ error: 'Invalid payload — must be a JSON object' }, { status: 400 });
	}

	try {
		const db = createDbClient(env.DB);
		const result = await processWebhookDelivery(db, body);

		// Return 200 for successful deliveries and discards (subscription gone/inactive).
		// Return non-2xx only for actual delivery failures so callers know to retry.
		const acknowledged = result.delivered || result.discarded;
		const status = acknowledged ? 200 : 502;
		return json({ ok: acknowledged, ...result }, { status });
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('POST', `Webhook delivery failed for subscription=${body.subscription_id}`, {
			error: errMsg
		});
		return json({ error: 'Webhook delivery failed' }, { status: 500 });
	}
};
