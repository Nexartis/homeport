/**
 * Compliance Enforcer Service — Policy Decision Point (PDP) for NANDA agents.
 *
 * Provides geo-fencing, capability gating, PII redaction, and EU personal-data
 * compliance. All policy decisions are logged to D1; active policies are cached
 * in KV with a 5-minute TTL.
 *
 * Reference: nexartis-forks/nanda-infrastructure/agents/compliance_enforcer/langchain_compliance.py
 */

import type { DbClient } from '$lib/db/client';
import { getPolicyRules, insertDecision, insertViolation } from '$lib/db/repositories';

// ---------------------------------------------------------------------------
// PII Redaction
// ---------------------------------------------------------------------------

/** RFC 5322–style email matcher */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** NANP / international phone matcher (optional +1, optional parens) */
const PHONE_RE = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Replace PII tokens (email, phone) with redaction placeholders.
 * @param text - The raw text to scrub.
 * @returns Sanitised text with PII replaced.
 */
export function redactText(text: string): string {
	if (!text) return text;
	return text.replace(EMAIL_RE, '[REDACTED_EMAIL]').replace(PHONE_RE, '[REDACTED_PHONE]');
}

/**
 * Deep-clone a {@link PolicyEnvelope} and apply PII redaction to every
 * `.text` field in its `parts` array.
 * **Never mutates the input** — callers can safely compare before/after.
 *
 * Matches the Python reference `redact_envelope()` which returns a full
 * deep-cloned envelope (not just the parts array).
 *
 * @param envelope - The envelope to redact.
 * @returns A new envelope with redacted text fields in `parts`.
 */
export function redactEnvelope(envelope: PolicyEnvelope): PolicyEnvelope {
	// Deep-clone the envelope to avoid mutating the original
	const clone: PolicyEnvelope = JSON.parse(JSON.stringify(envelope));
	if (clone.parts) {
		clone.parts = clone.parts.map((p) => {
			if (typeof p.text === 'string') {
				return { ...p, text: redactText(p.text) };
			}
			return p;
		});
	}
	return clone;
}

// ---------------------------------------------------------------------------
// Policy Types
// ---------------------------------------------------------------------------

/** Shape of a policy ruleset stored in `compliance_policies.rules_json`. */
export interface PolicyRules {
	/** Allowed region pairs, e.g. [["USA","EU"], ["EU","EU"]] */
	region_pairs_allow: string[][];
	/** Capabilities unconditionally allowed */
	capability_allowlist: string[];
	/** Capabilities unconditionally denied */
	capability_denylist: string[];
	/** Capabilities that trigger manual escalation */
	escalation_list: string[];
	/** Whether EU personal-data redaction rules are active */
	eu_personal_data_flag: boolean;
	/** Region → model route hints (e.g. { "EU": "eu-model", "US": "us-model" }) */
	model_route?: Record<string, string>;
}

/** Envelope submitted to the PDP for evaluation. */
export interface PolicyEnvelope {
	from_agent: string;
	to_agent: string;
	capability: string;
	from_region?: string;
	to_region?: string;
	parts?: Array<{ text?: string }>;
	eu_personal_data?: boolean;
	/** Data classification tags (e.g. ["personal_data"]) per Python reference. */
	data_classes?: string[];
}

/** Possible PDP outcomes. */
export type PolicyDecision = 'ALLOW' | 'DENY' | 'ESCALATE' | 'ALLOW_WITH_REDACTION';

/** Full result returned by {@link evaluatePolicy}. */
export interface PolicyResult {
	decision: PolicyDecision;
	reasons: string[];
	/** Ordered list of actions the caller should take (per Python reference). */
	actions: string[];
	/** Full deep-cloned envelope with PII redacted (replaces legacy `redacted_parts`). */
	transformed_envelope?: PolicyEnvelope;
}

// ---------------------------------------------------------------------------
// Default Policy (hardcoded fallback)
// ---------------------------------------------------------------------------

const DEFAULT_POLICY: PolicyRules = {
	region_pairs_allow: [
		['USA', 'USA'],
		['USA', 'EU'],
		['EU', 'EU'],
		['EU', 'USA']
	],
	capability_allowlist: ['text-generation', 'chat', 'math', 'qa'],
	capability_denylist: ['weapons', 'exploitation'],
	escalation_list: ['payment', 'financial-advice', 'identity-verify'],
	eu_personal_data_flag: true,
	model_route: { EU: 'eu-model', USA: 'us-model' }
};

// ---------------------------------------------------------------------------
// Shared Crypto Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hex digest of an arbitrary string.
 * Uses the Web Crypto API (Workers-native, no Node imports).
 *
 * @param data - The string to hash.
 * @returns Lowercase hex-encoded SHA-256 digest.
 */
async function sha256Hex(data: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recursively sort all keys in a JSON-serialisable value.
 * Matches Python `json.dumps(sort_keys=True)` which recursively sorts nested objects.
 *
 * @param value - Any JSON-serialisable value.
 * @returns A new value with all object keys sorted at every nesting level.
 */
function deepSortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(deepSortKeys);
	}
	if (value !== null && typeof value === 'object') {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return value;
}

/**
 * HMAC-SHA256 sign a JSON-serialisable object (deterministic: recursively sorted keys, no spaces).
 * Matches the Python reference `hmac_sign()` which uses `json.dumps(data, separators=(",",":"), sort_keys=True)`.
 *
 * @param data   - The data to sign.
 * @param secret - The HMAC secret string.
 * @returns Lowercase hex-encoded HMAC-SHA256 signature.
 */
export async function hmacSign(data: unknown, secret: string): Promise<string> {
	const msg = JSON.stringify(deepSortKeys(data));
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Policy Loading (KV-cached, D1 fallback, hardcoded default)
// ---------------------------------------------------------------------------

/** KV key prefix — must not collide with rate-limit keys (`rl:*`). */
const KV_PREFIX = 'compliance:policy:';

/** Cache TTL in seconds (5 minutes). */
const CACHE_TTL = 300;

/**
 * Validate that a parsed JSON object has the expected {@link PolicyRules} shape.
 * Returns `true` only if all required properties exist with the correct types.
 */
function isValidPolicyRules(obj: unknown): obj is PolicyRules {
	if (!obj || typeof obj !== 'object') return false;
	const o = obj as Record<string, unknown>;
	return (
		Array.isArray(o.region_pairs_allow) &&
		o.region_pairs_allow.every(
			(pair: unknown) =>
				Array.isArray(pair) &&
				pair.length === 2 &&
				pair.every((s: unknown) => typeof s === 'string')
		) &&
		Array.isArray(o.capability_allowlist) &&
		o.capability_allowlist.every((s: unknown) => typeof s === 'string') &&
		Array.isArray(o.capability_denylist) &&
		o.capability_denylist.every((s: unknown) => typeof s === 'string') &&
		Array.isArray(o.escalation_list) &&
		o.escalation_list.every((s: unknown) => typeof s === 'string') &&
		typeof o.eu_personal_data_flag === 'boolean' &&
		(o.model_route === undefined || (typeof o.model_route === 'object' && o.model_route !== null))
	);
}

/**
 * Load the active policy ruleset. Resolution order:
 * 1. KV cache hit → return immediately.
 * 2. D1 lookup → parse, validate, cache to KV, return.
 * 3. Neither → return {@link DEFAULT_POLICY}.
 *
 * @param db       - D1 database binding.
 * @param kv       - KV namespace binding.
 * @param policyId - Optional policy identifier (defaults to `'default'`).
 * @returns The resolved {@link PolicyRules}.
 */
export async function loadPolicy(
	db: DbClient,
	kv: KVNamespace,
	policyId?: string
): Promise<PolicyRules> {
	const id = policyId ?? 'default';
	const kvKey = `${KV_PREFIX}${id}`;

	// 1. KV cache
	const cached = await kv.get(kvKey);
	if (cached) {
		try {
			const parsed: unknown = JSON.parse(cached);
			if (isValidPolicyRules(parsed)) return parsed;
			// Invalid shape in cache — fall through to D1
		} catch {
			// Corrupted cache entry — fall through to D1
		}
	}

	// 2. D1 lookup via Drizzle repo
	const row = await getPolicyRules(db, id);

	if (row) {
		try {
			const parsed: unknown = JSON.parse(row.rulesJson);
			if (isValidPolicyRules(parsed)) {
				await kv.put(kvKey, JSON.stringify(parsed), { expirationTtl: CACHE_TTL });
				return parsed;
			}
			// Invalid shape in D1 — fall through to default
		} catch {
			// Malformed JSON in D1 — fall through to default
		}
	}

	// 3. Hardcoded default
	await kv.put(kvKey, JSON.stringify(DEFAULT_POLICY), { expirationTtl: CACHE_TTL });
	return DEFAULT_POLICY;
}

// ---------------------------------------------------------------------------
// Policy Evaluation — 4-Step PDP
// ---------------------------------------------------------------------------

/**
 * Evaluate a message envelope against the active compliance policy.
 *
 * **Step 1 — Region pair gate:**
 *   If `region_pairs_allow` is non-empty and the `[from_region, to_region]`
 *   pair is not listed → DENY.
 *
 * **Step 2 — Capability gate:**
 *   - Denied capability → DENY.
 *   - Allowlist is non-empty and capability not in it → DENY.
 *   - Escalation list match → ESCALATE.
 *
 * **Step 3 — EU personal data:**
 *   If `eu_personal_data_flag` is active and `envelope.eu_personal_data` is
 *   truthy → ALLOW_WITH_REDACTION (PII scrubbed in `transformed_envelope`).
 *
 * **Step 4 — Default ALLOW.**
 *
 * @param db         - D1 database binding.
 * @param kv         - KV namespace binding.
 * @param envelope   - The message envelope to evaluate.
 * @param policyId   - Optional policy identifier.
 * @param context    - Optional evaluation context (forwarded to decision log per Python reference).
 * @returns The {@link PolicyResult} with decision, reasons, actions, and optional transformed envelope.
 */
export async function evaluatePolicy(
	db: DbClient,
	kv: KVNamespace,
	envelope: PolicyEnvelope,
	policyId?: string,
	_context?: Record<string, unknown>
): Promise<PolicyResult> {
	if (!envelope.from_agent) {
		throw new Error('[evaluatePolicy] missing from_agent');
	}
	if (!envelope.to_agent) {
		throw new Error('[evaluatePolicy] missing to_agent');
	}
	if (!envelope.capability) {
		throw new Error('[evaluatePolicy] missing capability');
	}

	const rules = await loadPolicy(db, kv, policyId);
	const reasons: string[] = [];

	// Step 1: Region pair check
	const fromRegion = (envelope.from_region ?? '').toUpperCase();
	const toRegion = (envelope.to_region ?? '').toUpperCase();

	if (rules.region_pairs_allow.length > 0) {
		if (!fromRegion || !toRegion) {
			// Missing region data with active geo-fencing → DENY
			return {
				decision: 'DENY' as PolicyDecision,
				reasons: [
					'Region data required when geo-fencing is active but from_region or to_region is missing'
				],
				actions: []
			};
		}
		const pairAllowed = rules.region_pairs_allow.some(
			([from, to]) => from.toUpperCase() === fromRegion && to.toUpperCase() === toRegion
		);
		if (!pairAllowed) {
			return {
				decision: 'DENY',
				reasons: [`Region pair [${fromRegion}, ${toRegion}] is not allowed`],
				actions: []
			};
		}
		reasons.push(`Region pair [${fromRegion}, ${toRegion}] allowed`);
	}

	// Step 2: Capability gate
	const cap = envelope.capability;

	if (rules.capability_denylist.includes(cap)) {
		return {
			decision: 'DENY',
			reasons: [`Capability '${cap}' is explicitly denied`],
			actions: []
		};
	}

	if (rules.escalation_list.includes(cap)) {
		return {
			decision: 'ESCALATE',
			reasons: [`Capability '${cap}' requires manual review`],
			actions: ['notify:policy']
		};
	}

	if (rules.capability_allowlist.length > 0 && !rules.capability_allowlist.includes(cap)) {
		return {
			decision: 'DENY',
			reasons: [`Capability '${cap}' is not in the allowlist`],
			actions: []
		};
	}

	// Step 3: EU personal data
	// Check both legacy `eu_personal_data` flag and `data_classes` per Python reference
	const dataClasses = (envelope.data_classes ?? []).map((s) => s.toLowerCase());
	const hasPersonalData = envelope.eu_personal_data || dataClasses.includes('personal_data');
	const isEuFlow = toRegion === 'EU' || fromRegion === 'EU';

	if (rules.eu_personal_data_flag && hasPersonalData && isEuFlow) {
		const transformed = redactEnvelope(envelope);
		const actions = ['redact:pii'];
		// Add model route hint for EU if configured
		const mr = rules.model_route?.[toRegion];
		if (mr) actions.push(`route:${mr}`);
		reasons.push('EU personal data detected — PII redacted');
		return {
			decision: 'ALLOW_WITH_REDACTION',
			reasons,
			actions,
			transformed_envelope: transformed
		};
	}

	// Step 4: Default ALLOW
	const actions: string[] = [];
	// Add route hint for target region if configured (per Python reference)
	const mr = rules.model_route?.[toRegion];
	if (mr) actions.push(`route:${mr}`);
	reasons.push('All policy checks passed');
	return { decision: 'ALLOW', reasons, actions };
}

// ---------------------------------------------------------------------------
// Decision Logging
// ---------------------------------------------------------------------------

/**
 * Persist a policy decision to the `compliance_decisions` table.
 *
 * @param db       - D1 database binding.
 * @param envelope - The evaluated envelope.
 * @param result   - The PDP result.
 * @returns Object containing the generated `decision_id`.
 */
export async function logDecision(
	db: DbClient,
	envelope: PolicyEnvelope,
	result: PolicyResult
): Promise<{ decision_id: string }> {
	if (!envelope || !envelope.from_agent) {
		throw new Error('[logDecision] missing or invalid envelope');
	}
	if (!result || !result.decision) {
		throw new Error('[logDecision] missing or invalid result');
	}

	const decision_id = crypto.randomUUID();
	const envelope_hash = await sha256Hex(JSON.stringify(envelope));

	await insertDecision(db, {
		decisionId: decision_id,
		envelopeHash: envelope_hash,
		fromAgent: envelope.from_agent,
		toAgent: envelope.to_agent,
		capability: envelope.capability,
		decision: result.decision,
		reasons: JSON.stringify(result.reasons),
		createdAt: Math.floor(Date.now() / 1000)
	});

	return { decision_id };
}

// ---------------------------------------------------------------------------
// Violation Reporting
// ---------------------------------------------------------------------------

/**
 * Record a compliance violation in the `compliance_violations` table.
 *
 * @param db           - D1 database binding.
 * @param agentId      - The offending agent's identifier.
 * @param reason       - Human-readable violation description.
 * @param envelopeHash - Optional SHA-256 hash of the triggering envelope.
 * @returns Object containing the generated `violation_id`.
 */
export async function reportViolation(
	db: DbClient,
	agentId: string,
	reason: string,
	envelopeHash?: string
): Promise<{ violation_id: string }> {
	if (!agentId) {
		throw new Error('[reportViolation] missing agentId');
	}
	if (!reason) {
		throw new Error('[reportViolation] missing reason');
	}

	const violation_id = crypto.randomUUID();

	await insertViolation(db, {
		violationId: violation_id,
		agentId,
		envelopeHash: envelopeHash ?? null,
		reason,
		createdAt: Math.floor(Date.now() / 1000)
	});

	return { violation_id };
}
