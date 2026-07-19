/**
 * GET /api/switchboard/adapters/:agent_id — List protocol adapters for an agent
 *
 * Returns all protocol adapters registered for the given agent,
 * showing which protocols were detected and their metadata.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { SwitchboardService } from '$lib/services/switchboard';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'switchboard-adapters');

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET adapters' });

	const env = platform!.env;
	const db = createDbClient(env.DB);
	const agentId = params.agent_id;

	if (!agentId) {
		return json({ error: 'agent_id parameter is required' }, { status: 400 });
	}

	try {
		const service = new SwitchboardService(db);
		const adapters = await service.listAdapters(agentId);
		const availableTypes = service.getAvailableAdapters();

		return json({
			agent_id: agentId,
			adapters,
			available_adapter_types: availableTypes
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: msg }, { status: 500 });
	}
};
