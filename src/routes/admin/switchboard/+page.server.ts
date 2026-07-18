import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { protocolAdapters } from '$lib/db/schema';
import { desc, count, countDistinct, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ platform }) => {
	const env = platform!.env;
	const db = createDbClient(env.DB);

	const [adapters, statsRow, protocolCounts] = await Promise.all([
		db.select().from(protocolAdapters).orderBy(desc(protocolAdapters.detectedAt)).limit(100),
		db
			.select({
				totalAdapters: count(),
				uniqueAgents: countDistinct(protocolAdapters.agentId)
			})
			.from(protocolAdapters)
			.then((rows) => rows[0]),
		db
			.select({
				protocol: protocolAdapters.protocol,
				count: count()
			})
			.from(protocolAdapters)
			.groupBy(protocolAdapters.protocol)
			.orderBy(sql`count(*) DESC`)
	]);

	return {
		adapters,
		stats: statsRow ?? { totalAdapters: 0, uniqueAgents: 0 },
		protocolCounts
	};
};
