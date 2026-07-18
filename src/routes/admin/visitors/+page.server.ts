/**
 * Admin Visitors — Page Data Loader
 *
 * Loads site visitors collected via the vault-gate.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { siteVisitors } from '$lib/db/schema';
import { desc, count, eq, gt } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-visitors');

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) return { visitors: [], stats: null };

	const db = createDbClient(d1);

	try {
		const dayAgo = Math.floor(Date.now() / 1000) - 86400;

		const [visitors, total, active, repeatVisitors, today] = await Promise.all([
			db.select().from(siteVisitors).orderBy(desc(siteVisitors.createdAt)).limit(500),
			db
				.select({ value: count() })
				.from(siteVisitors)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(siteVisitors)
				.where(eq(siteVisitors.status, 'active'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(siteVisitors)
				.where(gt(siteVisitors.visitCount, 1))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(siteVisitors)
				.where(gt(siteVisitors.createdAt, dayAgo))
				.then((r) => r[0]?.value ?? 0)
		]);

		const stats = { total, active, repeatVisitors, today };

		return { visitors, stats };
	} catch (error) {
		log.error('load', 'Failed to load visitors', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { visitors: [], stats: null };
	}
};
