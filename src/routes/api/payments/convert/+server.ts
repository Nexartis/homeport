/**
 * POST /api/payments/convert — Convert between currencies
 *
 * Body: { from: CurrencyCode, to: CurrencyCode, amount: number }
 * Returns: { from, to, amount, converted, rate }
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { convertAmount, getExchangeRate } from '$lib/services/payment/exchange-rates';
import { markPublic } from '$lib/server/auth-lanes';

export const POST: RequestHandler = async ({ request, platform }) => {
	markPublic({ reason: 'stateless currency conversion — no side effects, no sensitive data' });
	const env = platform!.env;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { from, to, amount } = body as { from: string; to: string; amount: number };

	if (typeof from !== 'string' || typeof to !== 'string') {
		return json({ error: 'from and to must be currency code strings' }, { status: 400 });
	}
	if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
		return json({ error: 'amount must be a positive number' }, { status: 400 });
	}

	try {
		const result = await getExchangeRate(from, to, env);
		const rate = result.rate;
		// Use the shared convertAmount() helper so decimal-scale
		// differences between currencies (NP=0, USDC/USDT/EURC=6, DAI=18)
		// are handled the same way as the rest of the wallet system.
		const converted = convertAmount(amount, from, to, result);

		return json({ from, to, amount, converted, rate });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: msg }, { status: 400 });
	}
};
