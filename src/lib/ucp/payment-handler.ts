/**
 * UCP Payment Handler Adapter — Phase 5, D1
 *
 * Bridges UCP checkout payment flow to the existing x402-NP auditor infrastructure.
 * Maps UCP payment submission fields to the auditor's submitTransaction() interface.
 *
 * @see AGENT_ALPHA_SPRINT_PLAN.md Task 6
 */

import type { Env } from '$lib/types';
import type { DbClient } from '$lib/db/client';
import type { UcpCheckoutSessionRecord } from '$lib/db/schema';
import type { UcpPaymentSubmission } from '$lib/types/ucp';
import { submitTransaction } from '$lib/services/auditor/service';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { createLogger } from '$lib/utils/logger';

export interface UcpPaymentResult {
	success: boolean;
	error?: string;
	settlement_id?: string;
}

/**
 * Handle a UCP payment submission by delegating to the x402-NP auditor.
 *
 * Maps UCP payment fields to auditor fields:
 * - UCP `tx_id` → auditor `txHash`
 * - UCP `agent` → auditor `from` (payer)
 * - Service payee → auditor `to` (derived from env or default)
 * - UCP `amount` → auditor `amount`
 * - UCP `signature` → auditor `sig`
 *
 * @param session - The checkout session record from D1
 * @param payment - The payment submission from the client
 * @param db - Drizzle database client
 * @param env - Worker environment bindings
 * @returns Payment result with success flag and optional settlement ID
 */
export async function handleUcpPayment(
	session: UcpCheckoutSessionRecord,
	payment: UcpPaymentSubmission,
	db: DbClient,
	env: Env
): Promise<UcpPaymentResult> {
	const log = createLogger(env, 'ucp-payment');

	// Validate payment method
	if (payment.method !== 'x402-np') {
		return { success: false, error: `Unsupported payment method: ${payment.method}` };
	}

	// Validate amount matches session total
	const totals = JSON.parse(session.totals);
	if (payment.amount !== totals.total) {
		return {
			success: false,
			error: `Payment amount ${payment.amount} does not match session total ${totals.total}`
		};
	}

	// Resolve the HMAC secret for auditor verification
	const radiusSecret = await resolveSecret(
		env.KYM_NANDA_RADIUS_SECRET,
		kvFallback(env, SECRET_KEYS.RADIUS_SECRET)
	);
	if (!radiusSecret) {
		log.error('handleUcpPayment', 'KYM_NANDA_RADIUS_SECRET not configured');
		return { success: false, error: 'Payment verification service unavailable' };
	}

	const payee = env.PAYMENT_PAYEE!;
	const ts = Math.floor(Date.now() / 1000);

	try {
		const result = await submitTransaction(
			db,
			payment.tx_id,
			payment.agent,
			payee,
			payment.amount,
			ts,
			payment.signature,
			radiusSecret,
			env
		);

		if (result.verified) {
			log.info('handleUcpPayment', 'Payment verified', {
				sessionId: session.id,
				settlementId: result.settlement_id
			});
			return {
				success: true,
				settlement_id: result.settlement_id
			};
		} else {
			log.warn('handleUcpPayment', 'Payment signature not verified', {
				sessionId: session.id
			});
			return {
				success: false,
				error: 'Payment signature verification failed'
			};
		}
	} catch (err) {
		log.error('handleUcpPayment', 'Payment processing error', {
			error: err instanceof Error ? err.message : String(err),
			sessionId: session.id
		});
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Payment processing failed'
		};
	}
}
