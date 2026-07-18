/**
 * GET    /api/subscriptions/[id] — Get subscription details + events
 * PATCH  /api/subscriptions/[id] — Update subscription (change plan, cancel)
 * DELETE /api/subscriptions/[id] — Cancel subscription
 *
 * Phase 5 — Agent Charlie (D6)
 
 * @swagger
 * /api/subscriptions/{id}:
 *   get:
 *     summary: Get subscription details
 *     description: Returns subscription details with event history.
 *     tags:
 *       - Billing
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription with events
 *       404:
 *         description: Subscription not found
 *   patch:
 *     summary: Update subscription
 *     description: Change plan or update subscription settings.
 *     tags:
 *       - Billing
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription updated
 *   delete:
 *     summary: Cancel subscription
 *     description: Cancel an active subscription.
 *     tags:
 *       - Billing
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { cancelSubscription, changePlan } from '$lib/services/billing/subscriptions';
import { getSubscriptionById, getSubscriptionEvents } from '$lib/db/repositories/subscriptions';
import type { SubscriptionPlan } from '$lib/types/subscriptions';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-subscriptions-id');

const VALID_PLANS: SubscriptionPlan[] = ['starter', 'pro', 'enterprise'];

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	try {
		const db = createDbClient(platform.env.DB);
		const sub = await getSubscriptionById(db, params.id);
		if (!sub) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}

		// Lane C ownership: owner or admin only.
		requireResourceOwner(actor, sub.ownerId ?? '', { log, fn: 'GET' });

		const events = await getSubscriptionEvents(db, params.id);
		return json({ subscription: sub, events });
	} catch (err) {
		log.error('GET', 'Failed to get subscription', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'PATCH' });

	let body: { action?: string; plan?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.action || !['change_plan', 'cancel'].includes(body.action)) {
		return json({ error: 'action must be "change_plan" or "cancel"' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);

		// Enforce ownership on the target subscription before mutating it.
		const sub = await getSubscriptionById(db, params.id);
		if (!sub) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}
		requireResourceOwner(actor, sub.ownerId ?? '', { log, fn: 'PATCH' });

		if (body.action === 'cancel') {
			await cancelSubscription(db, params.id);
			return json({ ok: true, status: 'cancelled' });
		}

		// change_plan
		if (!body.plan || !VALID_PLANS.includes(body.plan as SubscriptionPlan)) {
			return json({ error: `plan must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
		}

		const result = await changePlan(db, params.id, body.plan as SubscriptionPlan);
		return json({
			ok: true,
			subscription: result.subscription,
			direction: result.direction,
			net_charge_np: result.creditOrCharge
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('PATCH', 'Failed to update subscription', { error: message });

		if (message.includes('not found')) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}
		if (message.includes('already cancelled')) {
			return json({ error: message }, { status: 409 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'DELETE' });

	try {
		const db = createDbClient(platform.env.DB);

		const sub = await getSubscriptionById(db, params.id);
		if (!sub) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}
		requireResourceOwner(actor, sub.ownerId ?? '', { log, fn: 'DELETE' });

		await cancelSubscription(db, params.id);
		return json({ ok: true, status: 'cancelled' });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('DELETE', 'Failed to cancel subscription', { error: message });

		if (message.includes('not found')) {
			return json({ error: 'Subscription not found' }, { status: 404 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
