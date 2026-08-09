/**
 * NANDA Adapter — Fetches agents from a MIT NANDA Index-compatible registry.
 *
 * Tested against: registry.chat39.com:6900 (MIT NANDA Index, NEST)
 *
 * Transport is provided by `@nexartis/homeport-sdk` (HomeportClient):
 *   fetchNandaAgents     → client.agents.list()      (GET /list)
 *   previewNandaAgents   → agents.list + client.health()
 *   registerOnNandaIndex → client.agents.register()  (POST /register)
 *
 * Response formats handled (external NANDA registries are not all Homeport
 * nodes, so the multi-format parsing is retained on top of the SDK transport):
 *   1. { agents: [...], count: N }  — MIT NANDA Index (primary)
 *   2. Array of agents              — our own /list endpoint
 *   3. Dict keyed by agent_id       — legacy NANDA format
 *
 * The SDK's default User-Agent is overridden back to the historical
 * 'Nexartis-NANDA-Bridge/1.0' marker via a beforeRequest hook.
 */
import { HomeportClient } from '@nexartis/homeport-sdk';
import type { ExternalAgent } from '../bridge';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'adapter-nanda');

const USER_AGENT = 'Nexartis-NANDA-Bridge/1.0';

/**
 * Build a thin SDK client for a remote NANDA registry.
 * No retries and no circuit breaker (single-shot bridge calls); the SDK's
 * default User-Agent is swapped for the historical bridge marker.
 */
function createNandaClient(baseUrl: string): HomeportClient {
	return new HomeportClient({
		baseUrl,
		retryConfig: { maxRetries: 0, timeoutMs: 15_000 },
		circuitBreaker: false,
		hooks: {
			beforeRequest: (_url, init) => {
				const headers = init.headers as Record<string, string> | undefined;
				if (headers) headers['User-Agent'] = USER_AGENT;
			}
		}
	});
}

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
 * Uses the SDK's agents.list() (GET /list). `config.listPath` is accepted for
 * signature compatibility; the SDK transport targets the standard /list endpoint.
 */
export async function fetchNandaAgents(
	baseUrl: string,
	config: Record<string, unknown> = {}
): Promise<ExternalAgent[]> {
	const listPath = (config.listPath as string) ?? '/list';
	const client = createNandaClient(baseUrl);

	log.info('fetchNandaAgents', `Fetching from ${client.baseUrl}${listPath}`);

	let data: unknown;
	try {
		data = await client.agents.list();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`NANDA /list failed: ${msg}`);
	}

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

	// Optionally check /health via the SDK
	let registryHealth: string | undefined;
	try {
		const health = await createNandaClient(baseUrl).health();
		registryHealth = health.status ?? 'ok';
	} catch {
		registryHealth = 'unreachable';
	}

	return { agents, total: agents.length, registryHealth };
}

/**
 * Register an agent on a remote NANDA Index via the SDK's agents.register()
 * (POST /register).
 */
export async function registerOnNandaIndex(
	baseUrl: string,
	agent: { agent_id: string; agent_url: string; api_url?: string }
): Promise<{ success: boolean; message?: string }> {
	const client = createNandaClient(baseUrl);

	log.info('registerOnNandaIndex', `Registering ${agent.agent_id} at ${client.baseUrl}/register`);

	try {
		const resp = await client.agents.register({
			agent_id: agent.agent_id,
			agent_url: agent.agent_url,
			api_url: agent.api_url ?? agent.agent_url
		});
		log.info('registerOnNandaIndex', `Successfully registered ${agent.agent_id}`);
		return { success: true, message: resp.message ?? JSON.stringify(resp) };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		log.warn('registerOnNandaIndex', `Registration failed: ${msg}`);
		return { success: false, message: msg };
	}
}
