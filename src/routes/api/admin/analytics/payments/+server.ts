/**
 * GET /api/admin/analytics/payments?range={range}
 *
 * Aggregated payment analytics dashboard endpoint.
 * Returns DashboardData-shaped JSON for the KYM Payment Analytics Dashboard.
 *
 * Phase 5 — Agent Delta
 
 * @swagger
 * /api/admin/analytics/payments:
 *   get:
 *     summary: Payment analytics dashboard
 *     description: Aggregated payment analytics for the admin dashboard. Supports daily, weekly, monthly ranges.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { aggregatePaymentAnalytics } from '$lib/services/analytics/payment-analytics';
import { getActor, requireAdminRole } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-analytics-payments');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const VALID_RANGES = ['24h', '7d', '30d', '90d', 'all'];
	const range = url.searchParams.get('range') || '30d';
	const safeRange = VALID_RANGES.includes(range) ? range : '30d';

	const db = createDbClient(platform.env.DB);

	try {
		const data = await aggregatePaymentAnalytics(db, safeRange);
		return json(data);
	} catch (err) {
		log.error('GET', 'Payment analytics aggregation failed', {
			range: safeRange,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
