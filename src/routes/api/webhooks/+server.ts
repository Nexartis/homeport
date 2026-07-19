/**
 * GET  /api/webhooks — List webhook subscriptions owned by the caller
 * POST /api/webhooks — Create a new webhook subscription for the caller
 *
 * Phase 4 — Agent Beta. Auth Lane C: accepts session OR API key. Lists and
 * mutations are always scoped to the caller's owner id; admins see all.
 *
 * @swagger
 * /api/webhooks:
 *   get:
 *     summary: List webhook subscriptions
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: List of subscriptions
 *       401:
 *         description: Authentication required
 *       503:
 *         description: Database unavailable
 *   post:
 *     summary: Create a webhook subscription
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - SessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callback_url
 *               - events
 *             properties:
 *               callback_url:
 *                 type: string
 *                 format: uri
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Subscription created (includes secret — show only once)
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Authentication required
 *       503:
 *         description: Database unavailable
 */

import { isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { createSubscription, listSubscriptions } from '$lib/services/webhooks/service';
import { listWebhookSubscriptions } from '$lib/db/repositories/webhooks';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, type AuthActor } from '$lib/server/auth-lanes';
import { isAdmin } from '$lib/server/roles';

const log = createLogger(undefined, 'api-webhooks');

const VALID_EVENTS = [
	'registered',
	'deprecated',
	'tombstoned',
	'degraded',
	'revoked',
	'version_created'
];

/** Derive the owner id for a non-anonymous actor. */
function actorOwnerId(actor: Exclude<AuthActor, { kind: 'anonymous' }>): string {
	return actor.kind === 'apikey' ? actor.ownerId : actor.user.id;
}

export const GET: RequestHandler = async ({ platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const ownerId = actorOwnerId(actor);
	const adminSession = actor.kind === 'session' && isAdmin(actor.user);

	if (!ownerId && !adminSession) {
		// Non-admin authenticated actor without a resolvable owner id is an
		// internal state error (the bearer path should always populate one).
		log.error('GET', 'Missing owner id for authenticated actor', { actorKind: actor.kind });
		return json({ error: 'Internal server error' }, { status: 500 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		// Admin sessions see every subscription (plan §5 GAMMA); all other
		// actors are scoped to their own owner id.
		const subscriptions = adminSession
			? await listWebhookSubscriptions(db)
			: await listSubscriptions(db, ownerId);

		// Strip secrets from list response
		const safe = subscriptions.map(({ secret: _secret, ...rest }) => rest);
		return json({ subscriptions: safe });
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('GET', 'Failed to list subscriptions', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let body: { callback_url?: string; events?: string[] };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.callback_url || typeof body.callback_url !== 'string') {
		return json({ error: 'callback_url is required and must be a string' }, { status: 400 });
	}
	if (!Array.isArray(body.events) || body.events.length === 0) {
		return json({ error: 'events must be a non-empty array of event types' }, { status: 400 });
	}

	const invalidEvents = body.events.filter((e) => !VALID_EVENTS.includes(e));
	if (invalidEvents.length > 0) {
		return json(
			{
				error: `Invalid event types: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`
			},
			{ status: 400 }
		);
	}

	const ownerId = actorOwnerId(actor);
	if (!ownerId) {
		// Creation requires a concrete owner id for the new row. Treat the
		// missing-identity case as a server-side failure rather than auth.
		log.error('POST', 'Missing owner id for authenticated actor', { actorKind: actor.kind });
		return json({ error: 'Internal server error' }, { status: 500 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const result = await createSubscription(db, {
			callbackUrl: body.callback_url,
			events: body.events,
			ownerId
		});

		// Return secret only on creation — caller must store it
		return json(
			{
				id: result.id,
				secret: result.secret,
				callback_url: body.callback_url,
				events: body.events,
				status: 'active',
				message: 'Store the secret securely — it will not be shown again.'
			},
			{ status: 201 }
		);
	} catch (err) {
		if (isHttpError(err)) throw err;
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to create subscription', { error: errMsg });
		if (errMsg.includes('Invalid callback URL')) {
			return json({ error: errMsg }, { status: 400 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
