/**
 * Auditor Admin — Page Data Loader
 *
 * Loads intents, settlements, reconciliations, wallets, and stats.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { auditIntents, auditSettlements, auditReconciliations, auditWallets } from '$lib/db/schema';
import { desc, count, sum, eq, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-auditor');

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	const empty = {
		intents: [],
		settlements: [],
		reconciliations: [],
		wallets: [],
		stats: null,
		tab: 'intents'
	};
	if (!d1) return empty;

	const db = createDbClient(d1);
	const tab = url.searchParams.get('tab') || 'intents';

	try {
		const [
			intents,
			settlements,
			reconciliations,
			wallets,
			totalIntents,
			openIntents,
			totalSettlements,
			totalBalance,
			mismatches
		] = await Promise.all([
			db.select().from(auditIntents).orderBy(desc(auditIntents.createdAt)).limit(100),
			db.select().from(auditSettlements).orderBy(desc(auditSettlements.createdAt)).limit(100),
			db
				.select()
				.from(auditReconciliations)
				.orderBy(desc(auditReconciliations.createdAt))
				.limit(100),
			db.select().from(auditWallets).orderBy(desc(auditWallets.balanceMinor)).limit(100),
			db
				.select({ value: count() })
				.from(auditIntents)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(auditIntents)
				.where(eq(auditIntents.status, 'open'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(auditSettlements)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: sum(auditWallets.balanceMinor) })
				.from(auditWallets)
				.then((r) => Number(r[0]?.value ?? 0)),
			db
				.select({ value: count() })
				.from(auditReconciliations)
				.where(eq(auditReconciliations.verdict, 'mismatch'))
				.then((r) => r[0]?.value ?? 0)
		]);

		const stats = { totalIntents, openIntents, totalSettlements, totalBalance, mismatches };

		return { intents, settlements, reconciliations, wallets, stats, tab };
	} catch (error) {
		log.error('load', 'Failed to load auditor data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return empty;
	}
};
