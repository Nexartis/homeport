/**
 * MCP JSON-RPC 2.0 Handler for NANDA Infrastructure Services
 *
 * Implements the MCP protocol methods:
 *   - initialize    → server info + capabilities
 *   - tools/list    → available tool definitions
 *   - tools/call    → dispatch to tool executors
 *
 * Protocol version: 2025-03-26 (MCP Streamable HTTP)
 */

import type { DbClient } from '$lib/db/client';
import type { Env } from '$lib/types';
import { NANDA_MCP_TOOLS } from './tools';
import {
	execLookupAgent,
	execSearchAgents,
	execListAgents,
	execGetReputation,
	execCheckCert,
	execCheckHealth,
	execRegisterAgent,
	execGetAgentFacts,
	execResolveAgent,
	execFederationStatus,
	execCreateWorkflow,
	execRunWorkflow,
	execTrustScores,
	execComplianceCheck,
	execSubscribeWebhook,
	execDiscoverAgent,
	execListAdapters,
	execExportAgent,
	execGetExchangeRates,
	execGetWalletBalance,
	execConvertCurrency
} from './executors';

// ===================================================================
// JSON-RPC helpers
// ===================================================================

interface JsonRpcRequest {
	jsonrpc?: string;
	id?: string | number | null;
	method?: string;
	params?: Record<string, unknown>;
}

function jsonRpcResult(result: unknown, id?: string | number | null): Response {
	return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, result }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

function jsonRpcError(
	message: string,
	code: number,
	id?: string | number | null,
	httpStatus = 200
): Response {
	return new Response(
		JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }),
		{ status: httpStatus, headers: { 'Content-Type': 'application/json' } }
	);
}

// ===================================================================
// MCP Handler
// ===================================================================

export interface McpHandlerContext {
	db: DbClient;
	env: Env;
}

export async function handleMcpRequest(
	request: Request,
	ctx: McpHandlerContext
): Promise<Response> {
	// Parse the JSON-RPC body
	let body: JsonRpcRequest;
	try {
		body = (await request.json()) as JsonRpcRequest;
	} catch {
		return jsonRpcError('Parse error', -32700, null);
	}

	// Guard against null / non-object parse results (e.g. JSON.parse("null"))
	if (!body || typeof body !== 'object') {
		return jsonRpcError('Invalid request — expected JSON object', -32600, null);
	}

	// Validate JSON-RPC envelope
	if (!body.method || typeof body.method !== 'string') {
		return jsonRpcError('Invalid request — missing method', -32600, body.id);
	}
	if (body.jsonrpc !== '2.0') {
		return jsonRpcError('Invalid request — jsonrpc must be "2.0"', -32600, body.id);
	}

	const { method, params, id: rawId } = body;
	// JSON-RPC 2.0: id MUST be string, number, or null — reject arrays/objects
	const id: string | number | null =
		typeof rawId === 'string' || typeof rawId === 'number' ? rawId : null;

	// ── initialize ──
	if (method === 'initialize') {
		return jsonRpcResult(
			{
				protocolVersion: '2025-03-26',
				capabilities: { tools: {} },
				serverInfo: { name: 'nanda-infrastructure-mcp', version: '1.0.0' }
			},
			id
		);
	}

	// ── tools/list ──
	if (method === 'tools/list') {
		return jsonRpcResult({ tools: NANDA_MCP_TOOLS }, id);
	}

	// ── tools/call ──
	if (method === 'tools/call') {
		if (!params || typeof params !== 'object' || Array.isArray(params)) {
			return jsonRpcError('Invalid params — expected an object', -32602, id);
		}

		const toolName = (params as { name?: string })?.name;
		if (!toolName || typeof toolName !== 'string') {
			return jsonRpcError('Invalid params — missing tool name', -32602, id);
		}

		const rawArgs = (params as { arguments?: unknown })?.arguments;
		if (
			rawArgs !== undefined &&
			rawArgs !== null &&
			(typeof rawArgs !== 'object' || Array.isArray(rawArgs))
		) {
			return jsonRpcError('Invalid params — arguments must be an object', -32602, id);
		}
		const toolArgs = (rawArgs ?? {}) as Record<string, unknown>;

		try {
			const result = await dispatchTool(toolName, toolArgs, ctx);
			return jsonRpcResult({ content: [{ type: 'text', text: JSON.stringify(result) }] }, id);
		} catch (err) {
			if (err instanceof InvalidParamsError) {
				return jsonRpcError(err.message, -32602, id);
			}
			const message = err instanceof Error ? err.message : String(err);
			return jsonRpcError(`Tool execution error: ${message}`, -32000, id);
		}
	}

	// Unknown method
	return jsonRpcError(`Method not found: ${method}`, -32601, id);
}

// ===================================================================
// Tool dispatch
// ===================================================================

class InvalidParamsError extends Error {}

function requireStringParam(args: Record<string, unknown>, key: string): void {
	if (typeof args[key] !== 'string' || args[key] === '') {
		throw new InvalidParamsError(`Missing required param: ${key}`);
	}
}

function requireOptionalStringArray(args: Record<string, unknown>, key: string): void {
	if (key in args && args[key] !== undefined) {
		if (
			!Array.isArray(args[key]) ||
			!(args[key] as unknown[]).every((v) => typeof v === 'string')
		) {
			throw new InvalidParamsError(`Param '${key}' must be an array of strings`);
		}
	}
}

async function dispatchTool(
	name: string,
	args: Record<string, unknown>,
	ctx: McpHandlerContext
): Promise<unknown> {
	switch (name) {
		case 'nanda_lookup_agent':
			requireStringParam(args, 'agent_id');
			return execLookupAgent(ctx.db, args as Parameters<typeof execLookupAgent>[1]);
		case 'nanda_search_agents':
			requireOptionalStringArray(args, 'capabilities');
			requireOptionalStringArray(args, 'tags');
			return execSearchAgents(ctx.db, args as Parameters<typeof execSearchAgents>[1]);
		case 'nanda_list_agents':
			return execListAgents(ctx.db);
		case 'nanda_get_reputation':
			return execGetReputation(ctx.db, args as Parameters<typeof execGetReputation>[1]);
		case 'nanda_check_cert':
			requireStringParam(args, 'cert_id');
			return execCheckCert(ctx.db, args as Parameters<typeof execCheckCert>[1]);
		case 'nanda_check_health':
			return execCheckHealth(ctx.env, ctx.db);
		case 'nanda_register_agent':
			requireStringParam(args, 'agent_id');
			requireStringParam(args, 'agent_url');
			return execRegisterAgent(ctx.db, ctx.env, args as Parameters<typeof execRegisterAgent>[2]);
		case 'nanda_get_agentfacts':
			requireStringParam(args, 'agent_id');
			return execGetAgentFacts(ctx.db, args as Parameters<typeof execGetAgentFacts>[1]);
		case 'nanda_resolve_agent':
			requireStringParam(args, 'agent_id');
			return execResolveAgent(ctx.db, ctx.env, args as Parameters<typeof execResolveAgent>[2]);
		case 'nanda_federation_status':
			return execFederationStatus(ctx.db, ctx.env);
		case 'nanda_create_workflow':
			requireStringParam(args, 'name');
			return execCreateWorkflow(ctx.db, args as Parameters<typeof execCreateWorkflow>[1]);
		case 'nanda_run_workflow':
			requireStringParam(args, 'workflow_id');
			return execRunWorkflow(ctx.db, args as Parameters<typeof execRunWorkflow>[1]);
		case 'nanda_trust_scores':
			return execTrustScores(ctx.db, args as Parameters<typeof execTrustScores>[1]);
		case 'nanda_compliance_check':
			requireStringParam(args, 'agent_id');
			return execComplianceCheck(ctx.db, args as Parameters<typeof execComplianceCheck>[1]);
		case 'nanda_subscribe_webhook':
			requireStringParam(args, 'url');
			return execSubscribeWebhook(ctx.db, args as Parameters<typeof execSubscribeWebhook>[1]);
		// Switchboard tools
		case 'nanda_discover_agent':
			requireStringParam(args, 'url');
			return execDiscoverAgent(ctx.db, ctx.env, args as { url: string });
		case 'nanda_list_adapters':
			requireStringParam(args, 'agent_id');
			return execListAdapters(ctx.db, args as { agent_id: string });
		case 'nanda_export_agent':
			requireStringParam(args, 'agent_id');
			requireStringParam(args, 'target_protocol');
			return execExportAgent(ctx.db, args as { agent_id: string; target_protocol: string });
		// Payment tools
		case 'nanda_get_exchange_rates':
			return execGetExchangeRates(ctx.env, args as { from?: string; to?: string });
		case 'nanda_get_wallet_balance':
			requireStringParam(args, 'agent_id');
			return execGetWalletBalance(ctx.db, args as { agent_id: string });
		case 'nanda_convert_currency':
			requireStringParam(args, 'from');
			requireStringParam(args, 'to');
			return execConvertCurrency(ctx.env, args as { from: string; to: string; amount: number });
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}
