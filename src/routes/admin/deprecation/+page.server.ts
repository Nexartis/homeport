/**
 * Deprecation Admin — Page Data Loader + Actions
 *
 * Loads deprecated and tombstoned agents with their sunset timelines.
 * Provides a form action for tombstoning agents server-side (avoids
 * the need for X-Cron-Auth from the browser).
 */
import type { PageServerLoad, Actions } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import { and, asc, count, eq, lte, inArray, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';
import { tombstoneAgent } from '$lib/services/deprecation/service';
import { fail } from '@sveltejs/kit';

const log = createLogger(undefined, 'admin-deprecation');

const LIFECYCLE_STATUSES = ['deprecated', 'tombstoned'] as const;

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) return { items: [], stats: null };

	const db = createDbClient(d1);
	const sevenDays = Math.floor(Date.now() / 1000) + 7 * 86400;

	try {
		const [items, deprecated, tombstoned, expiringSoon] = await Promise.all([
			db
				.select({
					agentId: agentAddrs.agentId,
					agentUrl: agentAddrs.agentUrl,
					status: agentAddrs.status,
					version: agentAddrs.version,
					deprecatedAt: agentAddrs.deprecatedAt,
					sunsetAt: agentAddrs.sunsetAt,
					updatedAt: agentAddrs.updatedAt
				})
				.from(agentAddrs)
				.where(inArray(agentAddrs.status, [...LIFECYCLE_STATUSES]))
				.orderBy(
					sql`CASE WHEN ${agentAddrs.status} = 'deprecated' THEN 0 ELSE 1 END`,
					asc(agentAddrs.sunsetAt)
				),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.where(eq(agentAddrs.status, 'deprecated'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.where(eq(agentAddrs.status, 'tombstoned'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.where(and(eq(agentAddrs.status, 'deprecated'), lte(agentAddrs.sunsetAt, sevenDays)))
				.then((r: { value: number }[]) => r[0]?.value ?? 0)
		]);

		const stats = { deprecated, tombstoned, expiringSoon };

		return { items, stats };
	} catch (error) {
		log.error('load', 'Failed to load deprecation data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { items: [], stats: null };
	}
};

export const actions: Actions = {
	tombstone: async ({ request, platform }) => {
		const d1 = platform?.env?.DB;
		if (!d1) return fail(500, { error: 'Database not available' });

		const formData = await request.formData();
		const agentId = formData.get('agentId');
		if (!agentId || typeof agentId !== 'string') {
			return fail(400, { error: 'Missing agentId' });
		}

		const db = createDbClient(d1);
		const result = await tombstoneAgent(db, agentId);
		if (!result.success) {
			return fail(400, { error: result.error ?? 'Tombstone failed' });
		}

		return { success: true, agentId };
	}
};
