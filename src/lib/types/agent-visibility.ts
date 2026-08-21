/**
 * Agent Visibility & Metadata Types — Set C Wire Contract v1
 *
 * Visibility lifecycle for agent registrations plus the capability
 * manifest, MCP metadata, and pricing descriptors that travel with a
 * registration.
 *
 * Wire contract v1 (snake_case on the REST surface):
 *  - `visibility` — 'private' | 'unlisted' | 'public' | 'for_hire'
 *    Storage default is 'public'; NULL/missing values are treated as 'public'.
 *  - `capability_manifest` — JSON array of CapabilityManifestEntry
 *  - `mcp_metadata` — McpMetadata object
 *  - `pricing` — PricingDescriptor object
 *
 * Discovery rules enforced by the registry and federation layers:
 *  - /search and /list return ONLY visibility IN ('public', 'for_hire')
 *  - /lookup/:id serves public/unlisted/for_hire and returns 404 for private
 *  - Federation gossip propagates ONLY public/for_hire rows
 */

export const AGENT_VISIBILITIES = ['private', 'unlisted', 'public', 'for_hire'] as const;
export type AgentVisibility = (typeof AGENT_VISIBILITIES)[number];

/** Visibilities that appear in discovery surfaces (/search, /list) and federation gossip. */
export const DISCOVERABLE_VISIBILITIES: readonly AgentVisibility[] = ['public', 'for_hire'];

export const PRICING_MODELS = ['free', 'per_request', 'subscription', 'usage'] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const CAPABILITY_AUTH_TYPES = ['none', 'bearer', 'oauth2', 'api_key', 'custom'] as const;
export type CapabilityAuthType = (typeof CAPABILITY_AUTH_TYPES)[number];

export const MCP_TRANSPORTS = ['streamable-http', 'sse', 'stdio'] as const;
export type McpTransport = (typeof MCP_TRANSPORTS)[number];

/** Pricing descriptor — how an agent (or capability/tool) charges for use. */
export interface PricingDescriptor {
	model: PricingModel;
	currency?: string;
	price?: number;
	unit?: string;
}

/** One capability exposed by an agent. capability_manifest is an array of these. */
export interface CapabilityManifestEntry {
	id: string;
	name?: string;
	description?: string;
	auth?: CapabilityAuthType;
	pricing?: PricingDescriptor;
}

/** MCP server metadata advertised by an agent. */
export interface McpMetadata {
	endpoint?: string;
	transport?: McpTransport;
	authentication?: CapabilityAuthType;
	tools?: Array<{
		name: string;
		description?: string;
		auth_required?: boolean;
		pricing?: PricingDescriptor;
	}>;
}

/**
 * Normalize a raw visibility value: NULL/missing/empty → 'public'.
 * Returns null when the value is present but invalid (caller decides the error).
 */
export function normalizeVisibility(raw: unknown): AgentVisibility | null {
	if (raw === undefined || raw === null || raw === '') return 'public';
	if (typeof raw !== 'string') return null;
	return (AGENT_VISIBILITIES as readonly string[]).includes(raw) ? (raw as AgentVisibility) : null;
}

/** True when the visibility is discoverable (public or for_hire). */
export function isDiscoverableVisibility(visibility: string | null | undefined): boolean {
	const v = normalizeVisibility(visibility) ?? 'public';
	return (DISCOVERABLE_VISIBILITIES as readonly string[]).includes(v);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate a PricingDescriptor. Returns an error message or null when valid. */
export function validatePricingDescriptor(value: unknown, at = 'pricing'): string | null {
	if (!isRecord(value)) return `${at} must be an object`;
	if (!(PRICING_MODELS as readonly string[]).includes(value.model as string)) {
		return `${at}.model must be one of: ${PRICING_MODELS.join(', ')}`;
	}
	if (value.currency !== undefined && typeof value.currency !== 'string') {
		return `${at}.currency must be a string`;
	}
	if (value.price !== undefined && typeof value.price !== 'number') {
		return `${at}.price must be a number`;
	}
	if (value.unit !== undefined && typeof value.unit !== 'string') {
		return `${at}.unit must be a string`;
	}
	return null;
}

/** Validate a capability_manifest (JSON array of CapabilityManifestEntry). */
export function validateCapabilityManifest(value: unknown): string | null {
	if (!Array.isArray(value)) return 'capability_manifest must be an array';
	for (let i = 0; i < value.length; i++) {
		const entry = value[i];
		const at = `capability_manifest[${i}]`;
		if (!isRecord(entry)) return `${at} must be an object`;
		if (typeof entry.id !== 'string' || entry.id.length === 0) {
			return `${at}.id must be a non-empty string`;
		}
		if (entry.name !== undefined && typeof entry.name !== 'string') {
			return `${at}.name must be a string`;
		}
		if (entry.description !== undefined && typeof entry.description !== 'string') {
			return `${at}.description must be a string`;
		}
		if (
			entry.auth !== undefined &&
			!(CAPABILITY_AUTH_TYPES as readonly string[]).includes(entry.auth as string)
		) {
			return `${at}.auth must be one of: ${CAPABILITY_AUTH_TYPES.join(', ')}`;
		}
		if (entry.pricing !== undefined) {
			const err = validatePricingDescriptor(entry.pricing, `${at}.pricing`);
			if (err) return err;
		}
	}
	return null;
}

/** Validate an mcp_metadata object. */
export function validateMcpMetadata(value: unknown): string | null {
	if (!isRecord(value)) return 'mcp_metadata must be an object';
	if (value.endpoint !== undefined && typeof value.endpoint !== 'string') {
		return 'mcp_metadata.endpoint must be a string';
	}
	if (
		value.transport !== undefined &&
		!(MCP_TRANSPORTS as readonly string[]).includes(value.transport as string)
	) {
		return `mcp_metadata.transport must be one of: ${MCP_TRANSPORTS.join(', ')}`;
	}
	if (
		value.authentication !== undefined &&
		!(CAPABILITY_AUTH_TYPES as readonly string[]).includes(value.authentication as string)
	) {
		return `mcp_metadata.authentication must be one of: ${CAPABILITY_AUTH_TYPES.join(', ')}`;
	}
	if (value.tools !== undefined) {
		if (!Array.isArray(value.tools)) return 'mcp_metadata.tools must be an array';
		for (let i = 0; i < value.tools.length; i++) {
			const tool = value.tools[i];
			const at = `mcp_metadata.tools[${i}]`;
			if (!isRecord(tool)) return `${at} must be an object`;
			if (typeof tool.name !== 'string' || tool.name.length === 0) {
				return `${at}.name must be a non-empty string`;
			}
			if (tool.description !== undefined && typeof tool.description !== 'string') {
				return `${at}.description must be a string`;
			}
			if (tool.auth_required !== undefined && typeof tool.auth_required !== 'boolean') {
				return `${at}.auth_required must be a boolean`;
			}
			if (tool.pricing !== undefined) {
				const err = validatePricingDescriptor(tool.pricing, `${at}.pricing`);
				if (err) return err;
			}
		}
	}
	return null;
}

/** Safely parse a stored JSON column, returning null on missing/invalid JSON. */
export function safeParseJsonColumn(raw: string | null | undefined): unknown {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
