import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { agentAddrs, agentFacts, certificates, reputationSnapshots } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { safeParseStringArray } from '$lib/utils/safe-json';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'agent-detail');

export const load: PageServerLoad = async ({ params, platform }) => {
	const d1 = platform!.env.DB;
	if (!d1) error(503, 'Database unavailable');

	const db = createDbClient(d1);
	const agentId = decodeURIComponent(params.id);

	try {
		// Parallel load: agent + facts + latest certs + latest reputation
		const [agent, facts, certs, reputation] = await Promise.all([
			db.query.agentAddrs.findFirst({ where: eq(agentAddrs.agentId, agentId) }),
			db.query.agentFacts.findFirst({ where: eq(agentFacts.agentId, agentId) }),
			db
				.select()
				.from(certificates)
				.where(eq(certificates.agentId, agentId))
				.orderBy(desc(certificates.issuedAt))
				.limit(10),
			db
				.select()
				.from(reputationSnapshots)
				.where(eq(reputationSnapshots.agentId, agentId))
				.orderBy(desc(reputationSnapshots.createdAt))
				.limit(1)
		]);

		if (!agent) error(404, 'Agent not found');

		return {
			agent: {
				...agent,
				capabilities: safeParseStringArray(agent.capabilities),
				tags: safeParseStringArray(agent.tags)
			},
			facts: facts ?? null,
			certs,
			reputation: reputation[0] ?? null
		};
	} catch (e) {
		// Re-throw SvelteKit errors (404, 503)
		if (e && typeof e === 'object' && 'status' in e) throw e;
		log.error('load', `Failed to load agent detail: ${agentId} — ${String(e)}`);
		error(500, 'Failed to load agent');
	}
};
