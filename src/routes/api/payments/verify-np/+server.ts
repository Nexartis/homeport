/**
 * POST /api/payments/verify-np
 *
 * REST endpoint for remote NP payment verification.
 * Called by knowyourmodel-ai to verify x402-NP payments without
 * duplicating HMAC logic or accessing the shared secret directly.
 *
 * Accepts NP payment details, delegates to the auditor's submitTransaction(),
 * and returns a clean JSON response.
 *
 * @swagger
 * /api/payments/verify-np:
 *   post:
 *     summary: Verify NP payment
 *     description: Verifies an HMAC-signed NP (Nanda Points) payment by delegating to the auditor's submitTransaction.
 *     tags:
 *       - Payments
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agent
 *               - tx_id
 *               - amount
 *               - timestamp
 *               - signature
 *             properties:
 *               agent:
 *                 type: string
 *                 description: Payer agent ID
 *               tx_id:
 *                 type: string
 *                 description: Transaction ID
 *               amount:
 *                 type: number
 *                 description: Amount in NP
 *               timestamp:
 *                 type: integer
 *                 description: Unix timestamp
 *               signature:
 *                 type: string
 *                 description: HMAC-SHA256 signature
 *               payee:
 *                 type: string
 *                 description: Recipient agent ID (optional)
 *     responses:
 *       200:
 *         description: Payment verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                 settlement_id:
 *                   type: string
 *                 recon:
 *                   type: object
 *                   nullable: true
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
import type { RequestHandler } from './$types';
import { submitTransaction } from '$lib/services/auditor/service';
import { creditWallet, debitWallet } from '$lib/services/payment/multi-wallet';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { json } from '@sveltejs/kit';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { markPublic } from '$lib/server/auth-lanes';
import type { Env } from '$lib/types';

const log = createLogger(undefined, 'verify-np');

interface VerifyNpRequest {
	agent: string; // Payer agent ID (X-PAYMENT-AGENT)
	tx_id: string; // Transaction ID (X-PAYMENT-TX-ID)
	amount: number; // Amount in NP (X-PAYMENT-AMOUNT)
	timestamp: number; // Unix timestamp
	signature: string; // HMAC-SHA256 signature (X-PAYMENT-SIG)
	payee?: string; // Recipient agent ID (falls back to env.PAYMENT_PAYEE)
}

export const POST: RequestHandler = async ({ request, platform }) => {
	markPublic({
		reason: 'HMAC-SHA256 authenticated x402-NP verification — signature is the auth factor'
	});

	const env = platform?.env as Env | undefined;

	if (!env?.DB) {
		return json({ verified: false, error: 'Database not available' }, { status: 500 });
	}

	const radiusSecret = await resolveSecret(
		env.KYM_NANDA_RADIUS_SECRET,
		kvFallback(env, SECRET_KEYS.RADIUS_SECRET)
	);
	if (!radiusSecret) {
		return json({ verified: false, error: 'Radius secret not configured' }, { status: 500 });
	}

	// Parse request body
	let body: VerifyNpRequest;
	try {
		body = await request.json();
	} catch {
		return json({ verified: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate required fields
	const { agent, tx_id, amount, timestamp, signature, payee } = body;

	if (!agent || typeof agent !== 'string') {
		return json({ verified: false, error: 'Missing or invalid "agent" field' }, { status: 400 });
	}
	if (!tx_id || typeof tx_id !== 'string') {
		return json({ verified: false, error: 'Missing or invalid "tx_id" field' }, { status: 400 });
	}
	if (typeof amount !== 'number' || amount <= 0) {
		return json({ verified: false, error: '"amount" must be a positive number' }, { status: 400 });
	}
	if (typeof timestamp !== 'number' || timestamp <= 0) {
		return json(
			{ verified: false, error: '"timestamp" must be a positive unix timestamp' },
			{ status: 400 }
		);
	}
	if (!signature || typeof signature !== 'string') {
		return json(
			{ verified: false, error: 'Missing or invalid "signature" field' },
			{ status: 400 }
		);
	}

	const resolvedPayee = payee || env.PAYMENT_PAYEE!;
	const db = createDbClient(env.DB);

	try {
		const result = await submitTransaction(
			db,
			tx_id, // txHash
			agent, // from
			resolvedPayee, // to
			amount, // amount in NP
			timestamp, // unix timestamp
			signature, // HMAC signature
			radiusSecret,
			env
		);

		// Route through multi-wallet for balance tracking.
		// NP has 0 decimals in the canonical currency registry
		// (src/lib/services/payment/currencies.ts), so the wallet's
		// "minor units" ARE whole NP — no scaling. This keeps the audit
		// ledger amount and the wallet balance change equal for the same
		// payment. Match the auto-renew/subscriptions pattern.
		if (result.verified) {
			const amountMinor = Math.floor(amount);
			const debitResult = await debitWallet(db, agent, 'NP', amountMinor);
			if (debitResult.success) {
				await creditWallet(db, resolvedPayee, 'NP', amountMinor);
			}
		}

		log.info('POST', 'NP payment verified', {
			agent,
			tx_id,
			amount,
			verified: result.verified,
			settlement_id: result.settlement_id
		});

		return json({
			verified: result.verified,
			settlement_id: result.settlement_id,
			recon: result.recon ?? null
		});
	} catch (err) {
		log.error('POST', 'NP verification failed', {
			agent,
			tx_id,
			error: err instanceof Error ? err.message : String(err)
		});

		return json(
			{
				verified: false,
				error: 'Internal verification error'
			},
			{ status: 500 }
		);
	}
};
