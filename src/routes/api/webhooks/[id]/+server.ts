/**
 * GET    /api/webhooks/:id — Get subscription details
 * PATCH  /api/webhooks/:id — Update subscription (pause/resume)
 * DELETE /api/webhooks/:id — Remove subscription
 *
 * Phase 4 — Agent Beta
 *
 * @swagger
 * /api/webhooks/{id}:
 *   get:
 *     summary: Get webhook subscription details
 *     tags: [Webhooks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Subscription details }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 *   patch:
 *     summary: Update subscription (pause/resume)
 *     tags: [Webhooks]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, enum: [pause, resume] }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Invalid action }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 *   delete:
 *     summary: Delete a webhook subscription
 *     tags: [Webhooks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */

import { isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getWebhookSubscription } from '$lib/db/repositories/webhooks';
import {
	removeSubscription,
	pauseSubscription,
	resumeSubscription
} from '$lib/services/webhooks/service';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-webhooks-id');

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const sub = await getWebhookSubscription(db, params.id);
		if (!sub || !sub.ownerId) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		requireResourceOwner(actor, sub.ownerId, { log, fn: 'GET' });

		// Strip secret from response
		const { secret: _secret, ...safe } = sub;
		return json({ subscription: safe });
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('GET', 'Failed to get subscription', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'PATCH' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let body: { action?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.action || !['pause', 'resume'].includes(body.action)) {
		return json({ error: 'action must be "pause" or "resume"' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const sub = await getWebhookSubscription(db, params.id);
		if (!sub || !sub.ownerId) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		requireResourceOwner(actor, sub.ownerId, { log, fn: 'PATCH' });

		if (body.action === 'pause') {
			await pauseSubscription(db, params.id);
		} else {
			await resumeSubscription(db, params.id);
		}

		return json({ ok: true, status: body.action === 'pause' ? 'paused' : 'active' });
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('PATCH', 'Failed to update subscription', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'DELETE' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const sub = await getWebhookSubscription(db, params.id);
		if (!sub || !sub.ownerId) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		requireResourceOwner(actor, sub.ownerId, { log, fn: 'DELETE' });

		// Ownership was already enforced by requireResourceOwner above
		// (admins bypass). Pass the subscription's own owner id so that
		// removeSubscription's DB-layer match always succeeds for both
		// owner and admin callers.
		const removed = await removeSubscription(db, params.id, sub.ownerId);
		if (!removed) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		return json({ ok: true, deleted: params.id });
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('DELETE', 'Failed to delete subscription', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
