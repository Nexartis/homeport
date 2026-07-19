/**
 * Analytics Admin — Page Data Loader
 *
 * Loads behavior metrics, trends, and compliance scan results.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentBehaviorMetrics, complianceScanRuns } from '$lib/db/schema';
import { desc, count, countDistinct, avg, eq } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-analytics');

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	if (!d1) return { metrics: [], scans: [], stats: null, tab: 'metrics' };

	const db = createDbClient(d1);
	const tab = url.searchParams.get('tab') || 'metrics';

	try {
		const [metrics, scans, totalMetrics, totalScans, agentsTracked, avgStats] = await Promise.all([
			db
				.select()
				.from(agentBehaviorMetrics)
				.orderBy(desc(agentBehaviorMetrics.computedAt))
				.limit(100),
			db.select().from(complianceScanRuns).orderBy(desc(complianceScanRuns.createdAt)).limit(100),
			db
				.select({ value: count() })
				.from(agentBehaviorMetrics)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(complianceScanRuns)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: countDistinct(agentBehaviorMetrics.agentId) })
				.from(agentBehaviorMetrics)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({
					avgUptime: avg(agentBehaviorMetrics.uptimePct),
					avgReputation: avg(agentBehaviorMetrics.reputationScore)
				})
				.from(agentBehaviorMetrics)
				.where(eq(agentBehaviorMetrics.periodType, 'daily'))
				.then((r) => r[0] ?? { avgUptime: null, avgReputation: null })
		]);

		const stats = {
			totalMetrics,
			totalScans,
			agentsTracked,
			avgUptime: avgStats.avgUptime ? Number(avgStats.avgUptime) : null,
			avgReputation: avgStats.avgReputation ? Number(avgStats.avgReputation) : null
		};

		return { metrics, scans, stats, tab };
	} catch (error) {
		log.error('load', 'Failed to load analytics data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { metrics: [], scans: [], stats: null, tab: 'metrics' };
	}
};
