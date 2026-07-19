/**
 * UCP Checkout Session by ID
 * PATCH  /api/ucp/checkout-sessions/[id] — Update session (submit payment)
 * DELETE /api/ucp/checkout-sessions/[id] — Cancel session
 *
 * @see AGENT_ALPHA_SPRINT_PLAN.md Task 5
 
 * @swagger
 * /api/ucp/checkout-sessions/{id}:
 *   patch:
 *     summary: Submit payment
 *     description: Submit payment information for a checkout session.
 *     tags:
 *       - UCP
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment submitted
 *       400:
 *         description: Invalid payment
 *       404:
 *         description: Session not found
 *   delete:
 *     summary: Cancel checkout session
 *     description: Cancel an active checkout session.
 *     tags:
 *       - UCP
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session cancelled
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { UpdateCheckoutPaymentRequest, UcpPaymentInfo } from '$lib/types/ucp';
import { createDbClient } from '$lib/db/client';
import { ucpCheckoutSessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';
import { handleUcpPayment } from '$lib/ucp/payment-handler';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json(
			{ error: 'Service unavailable: platform bindings not configured' },
			{ status: 503 }
		);
	}
	const env = platform.env;
	const log = createLogger(env, 'ucp-checkout');
	const db = createDbClient(env.DB);
	const { id } = params;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'PATCH' });

	let body: UpdateCheckoutPaymentRequest;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.payment) {
		return json({ error: 'Missing payment object' }, { status: 400 });
	}

	try {
		// Fetch session
		const rows = await db
			.select()
			.from(ucpCheckoutSessions)
			.where(eq(ucpCheckoutSessions.id, id))
			.limit(1);

		if (rows.length === 0) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const session = rows[0];

		// Lane C ownership: owner or admin only.
		requireResourceOwner(actor, session.ownerId ?? '', { log, fn: 'PATCH' });

		// Only open or pending_payment sessions can accept payment
		if (session.status !== 'open' && session.status !== 'pending_payment') {
			return json(
				{ error: `Cannot update session with status: ${session.status}` },
				{ status: 409 }
			);
		}

		// Check expiry
		const now = Math.floor(Date.now() / 1000);
		if (session.expiresAt && now > session.expiresAt) {
			await db
				.update(ucpCheckoutSessions)
				.set({ status: 'expired', updatedAt: now })
				.where(eq(ucpCheckoutSessions.id, id));
			return json({ error: 'Session has expired' }, { status: 410 });
		}

		// Process payment via handler
		const result = await handleUcpPayment(session, body.payment, db, env);

		if (result.success) {
			const paymentInfo: UcpPaymentInfo = {
				method: body.payment.method,
				status: 'completed',
				provider_ref: result.settlement_id ?? null,
				amount: body.payment.amount,
				currency: 'NP'
			};

			await db
				.update(ucpCheckoutSessions)
				.set({
					status: 'completed',
					payment: JSON.stringify(paymentInfo),
					updatedAt: now
				})
				.where(eq(ucpCheckoutSessions.id, id));

			log.info('PATCH', 'Checkout session completed', { sessionId: id });
			return json({
				id,
				status: 'completed',
				payment: paymentInfo,
				settlement_id: result.settlement_id
			});
		} else {
			// Payment failed — mark as pending_payment
			await db
				.update(ucpCheckoutSessions)
				.set({ status: 'pending_payment', updatedAt: now })
				.where(eq(ucpCheckoutSessions.id, id));

			log.warn('PATCH', 'Payment failed for checkout session', {
				sessionId: id,
				error: result.error
			});
			return json(
				{ error: result.error ?? 'Payment verification failed', status: 'pending_payment' },
				{ status: 402 }
			);
		}
	} catch (err) {
		log.error('PATCH', 'Failed to update checkout session', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json(
			{ error: 'Service unavailable: platform bindings not configured' },
			{ status: 503 }
		);
	}
	const env = platform.env;
	const log = createLogger(env, 'ucp-checkout');
	const db = createDbClient(env.DB);
	const { id } = params;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'DELETE' });

	try {
		const rows = await db
			.select()
			.from(ucpCheckoutSessions)
			.where(eq(ucpCheckoutSessions.id, id))
			.limit(1);

		if (rows.length === 0) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const session = rows[0];

		// Lane C ownership: owner or admin only.
		requireResourceOwner(actor, session.ownerId ?? '', { log, fn: 'DELETE' });

		if (session.status === 'completed' || session.status === 'paid') {
			return json(
				{ error: `Cannot cancel session with status: ${session.status}` },
				{ status: 409 }
			);
		}

		const now = Math.floor(Date.now() / 1000);
		await db
			.update(ucpCheckoutSessions)
			.set({ status: 'cancelled', updatedAt: now })
			.where(eq(ucpCheckoutSessions.id, id));

		log.info('DELETE', 'Checkout session cancelled', { sessionId: id });
		return json({ id, status: 'cancelled' });
	} catch (err) {
		log.error('DELETE', 'Failed to cancel checkout session', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
