/**
 * SafeSearch & ZTAA Types — Phase 6 (Agent Hawaii)
 *
 * Agentic SafeSearch for trust-filtered discovery,
 * plus Zero Trust Agentic Access policy interfaces.
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase F
 */

export interface SafeSearchQuery {
	capability?: string;
	exclude_flags?: string[];
	requires_cert?: string[];
	min_trust?: number;
	jurisdiction?: string;
	max_age_days?: number; // Exclude agents registered < N days ago (NSA flag)
	protocol?: string;
}

export interface SafeSearchResult {
	agents: Array<{
		agent_id: string;
		agent_name: string;
		trust_score: number;
		certifications: string[];
		content_flags: string[];
		is_new_agent: boolean; // Registered < 30 days
		protocol?: string;
	}>;
	total: number;
	filters_applied: string[];
}

export interface ZTAAPolicy {
	min_trust_score: number;
	require_vc_auth: boolean;
	allowed_jurisdictions?: string[];
	blocked_content_flags?: string[];
	required_certifications?: string[];
}
