/**
 * POST /api/agents/:agentId/deprecate
 *
 * Initiates deprecation of an agent with a grace period before sunset.
 * Auth: X-Cron-Auth header (admin-only).
 *
 * Body: { reason: string, grace_period_days?: number, notify_consumers?: boolean }
 * Response: { agent_id, deprecated_at, sunset_at, notified }
 *
 * @swagger
 * /api/agents/{agentId}/deprecate:
 *   post:
 *     summary: Deprecate agent
 *     description: Initiate deprecation with a grace period before sunset. Optionally notifies consumers via webhooks.
 *     tags:
 *       - Lifecycle
 *     security:
 *       - CronAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deprecation initiated
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { deprecateAgent } from '$lib/services/deprecation/service';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'api-deprecate');

export const POST: RequestHandler = async ({ request, platform, params }) => {
	const env = platform?.env;

	// Auth
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const agentId = params.agentId;
	if (!agentId) {
		return json({ error: 'Missing agentId' }, { status: 400 });
	}

	let body: { reason?: string; grace_period_days?: number; notify_consumers?: boolean };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.reason || typeof body.reason !== 'string') {
		return json({ error: 'reason is required and must be a string' }, { status: 400 });
	}

	// Validate grace_period_days — must be a safe positive integer, max 3 years
	if (body.grace_period_days !== undefined) {
		if (
			typeof body.grace_period_days !== 'number' ||
			!Number.isSafeInteger(body.grace_period_days) ||
			body.grace_period_days < 1 ||
			body.grace_period_days > 1095
		) {
			return json(
				{ error: 'grace_period_days must be a positive integer (max 1095)' },
				{ status: 400 }
			);
		}
	}

	// Validate notify_consumers — must be a boolean if provided
	if (body.notify_consumers !== undefined && typeof body.notify_consumers !== 'boolean') {
		return json({ error: 'notify_consumers must be a boolean' }, { status: 400 });
	}

	try {
		const db = createDbClient(env.DB);
		const result = await deprecateAgent(db, {
			agentId,
			reason: body.reason,
			gracePeriodDays: body.grace_period_days ?? 30,
			notifyConsumers: body.notify_consumers ?? true
		});

		if (!result.success) {
			return json({ error: result.error }, { status: 400 });
		}

		return json({
			agent_id: result.agentId,
			deprecated_at: result.deprecatedAt,
			sunset_at: result.sunsetAt,
			notified: result.notified
		});
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('POST', `Deprecation failed for agent=${agentId}`, { error: errMsg });
		return json({ error: 'Deprecation failed' }, { status: 500 });
	}
};
