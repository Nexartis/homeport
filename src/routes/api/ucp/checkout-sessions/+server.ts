/**
 * UCP Checkout Sessions API
 * POST /api/ucp/checkout-sessions — Create a new checkout session
 * GET  /api/ucp/checkout-sessions?id={id} — Get session by ID
 *
 * @see AGENT_ALPHA_SPRINT_PLAN.md Task 5
 
 * @swagger
 * /api/ucp/checkout-sessions:
 *   post:
 *     summary: Create checkout session
 *     description: Create a new UCP checkout session for agent-to-agent payments.
 *     tags:
 *       - UCP
 *     responses:
 *       201:
 *         description: Checkout session created
 *   get:
 *     summary: Get checkout session
 *     description: Retrieve a checkout session by ID.
 *     tags:
 *       - UCP
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkout session details
 *       404:
 *         description: Session not found
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type {
	CreateCheckoutRequest,
	UcpCheckoutLineItem,
	UcpCheckoutTotals,
	UcpCheckoutStatus
} from '$lib/types/ucp';
import { getCapabilityById, getCapabilityIds } from '$lib/ucp/schemas';
import { createDbClient } from '$lib/db/client';
import { ucpCheckoutSessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseJsonBody, requireDb } from '$lib/utils/request-helpers';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

/** Default session TTL: 30 minutes */
const SESSION_TTL_SEC = 30 * 60;

/** Resolve the caller's ownership principal (Sentinel user id). */
function actorOwnerId(actor: Exclude<ReturnType<typeof getActor>, { kind: 'anonymous' }>): string {
	return actor.kind === 'apikey' ? actor.ownerId : actor.user.id;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const env = platform!.env;
	const log = createLogger(env, 'api-ucp');
	const db = createDbClient(env.DB);

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const [body, parseErr] = await parseJsonBody<CreateCheckoutRequest>(request);
	if (parseErr) return parseErr;

	if (!body.capabilities || !Array.isArray(body.capabilities) || body.capabilities.length === 0) {
		return json({ error: 'capabilities must be a non-empty array' }, { status: 400 });
	}

	// Validate capability IDs
	const validIds = getCapabilityIds();
	for (const item of body.capabilities) {
		if (!item.id || !validIds.has(item.id)) {
			return json({ error: `Unknown capability ID: ${item.id}` }, { status: 400 });
		}
		if (!item.quantity || item.quantity < 1) {
			return json({ error: `Invalid quantity for ${item.id}` }, { status: 400 });
		}
	}

	// Build line items and compute totals
	const lineItems: UcpCheckoutLineItem[] = body.capabilities.map((req) => {
		const cap = getCapabilityById(req.id)!;
		return {
			capability_id: cap.id,
			quantity: req.quantity,
			unit_price: cap.price.amount,
			total: cap.price.amount * req.quantity
		};
	});

	const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
	const totals: UcpCheckoutTotals = {
		subtotal,
		discount: 0,
		tax: 0,
		total: subtotal,
		currency: 'NP'
	};

	const now = Math.floor(Date.now() / 1000);
	const sessionId = crypto.randomUUID();
	const ownerId = actorOwnerId(actor);

	try {
		await db.insert(ucpCheckoutSessions).values({
			id: sessionId,
			status: 'open',
			clientAgentId: body.client_agent_id ?? null,
			ownerId,
			lineItems: JSON.stringify(lineItems),
			totals: JSON.stringify(totals),
			payment: null,
			metadata: null,
			expiresAt: now + SESSION_TTL_SEC
		});

		const session = {
			id: sessionId,
			status: 'open' as UcpCheckoutStatus,
			client_agent_id: body.client_agent_id ?? null,
			line_items: lineItems,
			totals,
			payment: null,
			metadata: null,
			created_at: now,
			updated_at: now,
			expires_at: now + SESSION_TTL_SEC
		};

		log.info('POST', 'Checkout session created', { sessionId, total: totals.total, ownerId });
		return json(session, { status: 201 });
	} catch (err) {
		log.error('POST', 'Failed to create checkout session', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const env = platform!.env;
	const log = createLogger(env, 'ucp-checkout');
	const db = createDbClient(env.DB);

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'Missing required query parameter: id' }, { status: 400 });
	}

	try {
		const row = await db
			.select()
			.from(ucpCheckoutSessions)
			.where(eq(ucpCheckoutSessions.id, id))
			.limit(1);

		if (row.length === 0) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const r = row[0];

		// Lane C ownership: owner or admin only.
		requireResourceOwner(actor, r.ownerId ?? '', { log, fn: 'GET' });

		return json({
			id: r.id,
			status: r.status,
			client_agent_id: r.clientAgentId,
			line_items: JSON.parse(r.lineItems),
			totals: JSON.parse(r.totals),
			payment: r.payment ? JSON.parse(r.payment) : null,
			metadata: r.metadata ? JSON.parse(r.metadata) : null,
			created_at: r.createdAt,
			updated_at: r.updatedAt,
			expires_at: r.expiresAt
		});
	} catch (err) {
		log.error('GET', 'Failed to get checkout session', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
