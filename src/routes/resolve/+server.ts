/**
 * POST /resolve — Context-aware adaptive resolution endpoint
 * Phase 6 — Agent California
 *
 * Request body:
 *   { agent_id: string, context?: ResolutionContext }
 *
 * Response:
 *   ResolutionResult (ranked endpoints with scores)
 *
 * @see arXiv:2508.03113 — NANDA Adaptive Resolver
 *
 * @swagger
 * /resolve:
 *   post:
 *     summary: Adaptive agent resolution
 *     description: Resolves an agent to its best endpoint using multi-strategy scoring (latency, trust, protocol, geo).
 *     tags:
 *       - Resolution
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agent_id
 *             properties:
 *               agent_id:
 *                 type: string
 *               context:
 *                 type: object
 *                 properties:
 *                   preferred_protocol:
 *                     type: string
 *                     enum: [a2a, mcp, nlweb]
 *                   caller_region:
 *                     type: string
 *                   min_trust:
 *                     type: number
 *     responses:
 *       200:
 *         description: Ranked resolution results
 *       400:
 *         description: Missing agent_id
 *       404:
 *         description: Agent not found
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { ResolverService } from '$lib/services/resolver';
import type { ResolutionContext } from '$lib/types/resolver';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = createDbClient(platform!.env.DB);

	let body: { agent_id?: string; context?: ResolutionContext };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const agentId = body.agent_id;
	if (!agentId || typeof agentId !== 'string') {
		return json({ error: 'agent_id is required' }, { status: 400 });
	}

	// Validate context is a plain object (reject null, arrays, primitives)
	const context = body.context;
	if (context !== undefined && context !== null) {
		if (typeof context !== 'object' || Array.isArray(context)) {
			return json({ error: 'context must be a plain object' }, { status: 400 });
		}
	}
	if (context) {
		if (context.min_trust_score != null) {
			if (
				typeof context.min_trust_score !== 'number' ||
				context.min_trust_score < 0 ||
				context.min_trust_score > 1
			) {
				return json(
					{ error: 'min_trust_score must be a number between 0.0 and 1.0' },
					{ status: 400 }
				);
			}
		}
		if (context.protocol_preference) {
			const allowed = ['a2a', 'mcp', 'https', 'nlweb', 'any'];
			if (!allowed.includes(context.protocol_preference)) {
				return json(
					{ error: `protocol_preference must be one of: ${allowed.join(', ')}` },
					{ status: 400 }
				);
			}
		}
	}

	try {
		const resolver = new ResolverService(db);
		const result = await resolver.resolve(agentId, context);

		if (!result) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		return json(result);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
