/**
 * MCP (Model Context Protocol) Endpoint
 * POST /mcp
 *
 * JSON-RPC 2.0 over HTTP implementing the MCP Streamable HTTP transport.
 * Exposes NANDA infrastructure APIs as MCP tools for AI assistants.
 *
 * Authentication: Bearer API key (nanda_ prefix) required.
 *
 * @swagger
 * /mcp:
 *   post:
 *     summary: MCP tool server
 *     description: |
 *       JSON-RPC 2.0 Model Context Protocol endpoint. Supports tools/list and tools/call.
 *       Available tools: nanda_lookup_agent, nanda_search_agents, nanda_list_agents,
 *       nanda_get_reputation, nanda_check_cert, nanda_check_health, nanda_register_agent,
 *       nanda_get_agentfacts, nanda_resolve_agent, nanda_federation_status, nanda_create_workflow,
 *       nanda_run_workflow, nanda_trust_scores, nanda_compliance_check, nanda_subscribe_webhook.
 *     tags:
 *       - Protocol
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jsonrpc
 *               - method
 *               - id
 *             properties:
 *               jsonrpc:
 *                 type: string
 *                 enum: ["2.0"]
 *               method:
 *                 type: string
 *                 enum: [tools/list, tools/call, initialize]
 *               params:
 *                 type: object
 *               id:
 *                 type: string
 *     responses:
 *       200:
 *         description: JSON-RPC response with tool results
 *       401:
 *         description: Missing or invalid API key
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { handleMcpRequest } from '$lib/mcp/handler';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const env = platform!.env;

	// Try to extract the JSON-RPC id so early errors can echo it back.
	let reqId: string | number | null = null;
	let clonedBody: string | null = null;
	try {
		clonedBody = await request.clone().text();
		const parsed = JSON.parse(clonedBody);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			const raw = (parsed as Record<string, unknown>).id;
			if (typeof raw === 'string' || typeof raw === 'number') reqId = raw;
		}
	} catch {
		// Ignore — body may not be valid JSON yet; handler will return parse error later.
	}

	if (!env.DB) {
		return json(
			{ jsonrpc: '2.0', id: reqId, error: { code: -32000, message: 'Database not configured' } },
			{ status: 503 }
		);
	}

	// Auth already validated + usage incremented in hooks.server.ts (Bearer token flow).
	// Checking locals avoids a second validateDevApiKey call that could race with usage accounting.
	if (!locals.apiKey) {
		return json(
			{
				jsonrpc: '2.0',
				id: reqId,
				error: { code: -32001, message: 'Unauthorized — valid nanda_ API key required' }
			},
			{ status: 401 }
		);
	}

	const db = createDbClient(env.DB);

	// ── Dispatch to MCP handler ──
	return handleMcpRequest(request, { db, env });
};
