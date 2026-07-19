/**
 * AgentFacts v2 Tests — validation, schema detection, v2 store, VC wrapping
 * Phase 6 — Agent Bali
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { validateAgentFactsV2, detectSchemaVersion } from '../src/lib/types/agentfacts-v2';
import { storeAgentFactsV2, getAgentFacts, registerAgent } from '../src/lib/services/registry';
import { resolveAndSign } from '$lib/crypto/sign-agent';
import { getAgentFacts as repoGetAgentFacts } from '../src/lib/db/repositories';
import { createDbClient } from '../src/lib/db/client';

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
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()),
    trust_score REAL, compliance_status TEXT, compliance_checked_at TEXT,
    vc_json TEXT, vc_issued_at INTEGER, vc_expires_at INTEGER,
    disclosure_policy TEXT DEFAULT 'public')`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

// ── Type & Validation Tests ─────────────────────────────────────

describe('AgentFacts v2 Validation', () => {
	it('validates a minimal v2 document', () => {
		const errors = validateAgentFactsV2({ agent_name: 'test-agent', schema_version: '2.0.0' });
		expect(errors).toEqual([]);
	});

	it('rejects missing agent_name', () => {
		const errors = validateAgentFactsV2({ schema_version: '2.0.0' });
		expect(errors).toContainEqual('Missing required field: agent_name');
	});

	it('rejects invalid trust_score', () => {
		const errors = validateAgentFactsV2({ agent_name: 'x', trust_score: 150 });
		expect(errors).toContainEqual('trust_score must be a number between 0 and 100');
	});

	it('rejects invalid compliance_status', () => {
		const errors = validateAgentFactsV2({ agent_name: 'x', compliance_status: 'invalid' });
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain('compliance_status');
	});

	it('rejects invalid disclosure_policy', () => {
		const errors = validateAgentFactsV2({ agent_name: 'x', disclosure_policy: 'open' });
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain('disclosure_policy');
	});

	it('validates a fully-populated v2 document', () => {
		const errors = validateAgentFactsV2({
			agent_name: 'full-agent',
			trust_score: 85,
			compliance_status: 'compliant',
			disclosure_policy: 'authenticated',
			schema_version: '2.0.0'
		});
		expect(errors).toEqual([]);
	});
});

// ── Schema Version Detection ────────────────────────────────────

describe('Schema Version Detection', () => {
	it('detects v1 for plain docs', () => {
		expect(detectSchemaVersion({ agent_name: 'x' })).toBe('1.0.0');
	});

	it('detects v2 from explicit schema_version', () => {
		expect(detectSchemaVersion({ agent_name: 'x', schema_version: '2.0.0' })).toBe('2.0.0');
	});

	it('detects v2 from trust_score', () => {
		expect(detectSchemaVersion({ agent_name: 'x', trust_score: 50 })).toBe('2.0.0');
	});

	it('detects v2 from compliance_status', () => {
		expect(detectSchemaVersion({ agent_name: 'x', compliance_status: 'pending' })).toBe('2.0.0');
	});
});

// ── Service Layer: storeAgentFactsV2 ────────────────────────────

describe('AgentFacts v2 Service', () => {
	const V1_FACTS = {
		id: 'urn:agent:nanda:v1-agent',
		agent_name: 'v1-agent',
		label: 'V1 Agent',
		description: 'A v1 agent',
		version: '1.0.0',
		provider: { name: 'TestCorp', did: 'did:web:testcorp.example' },
		endpoints: [{ url: 'https://agent.example.com' }],
		capabilities: ['text-generation'],
		skills: [{ id: 'chat', name: 'Chat' }]
	};

	const V2_FACTS = {
		agent_name: 'v2-agent',
		label: 'V2 Agent',
		description: 'A v2 agent with trust extensions',
		version: '2.0.0',
		trust_score: 92,
		compliance_status: 'compliant' as const,
		disclosure_policy: 'public' as const,
		schema_version: '2.0.0'
	};

	beforeAll(async () => {
		const sig1 = await resolveAndSign('v1-test-agent', env);
		await registerAgent(db, {
			agent_id: 'v1-test-agent',
			agent_url: 'https://v1.example.com',
			...sig1
		});
		const sig2 = await resolveAndSign('v2-test-agent', env);
		await registerAgent(db, {
			agent_id: 'v2-test-agent',
			agent_url: 'https://v2.example.com',
			...sig2
		});
	});

	it('stores v1 facts through v2 path (backward compat)', async () => {
		const result = await storeAgentFactsV2(db, 'v1-test-agent', V1_FACTS);
		expect(result.ok).toBe(true);
		expect(result.schema_version).toBe('1.0.0');
		const facts = await getAgentFacts(db, 'v1-test-agent');
		expect(facts).not.toBeNull();
		expect(facts!.agent_name).toBe('v1-agent');
	});

	it('stores v2 facts with trust_score and compliance', async () => {
		const result = await storeAgentFactsV2(db, 'v2-test-agent', V2_FACTS);
		expect(result.ok).toBe(true);
		expect(result.schema_version).toBe('2.0.0');

		// Verify v2 columns are populated at the DB level
		const row = await repoGetAgentFacts(db, 'v2-test-agent');
		expect(row).not.toBeNull();
		expect(row!.trustScore).toBe(92);
		expect(row!.complianceStatus).toBe('compliant');
		expect(row!.disclosurePolicy).toBe('public');
		expect(row!.schemaVersion).toBe('2.0.0');
	});

	it('rejects invalid v2 facts', async () => {
		const result = await storeAgentFactsV2(db, 'v2-test-agent', {
			agent_name: 'bad',
			trust_score: -5,
			schema_version: '2.0.0'
		});
		expect(result.ok).toBe(false);
		expect(result.errors).toBeDefined();
		expect(result.errors!.length).toBeGreaterThan(0);
	});

	it('retrieves v2 facts as JSON', async () => {
		const facts = await getAgentFacts(db, 'v2-test-agent');
		expect(facts).not.toBeNull();
		expect(facts!.trust_score).toBe(92);
		expect(facts!.compliance_status).toBe('compliant');
	});
});

// ── HTTP Route Tests ────────────────────────────────────────────

describe('AgentFacts v2 HTTP Routes', () => {
	beforeAll(async () => {
		// Register an agent for route tests
		const sig3 = await resolveAndSign('route-v2', env);
		await registerAgent(db, {
			agent_id: 'route-v2',
			agent_url: 'https://route.example.com',
			...sig3
		});
	});

	it('PUT /agentfacts/:id stores v2 facts and returns schema_version', async () => {
		const res = await SELF.fetch('https://fake.host/agentfacts/route-v2', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_name: 'route-v2',
				trust_score: 75,
				compliance_status: 'pending',
				schema_version: '2.0.0'
			})
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('stored');
		expect(body.schema_version).toBe('2.0.0');
	});

	it('GET /agentfacts/:id returns stored v2 facts', async () => {
		const res = await SELF.fetch('https://fake.host/agentfacts/route-v2');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.agent_name).toBe('route-v2');
		expect(body.trust_score).toBe(75);
	});

	it('PUT /agentfacts/:id rejects invalid v2 facts', async () => {
		const res = await SELF.fetch('https://fake.host/agentfacts/route-v2', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_name: 'route-v2',
				trust_score: 200,
				schema_version: '2.0.0'
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBe('Validation failed');
	});

	it('GET /agentfacts/:id returns 404 for unknown agent', async () => {
		const res = await SELF.fetch('https://fake.host/agentfacts/nonexistent');
		expect(res.status).toBe(404);
	});
});
