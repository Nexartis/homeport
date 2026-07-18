/**
 * POST /api/switchboard/export — Export AgentFacts to a target protocol format
 *
 * Converts an agent's AgentFacts v2 data to A2A Agent Card, MCP descriptor,
 * or NLWeb descriptor format.
 *
 * Lane C (M2M, strict): developer API key or admin session only. Export
 * reads agent metadata and returns a cross-format translation; restricted
 * to apikey/admin so it can't be abused by zero-role sessions.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { getAgentById } from '$lib/db/repositories/registry';
import { SwitchboardService } from '$lib/services/switchboard';
import type { ProtocolType } from '$lib/types/switchboard';
import type { AgentFactsV2Placeholder } from '$lib/types/resolver';
import { getActor, requireApiKeyOrAdmin } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'switchboard-api');

const VALID_PROTOCOLS: ProtocolType[] = ['a2a', 'mcp', 'nlweb'];

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireApiKeyOrAdmin(actor, { log, fn: 'POST export' });

	const env = platform!.env;
	const db = createDbClient(env.DB);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const agentId = body.agent_id;
	const targetProtocol = body.target_protocol as ProtocolType;

	if (typeof agentId !== 'string' || !agentId) {
		return json({ error: 'agent_id must be a non-empty string' }, { status: 400 });
	}
	if (!VALID_PROTOCOLS.includes(targetProtocol)) {
		return json(
			{ error: `target_protocol must be one of: ${VALID_PROTOCOLS.join(', ')}` },
			{ status: 400 }
		);
	}

	try {
		const agent = await getAgentById(db, agentId);
		if (!agent) {
			return json({ error: `Agent ${agentId} not found` }, { status: 404 });
		}

		// Build AgentFacts v2 from agent record
		const parsedCapabilities = agent.capabilities ? JSON.parse(agent.capabilities) : [];
		const staticEndpoints: Array<{ url: string; protocol: string }> = [];
		if (agent.agentUrl) staticEndpoints.push({ url: agent.agentUrl, protocol: 'nanda' });
		const facts: AgentFactsV2Placeholder = {
			agent_name: agent.agentId,
			version: agent.version ?? '1.0.0',
			capabilities: {
				modalities: Array.isArray(parsedCapabilities) ? parsedCapabilities : []
			},
			endpoints: {
				static: staticEndpoints
			}
		};

		const service = new SwitchboardService(db);
		const exported = service.exportAs(facts, targetProtocol);

		log.info('POST', 'Agent exported', { agentId, targetProtocol });

		return json({
			agent_id: agentId,
			target_protocol: targetProtocol,
			exported
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('POST', 'Export failed', { agentId, targetProtocol, error: msg });
		return json({ error: msg }, { status: 500 });
	}
};
