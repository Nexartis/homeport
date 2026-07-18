/**
 * x402-NP Payment Middleware — HTTP 402 Payment Required protocol
 *
 * Implements the x402-NP payment flow using custom headers:
 *   X-PAYMENT-AGENT  — paying agent identifier
 *   X-PAYMENT-TX-ID  — transaction hash / ID
 *   X-PAYMENT-AMOUNT — payment amount in NP minor units
 *
 * When any header is missing, returns 402 with protocol metadata.
 * When all headers are present, verifies the transaction via the auditor
 * service and forwards the request if valid.
 *
 * CORS headers for these custom headers are already configured in hooks.server.ts.
 */
import type { Env } from '$lib/types';
import { createDbClient } from '$lib/db/client';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { submitTransaction } from '$lib/services/auditor/service';

/**
 * Build a 402 Payment Required response with x402-NP protocol metadata.
 *
 * @param errorMessage - Human-readable error description
 * @returns 402 Response with protocol headers and JSON body
 */
function paymentRequiredResponse(errorMessage: string): Response {
	return new Response(
		JSON.stringify({
			error: errorMessage,
			protocol: 'x402-np',
			accepts: { currency: 'NP', min_amount: 1 }
		}),
		{
			status: 402,
			headers: {
				'Content-Type': 'application/json',
				'X-PAYMENT-REQUIRED': 'true',
				'X-PAYMENT-PROTOCOL': 'x402-np'
			}
		}
	);
}

/**
 * x402-NP payment middleware.
 *
 * Extracts payment headers from the incoming request. If any required header
 * is missing, returns a 402 Payment Required response. If all headers are
 * present, submits the transaction to the auditor for verification and
 * forwards the request to the next handler on success.
 *
 * @param request - Incoming HTTP request
 * @param env - Cloudflare Worker environment bindings
 * @param next - Next handler in the middleware chain
 * @returns Response from next handler or 402 Payment Required
 */
export async function paymentMiddleware(
	request: Request,
	env: Env,
	next: () => Promise<Response>
): Promise<Response> {
	// Extract payment headers
	const agent = request.headers.get('X-PAYMENT-AGENT');
	const txId = request.headers.get('X-PAYMENT-TX-ID');
	const amountStr = request.headers.get('X-PAYMENT-AMOUNT');
	const sig = request.headers.get('X-PAYMENT-SIG');

	// If ANY required header is missing → 402 (P0-4: sig is now required)
	if (!agent || !txId || !amountStr) {
		return paymentRequiredResponse('Payment Required');
	}

	if (!sig) {
		return paymentRequiredResponse('Missing payment signature (X-PAYMENT-SIG)');
	}

	// Parse and validate amount
	const amount = parseInt(amountStr, 10);
	if (isNaN(amount) || amount <= 0) {
		return paymentRequiredResponse('Invalid payment amount');
	}

	// Configurable payee (P0-4: no longer hardcoded 'service')
	const payee = env.PAYMENT_PAYEE;
	if (!payee) {
		return paymentRequiredResponse('Payment payee not configured');
	}

	// Verify transaction via auditor service (P0-4: pass actual sig + env)
	const radiusSecret = await resolveSecret(
		env.KYM_NANDA_RADIUS_SECRET,
		kvFallback(env, SECRET_KEYS.RADIUS_SECRET)
	);
	if (!radiusSecret) {
		return paymentRequiredResponse('Radius secret not configured');
	}
	const db = createDbClient(env.DB);
	const result = await submitTransaction(
		db,
		txId,
		agent,
		payee,
		amount,
		Math.floor(Date.now() / 1000),
		sig,
		radiusSecret,
		env
	);

	if (!result.verified) {
		return paymentRequiredResponse('Invalid payment signature');
	}

	// Payment verified — proceed to next handler
	return next();
}
