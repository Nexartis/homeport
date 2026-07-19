/**
 * Compliance Admin — Page Data Loader
 *
 * Loads policies, decisions, violations, and aggregate stats.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { compliancePolicies, complianceDecisions, complianceViolations } from '$lib/db/schema';
import { desc, count, eq } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-compliance');

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	const empty = { policies: [], decisions: [], violations: [], stats: null, tab: 'decisions' };
	if (!d1) return empty;

	const db = createDbClient(d1);
	const tab = url.searchParams.get('tab') || 'decisions';

	try {
		const [
			policies,
			decisions,
			violations,
			totalPolicies,
			totalDecisions,
			allowed,
			denied,
			totalViolations
		] = await Promise.all([
			db.select().from(compliancePolicies).orderBy(desc(compliancePolicies.updatedAt)).limit(100),
			db.select().from(complianceDecisions).orderBy(desc(complianceDecisions.createdAt)).limit(100),
			db
				.select()
				.from(complianceViolations)
				.orderBy(desc(complianceViolations.createdAt))
				.limit(100),
			db
				.select({ value: count() })
				.from(compliancePolicies)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(complianceDecisions)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(complianceDecisions)
				.where(eq(complianceDecisions.decision, 'ALLOW'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(complianceDecisions)
				.where(eq(complianceDecisions.decision, 'DENY'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(complianceViolations)
				.then((r) => r[0]?.value ?? 0)
		]);

		const stats = { totalPolicies, totalDecisions, allowed, denied, totalViolations };

		return { policies, decisions, violations, stats, tab };
	} catch (error) {
		log.error('load', 'Failed to load compliance data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return empty;
	}
};
