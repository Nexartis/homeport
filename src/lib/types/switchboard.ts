/**
 * Switchboard / Protocol Bridge Types — Phase 6 (Agent California)
 *
 * Types for the Protocol Bridge (Phase E):
 * - RegistryAdapter: interface that each protocol adapter must implement
 * - ProtocolType: supported protocol identifiers
 * - A2AAgentCard: A2A Agent Card format (per spec Section 8.2)
 * - McpDescriptor: MCP tool/server descriptor
 * - NLWebDescriptor: NLWeb endpoint descriptor
 * - DetectedProtocol: result of protocol auto-detection
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase E
 * @see nanda-repos/nanda-index/switchboard/adapters/base_adapter.py
 */

import type { AgentFactsV2Placeholder } from '$lib/types/resolver';

// ── Protocol Types ──

export type ProtocolType = 'a2a' | 'mcp' | 'nlweb' | 'nanda' | 'agntcy' | 'unknown';

export interface DetectedProtocol {
	protocol: ProtocolType;
	url: string;
	confidence: number; // 0.0–1.0
	metadata?: Record<string, unknown>;
}

// ── Registry Adapter Interface ──

/**
 * Interface that each protocol adapter must implement.
 * Mirrors Python BaseRegistryAdapter from switchboard/adapters/base_adapter.py.
 */
export interface RegistryAdapter {
	/** Unique identifier for this adapter's registry/protocol */
	readonly registryId: string;

	/** Query source registry for an agent by identifier */
	queryAgent(agentId: string): Promise<AgentRecord | null>;

	/** Translate source format → NANDA AgentFacts v2 */
	translateToNanda(sourceData: unknown): AgentFactsV2Placeholder;

	/** Translate NANDA AgentFacts v2 → source format (export) */
	translateFromNanda(facts: AgentFactsV2Placeholder): unknown;

	/** Return metadata about this adapter */
	getRegistryInfo(): AdapterInfo;
}

export interface AdapterInfo {
	registryId: string;
	adapterType: string;
	status: 'active' | 'inactive' | 'error';
	supportedProtocols: ProtocolType[];
}

/** Generic agent record from any registry */
export interface AgentRecord {
	agentId: string;
	registryId: string;
	agentName: string;
	version: string;
	description: string;
	capabilities: string[];
	agentUrl: string;
	apiUrl?: string;
	lastUpdated?: string;
	schemaVersion: string;
	sourceSchema: string;
	rawData?: Record<string, unknown>;
}

// ── A2A Agent Card ──

/** A2A Agent Card per A2A Protocol v1.0 Section 8.2 */
export interface A2AAgentCard {
	name: string;
	description: string;
	version: string;
	protocolVersions: string[];
	supportedInterfaces: Array<{
		url: string;
		protocolBinding: string;
		protocolVersion: string;
	}>;
	defaultInputModes: string[];
	defaultOutputModes: string[];
	capabilities: {
		streaming: boolean;
		pushNotifications: boolean;
		stateTransitionHistory: boolean;
		extendedAgentCard: boolean;
		extensions?: Array<{ uri: string; description: string; required: boolean }>;
	};
	skills: Array<{
		id: string;
		name: string;
		description: string;
		tags?: string[];
		inputModes?: string[];
		outputModes?: string[];
	}>;
	provider?: {
		organization: string;
		url: string;
	};
	mcp?: {
		endpoint: string;
		transport: string;
		authentication?: string;
	};
	documentationUrl?: string;
	iconUrl?: string;
}

// ── MCP Descriptor ──

/** Lightweight MCP server/tool descriptor for switchboard interop */
export interface McpDescriptor {
	name: string;
	version: string;
	transport: 'streamable-http' | 'sse' | 'stdio';
	endpoint: string;
	tools: Array<{
		name: string;
		description: string;
		inputSchema: Record<string, unknown>;
	}>;
	authentication?: 'bearer' | 'none';
}

// ── NLWeb Descriptor ──

/** NLWeb endpoint descriptor for natural-language-web interop */
export interface NLWebDescriptor {
	url: string;
	schemaOrgTypes: string[];
	capabilities: string[];
}

// ── Switchboard Result ──

export interface SwitchboardLookupResult {
	agentId: string;
	source: ProtocolType;
	facts: AgentFactsV2Placeholder;
	detectedProtocols: DetectedProtocol[];
	lookupDurationMs: number;
}
