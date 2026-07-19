/**
 * Admin Dashboard — Page Data Loader
 *
 * Loads recent activity for the overview dashboard.
 * When keys are not initialized, signals the UI to show the onboarding wizard.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { complianceDecisions, certJobs, telemetryEvents } from '$lib/db/schema';
import { desc, gt, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';
import { areKeysInitialized } from '$lib/services/key-management';

const log = createLogger(undefined, 'admin-dashboard');

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.NANDA_NODE_CACHE;
	let keysInitialized = true;
	if (kv) {
		try {
			keysInitialized = await areKeysInitialized(kv);
		} catch {
			keysInitialized = false;
		}
	}

	const d1 = platform?.env?.DB;
	if (!d1) return { recentActivity: [], keysInitialized };

	const db = createDbClient(d1);

	try {
		const dayAgo = Math.floor(Date.now() / 1000) - 86400;

		// Run three parallel queries and merge in JS (cleaner than UNION ALL)
		const [compliance, certs, telemetry] = await Promise.all([
			db
				.select({
					service: sql<string>`'compliance'`,
					type: complianceDecisions.decision,
					createdAt: complianceDecisions.createdAt
				})
				.from(complianceDecisions)
				.where(gt(complianceDecisions.createdAt, dayAgo))
				.orderBy(desc(complianceDecisions.createdAt))
				.limit(50),
			db
				.select({
					service: sql<string>`'certifier'`,
					type: certJobs.status,
					createdAt: certJobs.createdAt
				})
				.from(certJobs)
				.where(gt(certJobs.createdAt, dayAgo))
				.orderBy(desc(certJobs.createdAt))
				.limit(50),
			db
				.select({
					service: sql<string>`'observer'`,
					type: sql<string>`CASE WHEN ${telemetryEvents.success} = 1 THEN 'success' ELSE 'error' END`,
					createdAt: telemetryEvents.createdAt
				})
				.from(telemetryEvents)
				.where(gt(telemetryEvents.createdAt, dayAgo))
				.orderBy(desc(telemetryEvents.createdAt))
				.limit(50)
		]);

		const recentActivity = [...compliance, ...certs, ...telemetry]
			.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
			.slice(0, 50);

		return { recentActivity, keysInitialized };
	} catch (error) {
		log.error('load', 'Failed to load dashboard data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { recentActivity: [], keysInitialized };
	}
};
