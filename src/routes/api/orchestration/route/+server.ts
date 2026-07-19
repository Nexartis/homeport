/**
 * POST /api/orchestration/route — Route to best agent for an action
 *
 * Phase 6 — Sprint 14: A2A Routing + Sub-agent Delegation
 *
 * @swagger
 * /api/orchestration/route:
 *   post:
 *     summary: Route to best agent
 *     description: Uses multi-strategy scoring to find the best agent for an action (trust, latency, capability match).
 *     tags:
 *       - Orchestration
 *     responses:
 *       200:
 *         description: Routing decision with scores
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { routeToAgent, type RoutingRequest } from '$lib/services/orchestration';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-route');

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	let body: {
		source_agent_id?: string;
		action?: string;
		required_capabilities?: string[];
		preferred_protocol?: string;
		min_trust_score?: number;
		max_latency_ms?: number;
		exclude_agents?: string[];
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.source_agent_id || typeof body.source_agent_id !== 'string') {
		return json({ error: 'source_agent_id is required' }, { status: 400 });
	}
	if (!body.action || typeof body.action !== 'string') {
		return json({ error: 'action is required' }, { status: 400 });
	}
	if (body.min_trust_score !== undefined && !Number.isFinite(body.min_trust_score)) {
		return json({ error: 'min_trust_score must be a valid number' }, { status: 400 });
	}
	if (body.max_latency_ms !== undefined && !Number.isFinite(body.max_latency_ms)) {
		return json({ error: 'max_latency_ms must be a valid number' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);

		const routingReq: RoutingRequest = {
			sourceAgentId: body.source_agent_id,
			action: body.action,
			requiredCapabilities: body.required_capabilities,
			preferredProtocol: body.preferred_protocol as RoutingRequest['preferredProtocol'],
			minTrustScore: body.min_trust_score,
			maxLatencyMs: body.max_latency_ms,
			excludeAgents: body.exclude_agents
		};

		const result = await routeToAgent(db, routingReq);
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to route', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
