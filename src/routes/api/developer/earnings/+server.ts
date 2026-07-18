/**
 * GET  /api/developer/earnings                   — Developer earnings for the caller
 * POST /api/developer/earnings                   — Actions: settle, register-split
 *
 * Phase 5 — Agent Bravo. Auth Lane B: session-only (dashboard endpoint).
 *
 * Authorization:
 *  - GET / POST require a Sentinel session (no API key path).
 *  - Non-admin callers are always scoped to their own developer id. Any
 *    `developerId` query param or body value is ignored unless the caller has
 *    the `admin` role, in which case it may be used for support lookups.
 *
 * @swagger
 * /api/developer/earnings:
 *   get:
 *     summary: Developer earnings
 *     description: Returns earnings summary for the authenticated developer. Admins may pass `developerId` to inspect another user.
 *     tags:
 *       - Billing
 *     security:
 *       - SessionAuth: []
 *     parameters:
 *       - in: query
 *         name: developerId
 *         required: false
 *         schema:
 *           type: string
 *         description: Admin-only override to look up another developer.
 *     responses:
 *       200:
 *         description: Earnings summary
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Session required / cross-tenant access denied
 *   post:
 *     summary: Settle or register split
 *     description: Settle pending earnings or register a new revenue split.
 *     tags:
 *       - Billing
 *     security:
 *       - SessionAuth: []
 *     responses:
 *       200:
 *         description: Action result
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Session required / cross-tenant access denied
 */

import { isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import {
	getDeveloperEarnings,
	registerSplit,
	computeSharesForPeriod
} from '$lib/services/billing/revenue-share';
import { settleDeveloper, getSettlementHistory } from '$lib/services/billing/settlement';
import { createLogger } from '$lib/utils/logger';
import {
	getActor,
	requireAdminRole,
	requireDeveloperSession,
	requireSelfOrAdmin,
	type AuthActor
} from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-developer-earnings');

/** Resolve the target developer id, enforcing self-or-admin scoping. */
function resolveDeveloperId(
	actor: Extract<AuthActor, { kind: 'session' }>,
	requested: string | null | undefined,
	fn: string
): string {
	const target = requested?.trim() || actor.user.id;
	requireSelfOrAdmin(actor, target, { log, fn });
	return target;
}

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireDeveloperSession(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const developerId = resolveDeveloperId(actor, url.searchParams.get('developerId'), 'GET');
	const db = createDbClient(platform.env.DB);
	const view = url.searchParams.get('view');

	try {
		if (view === 'settlements') {
			const history = await getSettlementHistory(db, developerId);
			return json(history);
		}

		// Default: earnings summary
		const earnings = await getDeveloperEarnings(db, developerId);
		return json(earnings);
	} catch (err) {
		log.error('GET', 'Earnings query failed', {
			developerId,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireDeveloperSession(actor, { log, fn: 'POST' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let body: {
		action?: string;
		developerId?: string;
		agentId?: string;
		splitPct?: number;
		periodId?: string;
	};
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const db = createDbClient(platform.env.DB);

	try {
		switch (body.action) {
			case 'register-split': {
				if (!body.agentId || !body.developerId) {
					return json({ error: 'agentId and developerId are required' }, { status: 400 });
				}
				// Registering a split for another developer is an admin-only op.
				requireSelfOrAdmin(actor, body.developerId, { log, fn: 'POST:register-split' });
				const splitId = await registerSplit(db, body.agentId, body.developerId, body.splitPct);
				return json({ ok: true, splitId });
			}

			case 'compute-shares': {
				if (!body.periodId || !body.agentId) {
					return json({ error: 'periodId and agentId are required' }, { status: 400 });
				}
				// compute-shares is admin-only: we don't have an ownership
				// lookup for (agentId, periodId) here, and this endpoint
				// mutates payout state (revenue_shares rows that later
				// settleDeveloper() sums). Match the requireSelfOrAdmin
				// discipline used by sibling actions by gating to admin.
				requireAdminRole(actor, { log, fn: 'POST:compute-shares' });
				const result = await computeSharesForPeriod(db, body.periodId, body.agentId);
				return json({ ok: true, ...result });
			}

			case 'settle': {
				const target = body.developerId?.trim() || actor.user.id;
				requireSelfOrAdmin(actor, target, { log, fn: 'POST:settle' });
				const settlement = await settleDeveloper(db, target);
				if (!settlement) {
					return json({ ok: false, message: 'No pending shares to settle' }, { status: 200 });
				}
				return json({ ok: true, ...settlement });
			}

			default:
				return json(
					{
						error: `Unknown action: ${body.action}. Supported: register-split, compute-shares, settle`
					},
					{ status: 400 }
				);
		}
	} catch (err) {
		// Preserve SvelteKit auth/ownership errors; only swallow genuine
		// service failures into a generic 500.
		if (isHttpError(err)) throw err;
		log.error('POST', 'Earnings action failed', {
			action: body.action,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
