/**
 * POST /api/subscriptions — Create a new subscription
 * GET  /api/subscriptions?keyId={id} — Get active subscription for a key
 *
 * Phase 5 — Agent Charlie (D6)
 *
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Get active subscription
 *     description: Returns the active subscription for a given API key.
 *     tags:
 *       - Billing
 *     parameters:
 *       - in: query
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active subscription
 *       404:
 *         description: No active subscription
 *   post:
 *     summary: Create subscription
 *     description: Create a new subscription with plan, billing cycle, and currency.
 *     tags:
 *       - Billing
 *     responses:
 *       201:
 *         description: Subscription created
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { subscribe, getSubscriptionStatus } from '$lib/services/billing/subscriptions';
import { getActiveSubscription } from '$lib/db/repositories/subscriptions';
import { getDevApiKeyById } from '$lib/db/repositories/developer-keys';
import { PLAN_CONFIGS } from '$lib/types/subscriptions';
import type { SubscriptionPlan } from '$lib/types/subscriptions';
import { parseJsonBody, requireDb } from '$lib/utils/request-helpers';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-subscriptions');

const VALID_PLANS: SubscriptionPlan[] = ['starter', 'pro', 'enterprise'];

/** Resolve the caller's ownership principal (Sentinel user id). */
function actorOwnerId(actor: Exclude<ReturnType<typeof getActor>, { kind: 'anonymous' }>): string {
	return actor.kind === 'apikey' ? actor.ownerId : actor.user.id;
}

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const keyId = url.searchParams.get('keyId');
	if (!keyId) {
		return json({ error: 'keyId query parameter is required' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);

		// Caller must own the developer key they are querying; prevents probing
		// subscription existence on other tenants' keys.
		const key = await getDevApiKeyById(db, keyId);
		if (!key) {
			return json({ error: 'Key not found' }, { status: 404 });
		}
		requireResourceOwner(actor, key.ownerId, { log, fn: 'GET' });

		// Load raw record to enforce ownership before returning service payload.
		const raw = await getActiveSubscription(db, keyId);
		if (raw) {
			requireResourceOwner(actor, raw.ownerId ?? '', { log, fn: 'GET' });
		}

		const result = await getSubscriptionStatus(db, keyId);

		return json({
			subscription: result.subscription,
			plan: result.plan,
			plans: PLAN_CONFIGS
		});
	} catch (err) {
		log.error('GET', 'Failed to get subscription status', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const [body, parseErr] = await parseJsonBody<{ key_id?: string; plan?: string }>(request);
	if (parseErr) return parseErr;

	if (!body.key_id || typeof body.key_id !== 'string') {
		return json({ error: 'key_id is required and must be a string' }, { status: 400 });
	}
	if (!body.plan || !VALID_PLANS.includes(body.plan as SubscriptionPlan)) {
		return json({ error: `plan must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);

		// Caller must own the developer key being subscribed. Without this check
		// any authenticated tenant could drain another tenant's wallet by passing
		// their key_id, since subscribe() debits `keyId`'s wallet.
		const key = await getDevApiKeyById(db, body.key_id);
		if (!key) {
			return json({ error: 'Key not found' }, { status: 404 });
		}
		requireResourceOwner(actor, key.ownerId, { log, fn: 'POST' });

		const result = await subscribe(
			db,
			body.key_id,
			body.plan as SubscriptionPlan,
			platform!.env as import('$lib/types').Env,
			actorOwnerId(actor)
		);

		return json(
			{
				status: 'created',
				subscription: result.subscription,
				charged_np: result.charged
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to create subscription', { error: message });

		if (message.includes('already exists')) {
			return json({ error: message }, { status: 409 });
		}
		if (message.includes('Insufficient NP')) {
			return json({ error: message }, { status: 402 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
