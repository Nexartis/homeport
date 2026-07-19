/**
 * NANDA Adapter — Fetches agents from a MIT NANDA Index-compatible registry.
 *
 * Tested against: registry.chat39.com:6900 (MIT NANDA Index, NEST)
 *
 * Response formats handled:
 *   1. { agents: [...], count: N }  — MIT NANDA Index (primary)
 *   2. Array of agents              — our own /list endpoint
 *   3. Dict keyed by agent_id       — legacy NANDA format
 *
 * Also provides `previewNandaAgents` for browsing without importing.
 */
import type { ExternalAgent } from '../bridge';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'adapter-nanda');

/** Raw agent shape from the MIT NANDA Index /list endpoint. */
interface NandaIndexAgent {
	agent_id: string;
	agent_url?: string;
	endpoint?: string;
	a2a_endpoint?: string;
	api_url?: string;
	name?: string;
	description?: string;
	facts_url?: string;
	agentFactsURL?: string;
	specialization?: string;
	capabilities?: string[];
	expertise?: string[];
	agent_type?: string;
	status?: string;
	created_at?: string;
	last_seen?: string;
	interaction_stats?: {
		total_ratings_received?: number;
		average_rating?: number;
		total_interactions?: number;
	};
}

/**
 * Parse raw NANDA response into a flat array of agent records.
 */
function parseNandaResponse(data: unknown): NandaIndexAgent[] {
	if (Array.isArray(data)) {
		return data;
	}
	if (typeof data === 'object' && data !== null) {
		const obj = data as Record<string, unknown>;

		// Format: { agents: [...], count: N } — MIT NANDA Index
		if (Array.isArray(obj.agents)) {
			return obj.agents as NandaIndexAgent[];
		}

		// Dict format: { "agent-001": { agent_url, ... }, ... }
		// Exclude known metadata keys like "count"
		return Object.entries(obj)
			.filter(([key, v]) => typeof v === 'object' && v !== null && key !== 'count')
			.map(([key, value]) => {
				const v = value as Record<string, unknown>;
				return { agent_id: (v.agent_id as string) ?? key, ...v } as NandaIndexAgent;
			});
	}
	return [];
}

/**
 * Map a raw NANDA Index agent to our ExternalAgent shape, preserving all metadata.
 */
function toExternalAgent(a: NandaIndexAgent): ExternalAgent | null {
	const agentUrl = a.agent_url || a.endpoint || a.a2a_endpoint || '';
	if (!a.agent_id) return null;

	// Build tags from expertise + agent_type + status
	const tags: string[] = [];
	if (a.expertise) tags.push(...a.expertise);
	if (a.agent_type) tags.push(`type:${a.agent_type}`);
	if (a.specialization) tags.push(`spec:${a.specialization}`);

	return {
		agent_id: a.agent_id,
		agent_url: agentUrl,
		api_url: a.api_url ?? a.a2a_endpoint,
		facts_url: a.facts_url ?? a.agentFactsURL,
		name: a.name,
		description: a.description,
		capabilities: a.capabilities,
		tags: tags.length ? tags : undefined,
		availabilityStatus: a.status,
		rawMetadata: {
			specialization: a.specialization,
			expertise: a.expertise,
			agent_type: a.agent_type,
			created_at: a.created_at,
			last_seen: a.last_seen,
			interaction_stats: a.interaction_stats,
			a2a_endpoint: a.a2a_endpoint
		}
	};
}

/**
 * Fetch agents from a NANDA-compatible registry and convert to ExternalAgent[].
 */
export async function fetchNandaAgents(
	baseUrl: string,
	config: Record<string, unknown> = {}
): Promise<ExternalAgent[]> {
	const listPath = (config.listPath as string) ?? '/list';
	const url = `${baseUrl.replace(/\/$/, '')}${listPath}`;

	log.info('fetchNandaAgents', `Fetching from ${url}`);

	const resp = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'Nexartis-NANDA-Bridge/1.0'
		},
		signal: AbortSignal.timeout(15_000)
	});

	if (!resp.ok) {
		throw new Error(`NANDA /list failed: ${resp.status} ${resp.statusText}`);
	}

	const data = await resp.json();
	const rawAgents = parseNandaResponse(data);

	log.info('fetchNandaAgents', `Parsed ${rawAgents.length} agents from response`);

	return rawAgents.map(toExternalAgent).filter((a): a is ExternalAgent => a !== null);
}

/**
 * Preview agents from a NANDA registry without importing.
 * Returns the raw ExternalAgent list for admin review.
 */
export async function previewNandaAgents(
	baseUrl: string,
	config: Record<string, unknown> = {}
): Promise<{ agents: ExternalAgent[]; total: number; registryHealth?: string }> {
	const agents = await fetchNandaAgents(baseUrl, config);

	// Optionally check /health
	let registryHealth: string | undefined;
	try {
		const healthResp = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
			signal: AbortSignal.timeout(5_000)
		});
		if (healthResp.ok) {
			const h = (await healthResp.json()) as Record<string, unknown>;
			registryHealth = (h.status as string) ?? 'ok';
		}
	} catch {
		registryHealth = 'unreachable';
	}

	return { agents, total: agents.length, registryHealth };
}

/**
 * Register an agent on a remote NANDA Index via POST /register.
 */
export async function registerOnNandaIndex(
	baseUrl: string,
	agent: { agent_id: string; agent_url: string; api_url?: string }
): Promise<{ success: boolean; message?: string }> {
	const url = `${baseUrl.replace(/\/$/, '')}/register`;

	log.info('registerOnNandaIndex', `Registering ${agent.agent_id} at ${url}`);

	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'Nexartis-NANDA-Bridge/1.0'
		},
		body: JSON.stringify({
			agent_id: agent.agent_id,
			agent_url: agent.agent_url,
			api_url: agent.api_url ?? agent.agent_url
		}),
		signal: AbortSignal.timeout(15_000)
	});

	const body = await resp.text();

	if (!resp.ok) {
		log.warn('registerOnNandaIndex', `Registration failed: ${resp.status} — ${body}`);
		return { success: false, message: `${resp.status}: ${body}` };
	}

	log.info('registerOnNandaIndex', `Successfully registered ${agent.agent_id}`);
	return { success: true, message: body };
}
