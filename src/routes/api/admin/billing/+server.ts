/**
 * GET  /api/admin/billing?keyId={id}            — Billing summary for a key
 * GET  /api/admin/billing?keyId={id}&periods=true — List billing periods
 * POST /api/admin/billing                        — Manually close a billing period
 *
 * Phase 5 — Agent Bravo
 *
 * Authorization (Lane A/C hybrid):
 *   GET  — admin session OR apikey scoped to its own `ownerId` via `keyId`.
 *   POST — admin session only. Closing periods is an administrative action
 *          not exposed to holders of API keys (cross-tenant risk).

 * @swagger
 * /api/admin/billing:
 *   get:
 *     summary: Billing summary
 *     description: Billing summary or period listing for an API key.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: periods
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Billing data
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getBillingSummary, closePeriod } from '$lib/services/billing/service';
import { getUsageSummary } from '$lib/services/billing/metering';
import { getDevApiKeyById } from '$lib/db/repositories';
import {
	getActor,
	requireAdminRole,
	requireApiKeyOrAdmin,
	requireResourceOwner
} from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-billing');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireApiKeyOrAdmin(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const keyId = url.searchParams.get('keyId')?.trim();
	if (!keyId) {
		return json({ error: 'keyId query parameter is required' }, { status: 400 });
	}

	const db = createDbClient(platform.env.DB);

	const targetKey = await getDevApiKeyById(db, keyId);
	if (!targetKey) throw error(404, 'not_found');
	requireResourceOwner(actor as Exclude<typeof actor, { kind: 'anonymous' }>, targetKey.ownerId, {
		log,
		fn: 'GET'
	});

	const includePeriods = url.searchParams.get('periods') === 'true';

	try {
		if (includePeriods) {
			const summary = await getBillingSummary(db, keyId, true);
			return json(summary);
		}

		// Default: current usage summary
		const usage = await getUsageSummary(db, keyId);
		if (!usage) {
			return json({
				keyId,
				message: 'No active billing period found',
				current: null
			});
		}
		return json(usage);
	} catch (err) {
		log.error('GET', 'Billing query failed', {
			keyId,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'POST' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let body: { action?: string; periodId?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (body.action !== 'close-period') {
		return json(
			{ error: `Unknown action: ${body.action}. Supported: close-period` },
			{ status: 400 }
		);
	}

	if (!body.periodId || typeof body.periodId !== 'string') {
		return json({ error: 'periodId is required and must be a string' }, { status: 400 });
	}

	const db = createDbClient(platform.env.DB);

	try {
		const result = await closePeriod(db, body.periodId);
		if (!result.closed) {
			return json(
				{ error: 'Period could not be closed (not found or already closed)' },
				{ status: 404 }
			);
		}
		return json({ ok: true, periodId: body.periodId, message: 'Period closed successfully' });
	} catch (err) {
		log.error('POST', 'Close period failed', {
			periodId: body.periodId,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
