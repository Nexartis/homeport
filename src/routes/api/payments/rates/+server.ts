/**
 * GET /api/payments/rates — Get exchange rates for currency pairs
 *
 * Query params:
 *   ?from=NP&to=USDC — single pair rate
 *   (no params) — all pairs matrix
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { getExchangeRate } from '$lib/services/payment/exchange-rates';
import { getActiveCurrencies } from '$lib/services/payment/currencies';
import { markPublic } from '$lib/server/auth-lanes';

export const GET: RequestHandler = async ({ url, platform }) => {
	markPublic({ reason: 'public exchange rate lookup — read-only, no sensitive data' });
	const env = platform!.env;
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	if (from && to) {
		// Single pair rate
		try {
			const result = await getExchangeRate(from, to, env);
			return json({ from, to, rate: result.rate });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return json({ error: msg }, { status: 400 });
		}
	}

	// All pairs matrix
	const currencies = getActiveCurrencies();
	const codes = currencies.map((c) => c.symbol);
	const rates: Record<string, Record<string, number>> = {};

	for (const f of codes) {
		rates[f] = {};
		for (const t of codes) {
			if (f === t) {
				rates[f][t] = 1;
				continue;
			}
			try {
				const result = await getExchangeRate(f, t, env);
				rates[f][t] = result.rate;
			} catch {
				rates[f][t] = 0;
			}
		}
	}

	return json({ rates, currencies: codes });
};
