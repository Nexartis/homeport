/**
 * AgentFacts v2 Types — Extended metadata with VC wrapping (Phase 6 — Agent Bali)
 *
 * Adds trust_score, compliance_status, and W3C VC envelope to the existing
 * AgentFacts v1 format. Backward-compatible: v1 documents remain valid.
 */

// ── Core v2 Extensions ──────────────────────────────────────────

export interface AgentFactsV2Extensions {
	/** KYM-computed trust score (0–100) */
	trust_score?: number;
	/** Compliance status from the compliance scanner */
	compliance_status?: 'compliant' | 'non_compliant' | 'pending' | 'exempt';
	/** ISO 8601 timestamp of last compliance scan */
	compliance_checked_at?: string;
	/** Active certifications (cert IDs) */
	certifications?: string[];
	/** Reputation snapshot (latest) */
	reputation?: {
		uptime_pct?: number;
		avg_latency_ms?: number;
		error_rate_pct?: number;
		last_probe_at?: string;
	};
	/** Privacy-preserving FactsURL (optional) */
	private_facts_url?: string;
	/** Disclosure policy for privacy-sensitive fields */
	disclosure_policy?: 'public' | 'authenticated' | 'private';
	/** Schema version — '2.0.0' for v2 documents */
	schema_version: string;
}

/** Full AgentFacts v2 document = v1 blob + v2 extensions */
export interface AgentFactsV2Document {
	// v1 fields (preserved as-is)
	agent_name: string;
	label?: string;
	description?: string;
	version?: string;
	documentationUrl?: string;
	jurisdiction?: string;
	provider?: {
		name?: string;
		url?: string;
		did?: string;
	};
	endpoints?: {
		static?: string[];
		adaptive_resolver?: {
			url?: string;
			policies?: unknown[];
		};
	};
	capabilities?: {
		modalities?: string[];
		streaming?: boolean;
		batch?: boolean;
		authentication?: {
			methods?: unknown[];
			requiredScopes?: unknown[];
		};
	};
	skills?: Array<{
		id?: string;
		name?: string;
		description?: string;
		category?: string;
		input_modes?: string[];
		output_modes?: string[];
	}>;
	evaluations?: unknown;
	telemetry?: unknown;
	certification?: unknown;
	cert_level?: string;

	// v2 extensions
	trust_score?: number;
	compliance_status?: AgentFactsV2Extensions['compliance_status'];
	compliance_checked_at?: string;
	certifications?: string[];
	reputation?: AgentFactsV2Extensions['reputation'];
	private_facts_url?: string;
	disclosure_policy?: AgentFactsV2Extensions['disclosure_policy'];
	schema_version?: string;
}

// ── W3C Verifiable Credential Envelope ──────────────────────────

export interface AgentFactsVC {
	'@context': string[];
	type: string[];
	id: string;
	issuer: string;
	issuanceDate: string;
	expirationDate?: string;
	credentialSubject: AgentFactsV2Document & { id: string };
	credentialStatus?: {
		id: string;
		type: string;
		statusPurpose: string;
		statusListIndex: string;
		statusListCredential: string;
	};
	proof?: {
		type: string;
		created: string;
		verificationMethod: string;
		proofPurpose: string;
		proofValue: string;
	};
}

// ── Validation ──────────────────────────────────────────────────

const V2_REQUIRED_FIELDS = ['agent_name'] as const;

/** Validate an AgentFacts v2 document. Returns list of errors (empty = valid). */
export function validateAgentFactsV2(doc: Record<string, unknown>): string[] {
	const errors: string[] = [];
	for (const field of V2_REQUIRED_FIELDS) {
		if (doc[field] === undefined || doc[field] === null) {
			errors.push(`Missing required field: ${field}`);
		}
	}
	if (doc.trust_score !== undefined) {
		const score = doc.trust_score as number;
		if (typeof score !== 'number' || score < 0 || score > 100) {
			errors.push('trust_score must be a number between 0 and 100');
		}
	}
	if (doc.compliance_status !== undefined) {
		const valid = ['compliant', 'non_compliant', 'pending', 'exempt'];
		if (!valid.includes(doc.compliance_status as string)) {
			errors.push(`compliance_status must be one of: ${valid.join(', ')}`);
		}
	}
	if (doc.disclosure_policy !== undefined) {
		const valid = ['public', 'authenticated', 'private'];
		if (!valid.includes(doc.disclosure_policy as string)) {
			errors.push(`disclosure_policy must be one of: ${valid.join(', ')}`);
		}
	}
	return errors;
}

/** Detect schema version from a facts document. */
export function detectSchemaVersion(doc: Record<string, unknown>): '1.0.0' | '2.0.0' {
	if (doc.schema_version === '2.0.0') return '2.0.0';
	if (doc.trust_score !== undefined || doc.compliance_status !== undefined) return '2.0.0';
	return '1.0.0';
}
