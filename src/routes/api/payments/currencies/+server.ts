/**
 * GET /api/payments/currencies — List all supported currencies
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { getActiveCurrencies } from '$lib/services/payment/currencies';
import { markPublic } from '$lib/server/auth-lanes';

export const GET: RequestHandler = async () => {
	markPublic({ reason: 'static list of supported currencies — no sensitive data' });
	const currencies = getActiveCurrencies();
	return json({ currencies });
};
