/**
 * Observer Admin — Page Data Loader
 *
 * Loads telemetry events, probe runs, reputation snapshots, and stats.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { telemetryEvents, probeRuns, reputationSnapshots } from '$lib/db/schema';
import { desc, count, avg, eq, gt, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-observer');

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	const empty = { telemetry: [], probes: [], reputation: [], stats: null, tab: 'telemetry' };
	if (!d1) return empty;

	const db = createDbClient(d1);
	const tab = url.searchParams.get('tab') || 'telemetry';
	const dayAgo = Math.floor(Date.now() / 1000) - 86400;

	try {
		// Latest reputation per agent: use a subquery for max(created_at)
		const latestRepSub = db
			.select({
				agentId: reputationSnapshots.agentId,
				maxCreated: sql<number>`MAX(${reputationSnapshots.createdAt})`.as('max_created')
			})
			.from(reputationSnapshots)
			.groupBy(reputationSnapshots.agentId)
			.as('latest');

		const [telemetry, probes, reputation, totalEvents, errors, fraud, totalProbes, avgRep] =
			await Promise.all([
				db.select().from(telemetryEvents).orderBy(desc(telemetryEvents.createdAt)).limit(100),
				db.select().from(probeRuns).orderBy(desc(probeRuns.createdAt)).limit(100),
				db
					.select()
					.from(reputationSnapshots)
					.innerJoin(
						latestRepSub,
						sql`${reputationSnapshots.agentId} = ${latestRepSub.agentId} AND ${reputationSnapshots.createdAt} = ${latestRepSub.maxCreated}`
					)
					.orderBy(desc(reputationSnapshots.reputation))
					.limit(100)
					.then((rows) => rows.map((r) => r.reputation_snapshots)),
				db
					.select({ value: count() })
					.from(telemetryEvents)
					.then((r) => r[0]?.value ?? 0),
				db
					.select({ value: count() })
					.from(telemetryEvents)
					.where(eq(telemetryEvents.success, 0))
					.then((r) => r[0]?.value ?? 0),
				db
					.select({ value: count() })
					.from(telemetryEvents)
					.where(eq(telemetryEvents.fraudFlag, 1))
					.then((r) => r[0]?.value ?? 0),
				db
					.select({ value: count() })
					.from(probeRuns)
					.then((r) => r[0]?.value ?? 0),
				db
					.select({ value: avg(reputationSnapshots.reputation) })
					.from(reputationSnapshots)
					.where(gt(reputationSnapshots.createdAt, dayAgo))
					.then((r) => (r[0]?.value ? Number(r[0].value) : null))
			]);

		const stats = { totalEvents, errors, fraud, totalProbes, avgReputation: avgRep };

		return { telemetry, probes, reputation, stats, tab };
	} catch (error) {
		log.error('load', 'Failed to load observer data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return empty;
	}
};
