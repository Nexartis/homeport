/**
 * MCP Adapter — Maps MCP server/tool descriptor ↔ AgentFacts v2
 * Phase 6 — Agent California
 *
 * Implements RegistryAdapter for MCP-protocol agents:
 *   - queryAgent: probes MCP endpoint via initialize + tools/list
 *   - translateToNanda: maps MCP descriptor → AgentFacts v2
 *   - translateFromNanda: maps AgentFacts v2 → MCP descriptor
 *
 * @see MCP Protocol 2025-03-26
 */

import type {
	RegistryAdapter,
	McpDescriptor,
	AgentRecord,
	AdapterInfo
} from '$lib/types/switchboard';
import type { AgentFactsV2Placeholder } from '$lib/types/resolver';
import { isSafeUrl } from './protocol-detector';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'mcp-adapter');

const FETCH_TIMEOUT_MS = 8000;

export class McpAdapter implements RegistryAdapter {
	readonly registryId = 'mcp';

	async queryAgent(agentUrl: string): Promise<AgentRecord | null> {
		if (!isSafeUrl(agentUrl)) {
			log.warn('queryAgent', `SSRF blocked: ${agentUrl}`);
			return null;
		}

		const baseUrl = agentUrl.replace(/\/+$/, '');
		const mcpUrl = `${baseUrl}/mcp`;

		try {
			// Step 1: Initialize
			const initRes = await fetch(mcpUrl, {
				method: 'POST',
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 })
			});

			if (!initRes.ok) return null;

			const initData = (await initRes.json()) as {
				jsonrpc: string;
				result?: { serverInfo?: { name?: string; version?: string } };
			};
			if (initData.jsonrpc !== '2.0' || !initData.result) return null;

			const serverInfo = initData.result.serverInfo ?? {};

			// Step 2: List tools
			const toolsRes = await fetch(mcpUrl, {
				method: 'POST',
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 2 })
			});

			let tools: Array<{
				name: string;
				description?: string;
				inputSchema?: Record<string, unknown>;
			}> = [];
			if (toolsRes.ok) {
				const toolsData = (await toolsRes.json()) as {
					result?: {
						tools?: Array<{
							name: string;
							description?: string;
							inputSchema?: Record<string, unknown>;
						}>;
					};
				};
				tools = toolsData.result?.tools ?? [];
			}

			return {
				agentId: `@mcp:${serverInfo.name ?? 'unknown'}`,
				registryId: 'mcp',
				agentName: serverInfo.name ?? 'unknown',
				version: serverInfo.version ?? 'v1.0.0',
				description: `MCP server with ${tools.length} tool(s)`,
				capabilities: tools.map((t) => t.name),
				agentUrl: baseUrl,
				apiUrl: mcpUrl,
				schemaVersion: 'mcp-2025',
				sourceSchema: 'mcp',
				rawData: { serverInfo, tools }
			};
		} catch (err) {
			log.error('queryAgent', `Failed to probe MCP at ${agentUrl}`, {
				error: err instanceof Error ? err.message : String(err)
			});
			return null;
		}
	}

	translateToNanda(sourceData: unknown): AgentFactsV2Placeholder {
		const desc = sourceData as McpDescriptor;
		return {
			agent_name: desc.name,
			version: desc.version,
			description: `MCP server (${desc.transport}) with ${desc.tools.length} tool(s)`,
			endpoints: {
				static: [{ url: desc.endpoint, protocol: 'mcp' }]
			},
			capabilities: {
				modalities: ['application/json']
			},
			skills: desc.tools.map((t) => ({
				id: t.name,
				name: t.name,
				description: t.description,
				inputModes: ['application/json'],
				outputModes: ['application/json']
			}))
		};
	}

	translateFromNanda(facts: AgentFactsV2Placeholder): McpDescriptor {
		const endpoint = facts.endpoints?.static?.[0]?.url ?? '';
		return {
			name: facts.agent_name,
			version: facts.version ?? '1.0.0',
			transport: 'streamable-http',
			endpoint,
			tools:
				facts.skills?.map((s) => ({
					name: s.id,
					description: s.description ?? s.name ?? s.id,
					inputSchema: { type: 'object', properties: {} }
				})) ?? [],
			authentication: 'bearer'
		};
	}

	getRegistryInfo(): AdapterInfo {
		return {
			registryId: 'mcp',
			adapterType: 'McpAdapter',
			status: 'active',
			supportedProtocols: ['mcp']
		};
	}
}
