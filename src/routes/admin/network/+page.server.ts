/**
 * Network Explorer — Page Data Loader
 *
 * Loads all agents and federation peer status for the network graph.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import { desc, count, max, ne, isNotNull, eq, and, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-network');

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) return { agents: [], peers: [], stats: null };

	const db = createDbClient(d1);

	try {
		const [agents, peers, totalCount, aliveCount, localCount, federatedCount] = await Promise.all([
			db
				.select({
					agentId: agentAddrs.agentId,
					agentUrl: agentAddrs.agentUrl,
					status: agentAddrs.status,
					capabilities: agentAddrs.capabilities,
					source: agentAddrs.source,
					registeredAt: agentAddrs.registeredAt
				})
				.from(agentAddrs)
				.orderBy(desc(agentAddrs.registeredAt))
				.limit(500),
			db
				.select({
					source: agentAddrs.source,
					count: count(),
					lastUpdated: max(agentAddrs.updatedAt)
				})
				.from(agentAddrs)
				.where(and(isNotNull(agentAddrs.source), ne(agentAddrs.source, 'local')))
				.groupBy(agentAddrs.source),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.where(eq(agentAddrs.status, 'alive'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.where(sql`COALESCE(${agentAddrs.source}, 'local') = 'local'`)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(agentAddrs)
				.where(sql`COALESCE(${agentAddrs.source}, 'local') != 'local'`)
				.then((r) => r[0]?.value ?? 0)
		]);

		const stats = {
			total: totalCount,
			alive: aliveCount,
			localAgents: localCount,
			federated: federatedCount
		};

		return { agents, peers, stats };
	} catch (error) {
		log.error('load', 'Failed to load network data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { agents: [], peers: [], stats: null };
	}
};
