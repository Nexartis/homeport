import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import { desc, like } from 'drizzle-orm';
import { safeParseStringArray } from '$lib/utils/safe-json';
import { formatDateISO } from '$lib/utils/date';

interface AgentInfo {
	agent_id: string;
	agent_url: string | null;
	api_url: string | null;
	capabilities: string[];
	tags: string[];
	status: string;
	source: string;
	registered_at: string;
}

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	const q = url.searchParams.get('q') || '';

	if (!d1) {
		return { agents: [] as AgentInfo[], query: q, total: 0 };
	}

	const db = createDbClient(d1);

	try {
		const rows = await db
			.select({
				agent_id: agentAddrs.agentId,
				agent_url: agentAddrs.agentUrl,
				api_url: agentAddrs.apiUrl,
				capabilities: agentAddrs.capabilities,
				tags: agentAddrs.tags,
				status: agentAddrs.status,
				source: agentAddrs.source,
				registered_at: agentAddrs.registeredAt
			})
			.from(agentAddrs)
			.where(q ? like(agentAddrs.agentId, `%${q}%`) : undefined)
			.orderBy(desc(agentAddrs.registeredAt));

		const agentList: AgentInfo[] = rows.map((r) => ({
			agent_id: r.agent_id,
			agent_url: r.agent_url,
			api_url: r.api_url || null,
			capabilities: safeParseStringArray(r.capabilities),
			tags: safeParseStringArray(r.tags),
			status: r.status ?? 'unknown',
			source: r.source ?? 'local',
			registered_at: formatDateISO(r.registered_at, 'Unknown')
		}));

		return { agents: agentList, query: q, total: agentList.length };
	} catch {
		return { agents: [] as AgentInfo[], query: q, total: 0 };
	}
};
