/**
 * SafeSearch & ZTAA Tests — Phase 6 (Agent Hawaii)
 *
 * Tests:
 *  - SafeSearchService: trust filtering, cert, jurisdiction, age, content flags
 *  - ZTAA middleware: policy evaluation, trust gate, jurisdiction gate, cert gate
 *  - /search route: SafeSearch query parameters
 *  - /api/admin/federation: evaluate-ztaa action
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createDbClient } from '$lib/db/client';
import { SafeSearchService } from '$lib/services/safesearch';
import {
	evaluateZTAA,
	DEFAULT_ZTAA_POLICY,
	ztaaForbiddenResponse,
	type ZTAAResult
} from '$lib/middleware/ztaa';
import type { ZTAAPolicy } from '$lib/types/safesearch';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
		NANDA_FEDERATION_ADMIN_KEY: string;
		NANDA_FEDERATION_PEER_URL: string;
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
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS cross_registry_scores (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL UNIQUE,
    local_reputation REAL, federated_reputation REAL,
    combined_reputation REAL, peer_count INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0, badge_tier TEXT DEFAULT 'none',
    computed_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS protocol_adapters (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    protocol TEXT NOT NULL, adapter_url TEXT,
    detected_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(agent_id, protocol))`
];

const now = Math.floor(Date.now() / 1000);
const thirtyOneDaysAgo = now - 31 * 86400;
const tenDaysAgo = now - 10 * 86400;

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	// Clean slate
	await env.DB.batch([
		env.DB.prepare('DELETE FROM cross_registry_scores'),
		env.DB.prepare('DELETE FROM agent_facts'),
		env.DB.prepare('DELETE FROM agent_addrs'),
		env.DB.prepare('DELETE FROM protocol_adapters')
	]);

	// Seed agents
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO agent_addrs (agent_id, agent_url, capabilities, status, registered_at, public_key_hex, signature_hex, signer_id)
       VALUES ('trusted-agent', 'https://trusted.example.com', '["text-generation","chat"]', 'alive', ?, 'test', 'test', 'test')`
		).bind(thirtyOneDaysAgo),
		env.DB.prepare(
			`INSERT INTO agent_addrs (agent_id, agent_url, capabilities, status, registered_at, public_key_hex, signature_hex, signer_id)
       VALUES ('new-agent', 'https://new.example.com', '["image-gen"]', 'alive', ?, 'test', 'test', 'test')`
		).bind(tenDaysAgo),
		env.DB.prepare(
			`INSERT INTO agent_addrs (agent_id, agent_url, capabilities, status, registered_at, public_key_hex, signature_hex, signer_id)
       VALUES ('flagged-agent', 'https://flagged.example.com', '["text-generation"]', 'alive', ?, 'test', 'test', 'test')`
		).bind(thirtyOneDaysAgo),
		env.DB.prepare(
			`INSERT INTO agent_addrs (agent_id, agent_url, capabilities, status, registered_at, public_key_hex, signature_hex, signer_id)
       VALUES ('dead-agent', 'https://dead.example.com', '["chat"]', 'dead', ?, 'test', 'test', 'test')`
		).bind(thirtyOneDaysAgo)
	]);

	// Seed agent_facts
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO agent_facts (agent_id, facts_json, agent_name, jurisdiction, cert_level)
       VALUES ('trusted-agent', '{"content_flags":[],"protocol":"a2a"}', 'Trusted Bot', 'US', 'gold')`
		),
		env.DB.prepare(
			`INSERT INTO agent_facts (agent_id, facts_json, agent_name, jurisdiction, cert_level)
       VALUES ('new-agent', '{"content_flags":["nsfw"],"protocol":"mcp"}', 'New Bot', 'EU', 'bronze')`
		),
		env.DB.prepare(
			`INSERT INTO agent_facts (agent_id, facts_json, agent_name, jurisdiction, cert_level)
       VALUES ('flagged-agent', '{"content_flags":["violence","gambling"],"protocol":"a2a"}', 'Flagged Bot', 'US', 'silver')`
		)
	]);

	// Seed trust scores (use unique IDs to avoid collisions with other test files)
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO cross_registry_scores (id, agent_id, combined_reputation) VALUES ('crs-ss-1', 'trusted-agent', 0.92)`
		),
		env.DB.prepare(
			`INSERT INTO cross_registry_scores (id, agent_id, combined_reputation) VALUES ('crs-ss-2', 'new-agent', 0.3)`
		),
		env.DB.prepare(
			`INSERT INTO cross_registry_scores (id, agent_id, combined_reputation) VALUES ('crs-ss-3', 'flagged-agent', 0.65)`
		)
	]);
});

// ─── SafeSearchService ──────────────────────────────────────────

describe('SafeSearchService', () => {
	it('returns all alive agents with no filters', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({});
		// dead-agent excluded (status != alive)
		expect(result.total).toBe(3);
		expect(result.agents.map((a) => a.agent_id).sort()).toEqual([
			'flagged-agent',
			'new-agent',
			'trusted-agent'
		]);
		expect(result.filters_applied).toEqual([]);
	});

	it('filters by min_trust', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({ min_trust: 0.5 });
		expect(result.total).toBe(2);
		expect(result.agents.map((a) => a.agent_id).sort()).toEqual(['flagged-agent', 'trusted-agent']);
		expect(result.filters_applied).toContain('min_trust:0.5');
	});

	it('filters by capability', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({ capability: 'text-generation' });
		expect(result.total).toBe(2);
		expect(result.agents.map((a) => a.agent_id).sort()).toEqual(['flagged-agent', 'trusted-agent']);
	});

	it('filters by jurisdiction', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({ jurisdiction: 'EU' });
		expect(result.total).toBe(1);
		expect(result.agents[0].agent_id).toBe('new-agent');
	});

	it('excludes agents with blocked content_flags', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({ exclude_flags: ['nsfw'] });
		expect(result.agents.map((a) => a.agent_id)).not.toContain('new-agent');
		expect(result.filters_applied).toContain('exclude_flags:nsfw');
	});

	it('filters by requires_cert', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({ requires_cert: ['gold'] });
		expect(result.total).toBe(1);
		expect(result.agents[0].agent_id).toBe('trusted-agent');
	});

	it('filters by max_age_days (NSA exclusion)', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		// max_age_days excludes agents registered less than N days ago
		const result = await svc.search({ max_age_days: 30 });
		// new-agent was registered 10 days ago => excluded
		expect(result.agents.map((a) => a.agent_id)).not.toContain('new-agent');
		expect(result.agents.length).toBeGreaterThanOrEqual(2);
	});

	it('combines multiple filters', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({
			min_trust: 0.5,
			exclude_flags: ['violence', 'gambling'],
			jurisdiction: 'US'
		});
		// flagged-agent has violence+gambling flags, so excluded
		expect(result.total).toBe(1);
		expect(result.agents[0].agent_id).toBe('trusted-agent');
	});

	it('returns empty when no agents match', async () => {
		const db = createDbClient(env.DB);
		const svc = new SafeSearchService(db);
		const result = await svc.search({ min_trust: 0.99, jurisdiction: 'JP' });
		expect(result.total).toBe(0);
		expect(result.agents).toEqual([]);
	});
});

// ─── ZTAA Policy Evaluation ─────────────────────────────────────

describe('ZTAA evaluateZTAA', () => {
	it('grants access for a high-trust, gold-cert agent', async () => {
		const db = createDbClient(env.DB);
		const result = await evaluateZTAA(db, 'trusted-agent', DEFAULT_ZTAA_POLICY);
		expect(result.allowed).toBe(true);
		expect(result.policy_applied).toBe('none');
	});

	it('denies access for an agent below min_trust_score', async () => {
		const db = createDbClient(env.DB);
		const policy: ZTAAPolicy = { ...DEFAULT_ZTAA_POLICY, min_trust_score: 0.8 };
		const result = await evaluateZTAA(db, 'new-agent', policy);
		expect(result.allowed).toBe(false);
		expect(result.policy_applied).toBe('min_trust_score');
	});

	it('denies access for jurisdiction not in allowed list', async () => {
		const db = createDbClient(env.DB);
		const policy: ZTAAPolicy = {
			...DEFAULT_ZTAA_POLICY,
			allowed_jurisdictions: ['US'] // EU not allowed
		};
		const result = await evaluateZTAA(db, 'new-agent', policy);
		expect(result.allowed).toBe(false);
		expect(result.policy_applied).toBe('allowed_jurisdictions');
	});

	it('denies access for missing required certifications', async () => {
		const db = createDbClient(env.DB);
		const policy: ZTAAPolicy = { ...DEFAULT_ZTAA_POLICY, required_certifications: ['gold'] };
		const result = await evaluateZTAA(db, 'flagged-agent', policy);
		// flagged-agent has 'silver', not 'gold'
		expect(result.allowed).toBe(false);
		expect(result.policy_applied).toBe('required_certifications');
	});

	it('denies access for agent with blocked content flags', async () => {
		const db = createDbClient(env.DB);
		const policy: ZTAAPolicy = {
			...DEFAULT_ZTAA_POLICY,
			blocked_content_flags: ['nsfw']
		};
		const result = await evaluateZTAA(db, 'new-agent', policy);
		expect(result.allowed).toBe(false);
		expect(result.policy_applied).toBe('blocked_content_flags');
	});

	it('allows agent with no trust record under permissive policy', async () => {
		const db = createDbClient(env.DB);
		// dead-agent has no trust record, but default policy min is 0
		// however dead-agent is not in agent_facts — so facts checks pass vacuously
		const result = await evaluateZTAA(db, 'dead-agent', DEFAULT_ZTAA_POLICY);
		expect(result.allowed).toBe(true);
	});

	it('returns the ztaaForbiddenResponse as a 403 JSON body', () => {
		const result: ZTAAResult = {
			allowed: false,
			reason: 'Trust score 0.30 below minimum 0.80',
			trust_score: 0.3,
			policy_applied: 'min_trust_score'
		};
		const response = ztaaForbiddenResponse(result);
		expect(response.status).toBe(403);
	});
});
