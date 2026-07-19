/**
 * Compliance Enforcer Tests — PII redaction, PDP evaluation, D1 logging, A2A routing
 * Uses @cloudflare/vitest-pool-workers with real local D1 + KV bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
	redactText,
	redactEnvelope,
	loadPolicy,
	evaluatePolicy,
	logDecision,
	reportViolation,
	hmacSign
} from '../src/lib/services/compliance/service';
import type { PolicyEnvelope, PolicyResult } from '../src/lib/services/compliance/service';
import { handleComplianceAction } from '../src/lib/services/compliance/routes';
import { createDbClient } from '../src/lib/db/client';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		KYM_NANDA_HMAC_SECRET: string;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

// D1 table setup — mirrors sql/schema.sql compliance section
const COMPLIANCE_TABLES = [
	`CREATE TABLE IF NOT EXISTS compliance_policies (
    policy_id  TEXT PRIMARY KEY,
    rules_json TEXT NOT NULL,
    version    INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS compliance_decisions (
    decision_id   TEXT PRIMARY KEY,
    envelope_hash TEXT NOT NULL,
    from_agent    TEXT,
    to_agent      TEXT,
    capability    TEXT,
    decision      TEXT NOT NULL,
    reasons       TEXT,
    created_at    INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_cd_agents ON compliance_decisions(from_agent, to_agent)`,
	`CREATE TABLE IF NOT EXISTS compliance_violations (
    violation_id TEXT PRIMARY KEY,
    agent_id     TEXT NOT NULL,
    envelope_hash TEXT,
    reason       TEXT NOT NULL,
    created_at   INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_cv_agent ON compliance_violations(agent_id)`
];

beforeAll(async () => {
	await env.DB.batch(COMPLIANCE_TABLES.map((sql) => env.DB.prepare(sql)));
	// Ensure HMAC secret is available in test env
	if (!env.KYM_NANDA_HMAC_SECRET) {
		(env as any).KYM_NANDA_HMAC_SECRET = 'test-hmac-secret';
	}
});

// ---------- PII Redaction Tests ----------

describe('PII Redaction', () => {
	it('should replace email addresses with [REDACTED_EMAIL]', () => {
		const input = 'Contact me at alice@example.com for details';
		const result = redactText(input);
		expect(result).toBe('Contact me at [REDACTED_EMAIL] for details');
		expect(result).not.toContain('alice@example.com');
	});

	it('should replace phone numbers with [REDACTED_PHONE]', () => {
		const input = 'Call me at (555) 123-4567 or +1-800-555-0199';
		const result = redactText(input);
		expect(result).toContain('[REDACTED_PHONE]');
		expect(result).not.toContain('555');
	});

	it('should return text unchanged when no PII is present', () => {
		const input = 'This is a harmless message with no PII.';
		const result = redactText(input);
		expect(result).toBe(input);
	});

	it('should handle multiple PII tokens in a single string', () => {
		const input = 'Email: bob@corp.io, Phone: 212-555-1234';
		const result = redactText(input);
		expect(result).toContain('[REDACTED_EMAIL]');
		expect(result).toContain('[REDACTED_PHONE]');
		expect(result).not.toContain('bob@corp.io');
	});

	it('should redact envelope parts without mutating input (immutability)', () => {
		const original: PolicyEnvelope = {
			from_agent: 'agent://alice',
			to_agent: 'agent://bob',
			capability: 'chat',
			parts: [
				{ text: 'My email is test@test.com' },
				{ text: 'No PII here' },
				{ text: 'Phone: 310-555-9876' }
			]
		};
		const originalJson = JSON.stringify(original);

		const result = redactEnvelope(original);

		// Input must not be mutated
		expect(JSON.stringify(original)).toBe(originalJson);
		// Result is a new envelope (not same reference)
		expect(result).not.toBe(original);
		expect(result.parts!.length).toBe(3);
		expect(result.parts![0].text).toContain('[REDACTED_EMAIL]');
		expect(result.parts![1].text).toBe('No PII here');
		expect(result.parts![2].text).toContain('[REDACTED_PHONE]');
		// Envelope metadata is preserved
		expect(result.from_agent).toBe('agent://alice');
		expect(result.capability).toBe('chat');
	});
});

// ---------- Policy Loading Tests ----------

describe('Policy Loading', () => {
	it('should return default policy when no policy exists in DB', async () => {
		const db = createDbClient(env.DB);
		const rules = await loadPolicy(db, env.NANDA_NODE_CACHE);
		expect(rules).toBeDefined();
		expect(Array.isArray(rules.region_pairs_allow)).toBe(true);
		expect(Array.isArray(rules.capability_allowlist)).toBe(true);
		expect(Array.isArray(rules.capability_denylist)).toBe(true);
		expect(Array.isArray(rules.escalation_list)).toBe(true);
		expect(typeof rules.eu_personal_data_flag).toBe('boolean');
	});

	it('should load and cache a policy from D1', async () => {
		const customRules = {
			region_pairs_allow: [['US', 'US']],
			capability_allowlist: ['chat'],
			capability_denylist: ['weapons'],
			escalation_list: ['payment'],
			eu_personal_data_flag: false
		};
		await env.DB.prepare(`INSERT INTO compliance_policies (policy_id, rules_json) VALUES (?, ?)`)
			.bind('test-policy', JSON.stringify(customRules))
			.run();

		const db = createDbClient(env.DB);
		const rules = await loadPolicy(db, env.NANDA_NODE_CACHE, 'test-policy');
		expect(rules.region_pairs_allow).toEqual([['US', 'US']]);
		expect(rules.capability_allowlist).toEqual(['chat']);
	});

	it('should serve policy from KV cache on second call', async () => {
		// First call populates cache (already done above for 'test-policy')
		// Second call should hit KV
		const db = createDbClient(env.DB);
		const rules = await loadPolicy(db, env.NANDA_NODE_CACHE, 'test-policy');
		expect(rules.capability_allowlist).toEqual(['chat']);
	});
});

// ---------- Policy Evaluation (4-step PDP) ----------

describe('Policy Evaluation', () => {
	const baseEnvelope: PolicyEnvelope = {
		from_agent: 'agent://alice',
		to_agent: 'agent://bob',
		capability: 'chat',
		from_region: 'USA',
		to_region: 'USA'
	};

	it('should ALLOW a normal request that passes all checks', async () => {
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, baseEnvelope);
		expect(result.decision).toBe('ALLOW');
		expect(result.reasons.length).toBeGreaterThan(0);
		expect(Array.isArray(result.actions)).toBe(true);
		// Default policy model_route maps USA → 'us-model'
		expect(result.actions).toContain('route:us-model');
	});

	it('should DENY for a disallowed region pair', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: 'CN',
			to_region: 'RU'
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('DENY');
		expect(result.reasons[0]).toContain('Region pair');
		expect(result.actions).toEqual([]);
	});

	it('should DENY for a capability in the denylist', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			capability: 'weapons'
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('DENY');
		expect(result.reasons[0]).toContain('denied');
	});

	it('should DENY for a capability not in the allowlist', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			capability: 'unknown-capability-xyz'
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('DENY');
		expect(result.reasons[0]).toContain('allowlist');
	});

	it('should ESCALATE for a capability in the escalation list', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			capability: 'payment'
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('ESCALATE');
		expect(result.reasons[0]).toContain('manual review');
		expect(result.actions).toEqual(['notify:policy']);
	});

	it('should ALLOW_WITH_REDACTION for EU personal data (eu_personal_data flag)', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: 'USA',
			to_region: 'EU',
			eu_personal_data: true,
			parts: [{ text: 'My email is user@eu-corp.de and phone is +49 30 1234567' }]
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('ALLOW_WITH_REDACTION');
		expect(result.actions).toContain('redact:pii');
		expect(result.actions).toContain('route:eu-model');
		expect(result.transformed_envelope).toBeDefined();
		expect(result.transformed_envelope!.parts![0].text).toContain('[REDACTED_EMAIL]');
		// Original envelope must not be mutated
		expect(envelope.parts![0].text).toContain('user@eu-corp.de');
	});

	it('should ALLOW_WITH_REDACTION when data_classes includes personal_data (P1-3)', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: 'EU',
			to_region: 'EU',
			data_classes: ['personal_data', 'financial'],
			parts: [{ text: 'Contact alice@example.com for details' }]
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('ALLOW_WITH_REDACTION');
		expect(result.actions).toContain('redact:pii');
		expect(result.transformed_envelope).toBeDefined();
		expect(result.transformed_envelope!.parts![0].text).toContain('[REDACTED_EMAIL]');
	});

	it('should NOT redact when eu_personal_data is true but flow is non-EU', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: 'USA',
			to_region: 'USA',
			eu_personal_data: true,
			parts: [{ text: 'Email: test@test.com' }]
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		// Non-EU flow → no redaction, just ALLOW
		expect(result.decision).toBe('ALLOW');
	});

	it('should accept optional context parameter (P1-4)', async () => {
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, baseEnvelope, undefined, {
			session_id: 'test-123',
			user_role: 'admin'
		});
		expect(result.decision).toBe('ALLOW');
	});

	it('should DENY when geo-fencing is active but from_region is missing', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: undefined,
			to_region: 'USA'
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('DENY');
		expect(result.reasons[0]).toContain('Region data required');
	});

	it('should DENY when geo-fencing is active but to_region is missing', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: 'USA',
			to_region: undefined
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('DENY');
		expect(result.reasons[0]).toContain('Region data required');
	});

	it('should DENY when geo-fencing is active but both regions are missing', async () => {
		const envelope: PolicyEnvelope = {
			...baseEnvelope,
			from_region: undefined,
			to_region: undefined
		};
		const db = createDbClient(env.DB);
		const result = await evaluatePolicy(db, env.NANDA_NODE_CACHE, envelope);
		expect(result.decision).toBe('DENY');
		expect(result.reasons[0]).toContain('Region data required');
	});

	it('should throw for missing from_agent', async () => {
		const envelope = { ...baseEnvelope, from_agent: '' };
		await expect(
			evaluatePolicy(createDbClient(env.DB), env.NANDA_NODE_CACHE, envelope)
		).rejects.toThrow('[evaluatePolicy] missing from_agent');
	});
});

// ---------- Decision Logging Tests ----------

describe('Decision Logging', () => {
	it('should write a decision to D1 and return a decision_id', async () => {
		const envelope: PolicyEnvelope = {
			from_agent: 'agent://alice',
			to_agent: 'agent://bob',
			capability: 'chat'
		};
		const result: PolicyResult = {
			decision: 'ALLOW',
			reasons: ['All policy checks passed'],
			actions: []
		};

		const db = createDbClient(env.DB);
		const { decision_id } = await logDecision(db, envelope, result);
		expect(decision_id).toBeDefined();
		expect(typeof decision_id).toBe('string');
		expect(decision_id.length).toBeGreaterThan(0);

		// Verify it was written to D1
		const row = await env.DB.prepare('SELECT * FROM compliance_decisions WHERE decision_id = ?')
			.bind(decision_id)
			.first();
		expect(row).not.toBeNull();
		expect(row!.decision).toBe('ALLOW');
		expect(row!.from_agent).toBe('agent://alice');
		expect(row!.to_agent).toBe('agent://bob');
		expect(row!.capability).toBe('chat');
		expect(row!.envelope_hash).toBeDefined();
		expect((row!.envelope_hash as string).length).toBe(64); // SHA-256 hex = 64 chars
	});
});

// ---------- Violation Reporting Tests ----------

describe('Violation Reporting', () => {
	it('should write a violation to D1 and return a violation_id', async () => {
		const db = createDbClient(env.DB);
		const { violation_id } = await reportViolation(
			db,
			'agent://rogue',
			'Exceeded capability scope'
		);
		expect(violation_id).toBeDefined();
		expect(typeof violation_id).toBe('string');

		const row = await env.DB.prepare('SELECT * FROM compliance_violations WHERE violation_id = ?')
			.bind(violation_id)
			.first();
		expect(row).not.toBeNull();
		expect(row!.agent_id).toBe('agent://rogue');
		expect(row!.reason).toBe('Exceeded capability scope');
	});

	it('should throw for missing agentId', async () => {
		await expect(reportViolation(createDbClient(env.DB), '', 'some reason')).rejects.toThrow(
			'[reportViolation] missing agentId'
		);
	});

	it('should throw for missing reason', async () => {
		await expect(reportViolation(createDbClient(env.DB), 'agent://test', '')).rejects.toThrow(
			'[reportViolation] missing reason'
		);
	});
});

// ---------- A2A Action Router Tests ----------

describe('Compliance A2A Action Router', () => {
	it('should dispatch policy.eval and return a decision', async () => {
		const result = await handleComplianceAction(env as any, 'policy.eval', {
			envelope: {
				from_agent: 'agent://alice',
				to_agent: 'agent://bob',
				capability: 'chat',
				from_region: 'USA',
				to_region: 'USA'
			}
		});
		expect(result.decision).toBe('ALLOW');
		expect(result.decision_id).toBeDefined();
		expect(Array.isArray(result.reasons)).toBe(true);
		expect(Array.isArray(result.actions)).toBe(true);
	});

	it('should dispatch policy.rules.get and return rules with HMAC signature', async () => {
		const result = await handleComplianceAction(env as any, 'policy.rules.get', {});
		expect(result.rules).toBeDefined();
		expect(result.signature).toBeDefined();
		expect(typeof result.signature).toBe('string');
		expect((result.signature as string).length).toBe(64); // HMAC-SHA256 hex = 64 chars
		const rules = result.rules as Record<string, unknown>;
		expect(Array.isArray(rules.region_pairs_allow)).toBe(true);
		// Verify signature matches
		const expected = await hmacSign(rules, env.KYM_NANDA_HMAC_SECRET);
		expect(result.signature).toBe(expected);
	});

	it('should dispatch policy.violation and return violation_id', async () => {
		const result = await handleComplianceAction(env as any, 'policy.violation', {
			agent_id: 'agent://bad-actor',
			reason: 'Attempted denied capability'
		});
		expect(result.violation_id).toBeDefined();
	});

	it('should throw for unknown compliance action', async () => {
		await expect(handleComplianceAction(env as any, 'policy.unknown', {})).rejects.toThrow(
			'Unknown compliance action'
		);
	});
});
