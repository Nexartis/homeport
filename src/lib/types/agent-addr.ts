/**
 * AgentAddr Types — Lean Index data model (Phase 6 — Agent Bali)
 *
 * Signed pointers from agent_id → AgentFacts URL, compatible with the
 * MIT NANDA Index spec (arXiv:2507.14263).
 *
 * ─── Signing Model ───────────────────────────────────────────────
 * We use Ed25519 for our own records (fast, Workers-compatible).
 * AGNTCY uses Sigstore keyless signing (OIDC + ephemeral certs).
 * Imported AGNTCY records may carry Sigstore signatures — stored in
 * annotations['sigstore.signature'] but NOT verified locally (requires
 * the `dirctl` CLI for full Sigstore verification).
 * ─────────────────────────────────────────────────────────────────
 */

// ── Core Types ──────────────────────────────────────────────────

export interface AgentAddr {
	agent_id: string; // e.g., "@agentx" or "urn:nanda:agent:agentx"
	public_key_hex: string; // Ed25519 public key (hex-encoded)
	facts_url: string | null; // Primary AgentFacts URL (null for agents without AgentFacts)
	private_url?: string; // Privacy-preserving FactsURL (optional)
	resolver_url?: string; // Adaptive Resolver URL (optional)
	ttl_seconds: number; // Cache TTL (default 300)
	signature_hex: string; // Ed25519 signature over canonical record
	signer_id: string; // DID or registry ID of signer
	created_at: number; // Unix timestamp
	updated_at: number; // Unix timestamp
	expires_at?: number; // Optional hard expiry
	source: 'local' | string; // 'local' or peer URL
	quilt_type: 'native' | 'gov' | 'enterprise' | 'web3';
	content_id?: string; // AGNTCY OCI Content Identifier (SHA-256 CID)
}

export interface AgentAddrCreateInput {
	agent_id: string;
	facts_url: string | null;
	private_url?: string;
	resolver_url?: string;
	ttl_seconds?: number; // Default 300
	quilt_type?: AgentAddr['quilt_type'];
}

export interface AgentAddrResolution {
	agent_addr: AgentAddr;
	cached: boolean;
	resolved_at: number;
}

/** Fields included in canonical serialization for signing (sorted keys, no whitespace) */
export type AgentAddrSignable = Pick<
	AgentAddr,
	| 'agent_id'
	| 'public_key_hex'
	| 'facts_url'
	| 'private_url'
	| 'resolver_url'
	| 'ttl_seconds'
	| 'signer_id'
>;

// ── OASF Interop Types ──────────────────────────────────────────

export interface OASFSkill {
	skill_id: string; // e.g., "text_classification"
	category_name: string; // e.g., "Natural Language Processing"
	category_uid: number; // e.g., 1
	class_name: string; // e.g., "Text Classification"
	class_uid: number; // e.g., 9
}

export interface OASFRecord {
	name: string;
	version: string;
	schema_version: string;
	description: string;
	authors: string[];
	created_at: string; // ISO 8601
	skills: string[];
	domains: string[];
	locators: Array<{ url: string; protocol?: string }>;
	modules: string[];
	annotations: Record<string, unknown>;
}

// ── OASF Conversion Functions ───────────────────────────────────

/**
 * Convert an AgentAddr to a valid OASF record.
 * Trust/privacy fields go into annotations with `nanda.trust/` prefix keys.
 */
export function toOASFRecord(
	addr: AgentAddr,
	extra?: {
		description?: string;
		skills?: string[];
		trust_certifications?: string[];
		reputation_scores?: Record<string, number>;
		content_flags?: string[];
		private_facts_url?: string;
		disclosure_policy?: string;
	}
): OASFRecord {
	const annotations: Record<string, unknown> = {};

	if (extra?.trust_certifications) {
		annotations['nanda.trust/certifications'] = extra.trust_certifications;
	}
	if (extra?.reputation_scores) {
		annotations['nanda.trust/reputation_scores'] = extra.reputation_scores;
	}
	if (extra?.content_flags) {
		annotations['nanda.trust/content_flags'] = extra.content_flags;
	}
	if (extra?.private_facts_url) {
		annotations['nanda.trust/private_facts_url'] = extra.private_facts_url;
	}
	if (extra?.disclosure_policy) {
		annotations['nanda.trust/disclosure_policy'] = extra.disclosure_policy;
	}
	if (addr.content_id) {
		annotations['agntcy.content_id'] = addr.content_id;
	}

	return {
		name: addr.agent_id,
		version: '1.0.0',
		schema_version: '1.0.0',
		description: extra?.description ?? `Agent ${addr.agent_id}`,
		authors: [addr.signer_id],
		created_at: new Date(addr.created_at * 1000).toISOString(),
		skills: extra?.skills ?? [],
		domains: [],
		locators: [
			...(addr.facts_url ? [{ url: addr.facts_url, protocol: 'https' }] : []),
			...(addr.resolver_url ? [{ url: addr.resolver_url, protocol: 'https' }] : [])
		],
		modules: [],
		annotations
	};
}

/**
 * Import an OASF record into our AgentAddr format (partial — caller supplies keys & signature).
 */
export function fromOASFRecord(record: OASFRecord): Partial<AgentAddr> {
	const locator = record.locators?.[0];
	return {
		agent_id: record.name,
		facts_url: locator?.url ?? '',
		source: 'local',
		quilt_type: 'native',
		content_id: (record.annotations?.['agntcy.content_id'] as string) ?? undefined
	};
}
