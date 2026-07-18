/**
 * POST /api/switchboard/discover — Auto-discover and register an agent from a URL
 *
 * Probes the URL for supported protocols (A2A, MCP, NLWeb, NANDA),
 * extracts agent metadata, and registers protocol adapters.
 *
 * Lane C (M2M, strict): developer API key or admin session only.
 * Discovery triggers outbound HTTP probes; requireApiKeyOrAdmin blocks
 * zero-role sessions from amplifying that capability.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { SwitchboardService } from '$lib/services/switchboard';
import { getActor, requireApiKeyOrAdmin } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'switchboard-api');

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireApiKeyOrAdmin(actor, { log, fn: 'POST discover' });

	const env = platform!.env;
	const db = createDbClient(env.DB);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const url = body.url;
	if (typeof url !== 'string' || !url) {
		return json({ error: 'url must be a non-empty string' }, { status: 400 });
	}

	try {
		const service = new SwitchboardService(db);
		const result = await service.autoRegister(url, env.ENVIRONMENT);

		if (!result) {
			return json(
				{ error: 'No supported protocols detected at the provided URL' },
				{ status: 404 }
			);
		}

		log.info('POST', 'Agent discovered and registered', {
			agentId: result.agentId,
			source: result.source,
			protocols: result.detectedProtocols.map((d) => d.protocol),
			durationMs: result.lookupDurationMs
		});

		return json(result, { status: 201 });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('POST', 'Discovery failed', { url, error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
