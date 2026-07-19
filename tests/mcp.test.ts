/**
 * NANDA MCP Handler Tests
 *
 * Tests the JSON-RPC 2.0 MCP handler: initialize, tools/list, tools/call,
 * error handling. Runs inside @cloudflare/vitest-pool-workers (miniflare).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { handleMcpRequest, type McpHandlerContext } from '../src/lib/mcp/handler';
import { NANDA_MCP_TOOLS } from '../src/lib/mcp/tools';
import { createDbClient } from '../src/lib/db/client';
import type { Env } from '../src/lib/types';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

// ===================================================================
// DB setup — create required tables
// ===================================================================

const TABLES = [
	`CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL, signature_hex TEXT NOT NULL,
    signer_id TEXT NOT NULL, facts_url TEXT, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
    agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT, status TEXT DEFAULT 'alive',
    version TEXT DEFAULT '1.0.0', deprecated_at INTEGER, sunset_at INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL, p95_latency_ms REAL,
    probe_success REAL, cert_score REAL, reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS certificates (
    cert_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    score REAL NOT NULL, grade TEXT NOT NULL, ci95_lo REAL, ci95_hi REAL,
    n_trials INTEGER NOT NULL, hmac_signature TEXT NOT NULL, ed25519_vc TEXT,
    evidence_uri TEXT, issued_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE TABLE IF NOT EXISTS cert_revocations (
    cert_id TEXT PRIMARY KEY REFERENCES certificates(cert_id),
    reason TEXT NOT NULL, status_list_index INTEGER,
    revoked_at INTEGER DEFAULT (unixepoch()))`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

// ===================================================================
// Helpers
// ===================================================================

const db = createDbClient(env.DB);
const ctx: McpHandlerContext = { db, env: env as unknown as Env };

function jsonRpcRequest(method: string, params?: Record<string, unknown>, id: number | string = 1) {
	return new Request('http://localhost/mcp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
	});
}

function invalidRequest(body: unknown) {
	return new Request('http://localhost/mcp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

async function parseResponse(res: Response) {
	return (await res.json()) as Record<string, unknown>;
}

// ===================================================================
// Tests
// ===================================================================

describe('MCP Handler — initialize', () => {
	it('returns protocol version and server info', async () => {
		const res = await handleMcpRequest(jsonRpcRequest('initialize'), ctx);
		const body = await parseResponse(res);

		expect(res.status).toBe(200);
		expect(body.jsonrpc).toBe('2.0');
		expect(body.id).toBe(1);

		const result = body.result as Record<string, unknown>;
		expect(result.protocolVersion).toBe('2025-03-26');
		expect(result.capabilities).toEqual({ tools: {} });
		expect(result.serverInfo).toEqual({ name: 'nanda-infrastructure-mcp', version: '1.0.0' });
	});
});

describe('MCP Handler — tools/list', () => {
	it('returns all tool definitions', async () => {
		const res = await handleMcpRequest(jsonRpcRequest('tools/list'), ctx);
		const body = await parseResponse(res);

		expect(res.status).toBe(200);
		const result = body.result as { tools: unknown[] };
		expect(result.tools).toHaveLength(NANDA_MCP_TOOLS.length);

		for (const tool of result.tools as Array<Record<string, unknown>>) {
			expect(tool).toHaveProperty('name');
			expect(tool).toHaveProperty('description');
			expect(tool).toHaveProperty('inputSchema');
			const schema = tool.inputSchema as Record<string, unknown>;
			expect(schema.type).toBe('object');
		}
	});

	it('includes all expected tool names', async () => {
		const res = await handleMcpRequest(jsonRpcRequest('tools/list'), ctx);
		const body = await parseResponse(res);
		const result = body.result as { tools: Array<{ name: string }> };
		const names = result.tools.map((t) => t.name);

		expect(names).toContain('nanda_lookup_agent');
		expect(names).toContain('nanda_search_agents');
		expect(names).toContain('nanda_list_agents');
		expect(names).toContain('nanda_get_reputation');
		expect(names).toContain('nanda_check_cert');
		expect(names).toContain('nanda_check_health');
	});
});

describe('MCP Handler — tools/call', () => {
	it('executes nanda_list_agents and returns results', async () => {
		const res = await handleMcpRequest(
			jsonRpcRequest('tools/call', { name: 'nanda_list_agents', arguments: {} }),
			ctx
		);
		const body = await parseResponse(res);
		expect(res.status).toBe(200);
		expect(body.result).toBeDefined();
	});

	it('returns error for unknown tool', async () => {
		const res = await handleMcpRequest(
			jsonRpcRequest('tools/call', { name: 'nonexistent_tool', arguments: {} }),
			ctx
		);
		const body = await parseResponse(res);
		const error = body.error as { code: number; message: string };
		expect(error.code).toBe(-32000);
		expect(error.message).toContain('Unknown tool');
	});

	it('returns -32602 for missing tool name', async () => {
		const res = await handleMcpRequest(jsonRpcRequest('tools/call', {}), ctx);
		const body = await parseResponse(res);
		const error = body.error as { code: number };
		expect(error.code).toBe(-32602);
	});
});

describe('MCP Handler — error handling', () => {
	it('returns -32700 for invalid JSON', async () => {
		const req = new Request('http://localhost/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{not valid json'
		});
		const res = await handleMcpRequest(req, ctx);
		const body = await parseResponse(res);
		const error = body.error as { code: number };
		expect(error.code).toBe(-32700);
	});

	it('returns -32600 for missing method', async () => {
		const res = await handleMcpRequest(invalidRequest({ jsonrpc: '2.0', id: 1 }), ctx);
		const body = await parseResponse(res);
		const error = body.error as { code: number };
		expect(error.code).toBe(-32600);
	});

	it('returns -32600 for wrong jsonrpc version', async () => {
		const res = await handleMcpRequest(
			invalidRequest({ jsonrpc: '1.0', id: 1, method: 'initialize' }),
			ctx
		);
		const body = await parseResponse(res);
		const error = body.error as { code: number };
		expect(error.code).toBe(-32600);
	});

	it('returns -32601 for unknown method', async () => {
		const res = await handleMcpRequest(jsonRpcRequest('unknown/method'), ctx);
		const body = await parseResponse(res);
		const error = body.error as { code: number };
		expect(error.code).toBe(-32601);
	});

	it('preserves JSON-RPC id in error responses', async () => {
		const res = await handleMcpRequest(jsonRpcRequest('unknown/method', {}, 42), ctx);
		const body = await parseResponse(res);
		expect(body.id).toBe(42);
	});
});
