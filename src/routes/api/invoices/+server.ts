/**
 * POST /api/invoices — Generate a new invoice
 * GET  /api/invoices?keyId={id} — List invoices for a key
 *
 * Phase 5 — Agent Charlie (D7). Auth Lane C: accepts session OR API key.
 * Ownership is derived by resolving the target developer key's owner.
 *
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: List invoices
 *     description: Returns invoices for a given API key owned by the caller.
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - SessionAuth: []
 *     parameters:
 *       - in: query
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of invoices
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the key owner
 *   post:
 *     summary: Generate invoice
 *     description: Generate a new invoice for a billing period.
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - SessionAuth: []
 *     responses:
 *       201:
 *         description: Invoice generated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the key owner
 */

import { isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getDevApiKeyById } from '$lib/db/repositories/developer-keys';
import { generateInvoice, listInvoicesForKey } from '$lib/services/billing/invoices';
import { parseJsonBody, requireDb } from '$lib/utils/request-helpers';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-invoices');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const keyId = url.searchParams.get('keyId');
	if (!keyId) {
		return json({ error: 'keyId query parameter is required' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);

		// Enforce ownership: only the key's owner (or an admin) may list.
		const devKey = await getDevApiKeyById(db, keyId);
		if (!devKey) {
			return json({ error: 'Key not found' }, { status: 404 });
		}
		requireResourceOwner(actor, devKey.ownerId, { log, fn: 'GET' });

		const invoiceList = await listInvoicesForKey(db, keyId);

		// Parse line_items JSON for each invoice
		const result = invoiceList.map((inv) => ({
			...inv,
			lineItems: JSON.parse(inv.lineItems || '[]')
		}));

		return json({ invoices: result });
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('GET', 'Failed to list invoices', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const [body, parseErr] = await parseJsonBody<{
		key_id?: string;
		period_id?: string;
		subscription_id?: string;
		line_items?: Array<{
			description: string;
			quantity: number;
			unit_price_np: number;
			total_np: number;
		}>;
		overage_call_count?: number;
	}>(request);
	if (parseErr) return parseErr;

	if (!body.key_id || typeof body.key_id !== 'string') {
		return json({ error: 'key_id is required and must be a string' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);

		// Ownership: caller must own the target key (or be an admin session).
		const devKey = await getDevApiKeyById(db, body.key_id);
		if (!devKey) {
			return json({ error: 'Key not found' }, { status: 404 });
		}
		requireResourceOwner(actor, devKey.ownerId, { log, fn: 'POST' });

		// Map snake_case to camelCase for line items
		const lineItems = body.line_items?.map((item) => ({
			description: item.description,
			quantity: item.quantity,
			unitPriceNp: item.unit_price_np,
			totalNp: item.total_np
		}));

		const result = await generateInvoice(
			db,
			{
				keyId: body.key_id,
				periodId: body.period_id,
				subscriptionId: body.subscription_id,
				lineItems,
				overageCallCount: body.overage_call_count
			},
			platform!.env as import('$lib/types').Env
		);

		return json(
			{
				status: 'created',
				invoice: result
			},
			{ status: 201 }
		);
	} catch (err) {
		if (isHttpError(err)) throw err;
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to generate invoice', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
