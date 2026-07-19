/**
 * Resolver Types — Phase 6 (Agent California)
 *
 * Types for the Adaptive Resolver (Phase C):
 * - ResolutionContext: client-provided context for adaptive resolution
 * - ResolvedEndpoint: a scored, ranked endpoint in the resolution result
 * - ResolutionResult: the full resolution response
 * - ScoringWeights: configurable weights for composite scoring
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase C
 * @see arXiv:2508.03113 — NANDA Adaptive Resolver
 */

// ── Placeholder types for Bali's AgentAddr / AgentFactsV2 ──
// These will be replaced with imports from '$lib/types/agent-addr' and
// '$lib/types/agentfacts-v2' once Bali's code lands on the shared branch.

export interface AgentAddrPlaceholder {
	agent_id: string;
	public_key_hex: string;
	facts_url: string;
	private_url?: string;
	resolver_url?: string;
	ttl_seconds: number;
	signature_hex: string;
	signer_id: string;
	source: string;
	quilt_type: string;
}

export interface AgentFactsV2Placeholder {
	agent_name: string;
	label?: string;
	description?: string;
	version?: string;
	provider?: { name: string; url?: string; did?: string };
	endpoints?: {
		static?: Array<{ url: string; protocol: string }>;
		adaptive_resolver?: string;
	};
	capabilities?: {
		modalities?: string[];
		auth?: string[];
		streaming?: boolean;
		batch?: boolean;
	};
	skills?: Array<{
		id: string;
		name?: string;
		description?: string;
		inputModes?: string[];
		outputModes?: string[];
	}>;
	evaluations?: {
		performanceScore?: number;
		availability90d?: number;
	};
	trust_certifications?: string[];
	reputation_scores?: {
		reliability?: number;
		security?: number;
		fairness?: number;
	};
	content_flags?: string[];
}

// ── Resolution Context ──

export interface ResolutionContext {
	requester_id?: string;
	requester_location?: string; // ISO 3166-1 alpha-2
	required_capabilities?: string[];
	min_trust_score?: number; // 0.0–1.0
	max_latency_ms?: number;
	protocol_preference?: 'a2a' | 'mcp' | 'https' | 'nlweb' | 'any';
	security_context?: {
		require_tls: boolean;
		require_vc_auth: boolean;
		compliance_requirements?: string[];
	};
}

// ── Resolved Endpoint ──

export interface ResolvedEndpoint {
	url: string;
	protocol: string;
	score: number; // 0.0–1.0 composite ranking
	latency_estimate_ms: number;
	trust_score: number;
	capabilities: string[];
	connection_params: Record<string, string>;
	health_status: 'healthy' | 'degraded' | 'unknown';
}

// ── Resolution Result ──

export interface ResolutionResult {
	agent_id: string;
	strategy: ResolutionStrategy;
	endpoints: ResolvedEndpoint[];
	resolved_at: number;
	ttl_seconds: number;
}

// ── Strategy + Weights ──

export type ResolutionStrategy = 'static' | 'rotating' | 'adaptive';

export interface ScoringWeights {
	geo_proximity: number; // default 0.25
	trust_score: number; // default 0.30
	capability_match: number; // default 0.25
	health: number; // default 0.20
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
	geo_proximity: 0.25,
	trust_score: 0.3,
	capability_match: 0.25,
	health: 0.2
};

// ── Health data from Observer probes ──

export interface HealthProbeData {
	success_rate: number; // 0.0–1.0
	p95_latency_ms: number;
}
