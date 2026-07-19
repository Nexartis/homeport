/**
 * POST /api/switchboard/resync — Re-probe and update protocol adapters for an agent
 *
 * Deletes existing adapters, re-probes the agent's URL, and registers
 * newly detected protocol adapters.
 *
 * Lane C (M2M, strict): developer API key or admin session only. Resync
 * triggers outbound HTTP probes; requireApiKeyOrAdmin blocks zero-role
 * sessions from amplifying that capability.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { getAgentUrl } from '$lib/db/repositories/registry';
import { SwitchboardService } from '$lib/services/switchboard';
import { getActor, requireApiKeyOrAdmin } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'switchboard-api');

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireApiKeyOrAdmin(actor, { log, fn: 'POST resync' });

	const env = platform!.env;
	const db = createDbClient(env.DB);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const agentId = body.agent_id;
	if (typeof agentId !== 'string' || !agentId) {
		return json({ error: 'agent_id must be a non-empty string' }, { status: 400 });
	}

	try {
		// Look up agent URL from registry
		const agent = await getAgentUrl(db, agentId);
		if (!agent?.agentUrl) {
			return json({ error: `Agent ${agentId} not found in registry` }, { status: 404 });
		}

		const service = new SwitchboardService(db);
		await service.resync(agentId, agent.agentUrl, env.ENVIRONMENT);

		// Return updated adapters
		const adapters = await service.listAdapters(agentId);

		log.info('POST', 'Agent adapters resynced', { agentId, adapterCount: adapters.length });

		return json({
			status: 'success',
			agent_id: agentId,
			adapters
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('POST', 'Resync failed', { agentId, error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
