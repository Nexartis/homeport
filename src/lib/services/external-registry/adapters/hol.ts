/**
 * HOL Registry Broker Adapter — Fetches NANDA agents from the HOL aggregator.
 *
 * HOL (hol.org) aggregates 15+ registries including NANDA, AgentVerse, Virtuals.
 * API: GET /registry/api/v1/search?registries=nanda&limit=N&page=M
 * Returns: { hits: [...], total: N, page: N, limit: N }
 */
import type { ExternalAgent } from '../bridge';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'adapter-hol');

const DEFAULT_PAGE_SIZE = 100;
const MAX_AGENTS = 5000;

interface HolHit {
	id: string;
	uaid?: string;
	originalId?: string;
	registry?: string;
	name?: string;
	description?: string;
	capabilities?: number[];
	endpoints?: { api?: string; primary?: string };
	protocols?: string[];
	adapter?: string;
	availabilityStatus?: string;
	trustScore?: number;
	profile?: { display_name?: string; bio?: string };
	metadata?: {
		protocol?: string;
		provider?: string;
		facts?: {
			agent_name?: string;
			description?: string;
			jurisdiction?: string;
			label?: string;
			capabilities?: { modalities?: string[]; streaming?: boolean };
			endpoints?: { static?: string[] };
			provider?: { name?: string; url?: string; did?: string };
			certification?: { level?: string; issuer?: string; expirationDate?: string };
			skills?: Array<{
				id?: string;
				description?: string;
				inputModes?: string[];
				outputModes?: string[];
			}>;
		};
	};
}

interface HolSearchResponse {
	hits: HolHit[];
	total: number;
	page: number;
	limit: number;
}

function transformHolAgent(hit: HolHit): ExternalAgent | null {
	const agentUrl =
		hit.endpoints?.primary ?? hit.endpoints?.api ?? hit.metadata?.facts?.endpoints?.static?.[0];
	if (!agentUrl) return null;

	const agentId = hit.uaid ?? hit.originalId ?? hit.id;
	if (!agentId) return null;

	const facts = hit.metadata?.facts;
	const capabilities = facts?.capabilities?.modalities ?? [];
	const protocols = hit.protocols ?? (hit.metadata?.protocol ? [hit.metadata.protocol] : []);
	const tags: string[] = [];
	if (hit.registry) tags.push(hit.registry);
	if (facts?.jurisdiction) tags.push(`jurisdiction:${facts.jurisdiction}`);

	return {
		agent_id: agentId,
		agent_url: agentUrl,
		name: hit.name ?? facts?.agent_name ?? facts?.label,
		description: hit.description ?? facts?.description,
		capabilities,
		protocols,
		tags,
		provider: facts?.provider?.name ?? hit.metadata?.provider,
		trustScore: hit.trustScore,
		availabilityStatus: hit.availabilityStatus,
		certification: facts?.certification
			? {
					level: facts.certification.level,
					issuer: facts.certification.issuer,
					expirationDate: facts.certification.expirationDate
				}
			: undefined,
		skills: facts?.skills?.map((s) => ({
			id: s.id ?? '',
			description: s.description ?? '',
			inputModes: s.inputModes ?? [],
			outputModes: s.outputModes ?? []
		})),
		rawMetadata: hit.metadata as Record<string, unknown> | undefined
	};
}

export async function fetchHolAgents(
	baseUrl: string,
	config: Record<string, unknown> = {}
): Promise<ExternalAgent[]> {
	const registries = (config.registries as string) ?? 'nanda';
	const pageSize = (config.pageSize as number) ?? DEFAULT_PAGE_SIZE;
	const maxAgents = (config.maxAgents as number) ?? MAX_AGENTS;

	const allAgents: ExternalAgent[] = [];
	let page = 1;
	let total = Infinity;

	while (allAgents.length < total && allAgents.length < maxAgents) {
		const url = `${baseUrl.replace(/\/$/, '')}/registry/api/v1/search?registries=${registries}&limit=${pageSize}&page=${page}`;
		log.info(
			'fetchHolAgents',
			`Fetching page ${page} (${allAgents.length}/${Math.min(total, maxAgents)})`
		);

		const resp = await fetch(url, {
			headers: { Accept: 'application/json', 'User-Agent': 'Nexartis-NANDA-Bridge/1.0' },
			signal: AbortSignal.timeout(30_000)
		});

		if (!resp.ok) throw new Error(`HOL search failed: ${resp.status} ${resp.statusText}`);

		const data = (await resp.json()) as HolSearchResponse;
		total = data.total ?? 0;

		for (const hit of data.hits ?? []) {
			const agent = transformHolAgent(hit);
			if (agent) allAgents.push(agent);
		}

		page++;
		if ((data.hits ?? []).length < pageSize) break;
	}

	log.info('fetchHolAgents', `Fetched ${allAgents.length} agents (total available: ${total})`);
	return allAgents;
}
