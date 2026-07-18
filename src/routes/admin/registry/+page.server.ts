/**
 * Registry Admin — Page Data Loader
 *
 * Loads agents (joined with agent_facts) and clients with pagination & search.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentAddrs, agentFacts, clients } from '$lib/db/schema';
import { desc, count, eq, ne, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-registry');

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) return { items: [], clients: 0, stats: null };

	const db = createDbClient(d1);

	try {
		const [items, totalCount, aliveCount, localCount, federatedCount, clientCount] =
			await Promise.all([
				db
					.select({
						agentId: agentAddrs.agentId,
						agentUrl: agentAddrs.agentUrl,
						apiUrl: agentAddrs.apiUrl,
						status: agentAddrs.status,
						capabilities: agentAddrs.capabilities,
						tags: agentAddrs.tags,
						source: agentAddrs.source,
						registeredAt: agentAddrs.registeredAt,
						updatedAt: agentAddrs.updatedAt,
						agentName: agentFacts.agentName,
						providerDid: agentFacts.providerDid,
						jurisdiction: agentFacts.jurisdiction,
						certLevel: agentFacts.certLevel
					})
					.from(agentAddrs)
					.leftJoin(agentFacts, eq(agentAddrs.agentId, agentFacts.agentId))
					.orderBy(desc(agentAddrs.registeredAt))
					.limit(100),
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
					.where(eq(agentAddrs.source, 'local'))
					.then((r) => r[0]?.value ?? 0),
				db
					.select({ value: count() })
					.from(agentAddrs)
					.where(ne(agentAddrs.source, 'local'))
					.then((r) => r[0]?.value ?? 0),
				db
					.select({ value: count() })
					.from(clients)
					.then((r) => r[0]?.value ?? 0)
			]);

		const stats = {
			total: totalCount,
			alive: aliveCount,
			localAgents: localCount,
			federated: federatedCount
		};

		return { items, clients: clientCount, stats };
	} catch (error) {
		log.error('load', 'Failed to load registry data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { items: [], clients: 0, stats: null };
	}
};
