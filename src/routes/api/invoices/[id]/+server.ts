/**
 * GET   /api/invoices/[id] — Get invoice details
 * PATCH /api/invoices/[id] — Update invoice status (issue, void)
 *
 * Phase 5 — Agent Charlie (D7). Auth Lane C: accepts session OR API key.
 * Ownership is derived by resolving the invoice's key → owner.
 *
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice details
 *     description: Returns invoice details by ID. Caller must own the invoice's key, or be an admin.
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - SessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the owner of the invoice
 *       404:
 *         description: Invoice not found
 *   patch:
 *     summary: Update invoice status
 *     description: Issue or void an invoice. Caller must own the invoice's key, or be an admin.
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - SessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice updated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not the owner of the invoice
 *       404:
 *         description: Invoice not found
 *       409:
 *         description: Invoice already in requested state
 */

import { isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getInvoiceById, updateInvoiceStatus } from '$lib/db/repositories/invoices';
import { getDevApiKeyById } from '$lib/db/repositories/developer-keys';
import { issueInvoice } from '$lib/services/billing/invoices';
import { createLogger } from '$lib/utils/logger';
import {
	getActor,
	requireAuthenticated,
	requireResourceOwner,
	type AuthActor
} from '$lib/server/auth-lanes';
import type { DbClient } from '$lib/db/client';

const log = createLogger(undefined, 'api-invoices-id');

/**
 * Enforce invoice ownership for a non-anonymous actor. Invoices carry a
 * `keyId`; we resolve that key's owner and delegate to requireResourceOwner.
 * Returns the resolved owner id, or null if the key is missing (caller should
 * treat that as a 404 on the invoice).
 */
async function enforceInvoiceOwner(
	db: DbClient,
	actor: Exclude<AuthActor, { kind: 'anonymous' }>,
	invoiceKeyId: string,
	fn: string
): Promise<string | null> {
	const devKey = await getDevApiKeyById(db, invoiceKeyId);
	if (!devKey) return null;
	requireResourceOwner(actor, devKey.ownerId, { log, fn });
	return devKey.ownerId;
}

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const inv = await getInvoiceById(db, params.id);
		if (!inv) {
			return json({ error: 'Invoice not found' }, { status: 404 });
		}

		const owner = await enforceInvoiceOwner(db, actor, inv.keyId, 'GET');
		if (!owner) {
			return json({ error: 'Invoice not found' }, { status: 404 });
		}

		return json({
			invoice: {
				...inv,
				lineItems: JSON.parse(inv.lineItems || '[]')
			}
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('GET', 'Failed to get invoice', {
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

	if (!body.action || !['issue', 'void'].includes(body.action)) {
		return json({ error: 'action must be "issue" or "void"' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);

		// Load the invoice first so we can enforce ownership regardless of
		// which sub-action (issue / void) was requested.
		const inv = await getInvoiceById(db, params.id);
		if (!inv) {
			return json({ error: 'Invoice not found' }, { status: 404 });
		}

		const owner = await enforceInvoiceOwner(db, actor, inv.keyId, 'PATCH');
		if (!owner) {
			return json({ error: 'Invoice not found' }, { status: 404 });
		}

		if (body.action === 'issue') {
			await issueInvoice(db, params.id);
			return json({ ok: true, status: 'issued' });
		}

		if (body.action === 'void') {
			await updateInvoiceStatus(db, params.id, 'void');
			return json({ ok: true, status: 'void' });
		}

		return json({ error: 'Unknown action' }, { status: 400 });
	} catch (err) {
		if (isHttpError(err)) throw err;
		const message = err instanceof Error ? err.message : String(err);
		log.error('PATCH', 'Failed to update invoice', { error: message });

		if (message.includes('not found')) {
			return json({ error: 'Invoice not found' }, { status: 404 });
		}
		if (message.includes('already')) {
			return json({ error: message }, { status: 409 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
