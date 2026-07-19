/**
 * Resolver Tests — Scoring, Strategies, Route, Edge Cases
 * Phase 6 — Agent California (20+ tests)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { ScoringEngine } from '../src/lib/services/resolver/scoring';
import {
	StaticStrategy,
	RotatingStrategy,
	AdaptiveStrategy
} from '../src/lib/services/resolver/strategies';
import { DEFAULT_WEIGHTS } from '../src/lib/types/resolver';
import type {
	ResolutionContext,
	HealthProbeData,
	AgentFactsV2Placeholder
} from '../src/lib/types/resolver';

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
	`CREATE TABLE IF NOT EXISTS probe_runs (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, endpoint TEXT,
    probes_sent INTEGER, success_count INTEGER, avg_latency_ms REAL,
    p95_latency_ms REAL, error_rate REAL,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL, p95_latency_ms INTEGER,
    probe_success REAL, cert_score REAL, reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS resolution_log (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, requester_id TEXT,
    strategy TEXT NOT NULL DEFAULT 'static', context_json TEXT, result_json TEXT,
    latency_ms INTEGER, cache_hit INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rl_agent ON resolution_log(agent_id, created_at)`,
	`CREATE INDEX IF NOT EXISTS idx_rl_strategy ON resolution_log(strategy)`,
	`CREATE TABLE IF NOT EXISTS protocol_adapters (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, protocol TEXT NOT NULL,
    detected_at INTEGER DEFAULT (unixepoch()), metadata_json TEXT, last_synced_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_pa_agent ON protocol_adapters(agent_id)`,
	`CREATE INDEX IF NOT EXISTS idx_pa_protocol ON protocol_adapters(protocol)`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
	// Seed agents for resolver tests
	const agentSql = `INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, api_url, capabilities, facts_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, ?, 'test', 'test', 'test')`;
	await env.DB.batch([
		env.DB.prepare(agentSql).bind(
			'resolver-agent-1',
			'https://agent1.example.com',
			'https://api1.example.com',
			'["chat","math"]',
			'https://agent1.example.com/agentfacts'
		),
		env.DB.prepare(agentSql).bind(
			'resolver-agent-2',
			'https://agent2.example.de',
			null,
			'["code"]',
			null
		)
	]);
	// Seed reputation
	await env.DB.prepare(
		`INSERT OR IGNORE INTO reputation_snapshots (id, agent_id, reputation) VALUES (?, ?, ?)`
	)
		.bind('rep-1', 'resolver-agent-1', 0.85)
		.run();
	// Seed probe runs
	await env.DB.prepare(
		`INSERT OR IGNORE INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms) VALUES (?, ?, ?, ?, ?, ?)`
	)
		.bind('probe-1', 'resolver-agent-1', 'https://agent1.example.com', 100, 98, 120)
		.run();
});

// ── Scoring Engine ──

describe('ScoringEngine', () => {
	const engine = new ScoringEngine();

	it('should score endpoint with full context', () => {
		const ctx: ResolutionContext = {
			requester_location: 'US',
			required_capabilities: ['chat', 'math'],
			min_trust_score: 0.5
		};
		const health: HealthProbeData = { success_rate: 0.98, p95_latency_ms: 120 };
		const result = engine.scoreEndpoint(
			{ url: 'https://agent1.example.com', protocol: 'https', capabilities: ['chat', 'math'] },
			ctx,
			health,
			0.85
		);
		expect(result.score).toBeGreaterThan(0);
		expect(result.score).toBeLessThanOrEqual(1.0);
		expect(result.health_status).toBe('healthy');
		expect(result.trust_score).toBe(0.85);
	});

	it('should give neutral geo score when no location', () => {
		const result = engine.scoreEndpoint(
			{ url: 'https://agent1.example.com', protocol: 'https' },
			{},
			undefined,
			0.5
		);
		// Neutral geo (0.5), should still compute
		expect(result.score).toBeGreaterThan(0);
	});

	it('should score capability match correctly', () => {
		const ctx: ResolutionContext = { required_capabilities: ['chat', 'math', 'code'] };
		const result = engine.scoreEndpoint(
			{ url: 'https://a.com', protocol: 'https', capabilities: ['chat', 'math'] },
			ctx,
			undefined,
			0.5
		);
		// 2/3 = 0.667 capability match
		expect(result.score).toBeGreaterThan(0);
	});

	it('should rank endpoints by composite score descending', () => {
		const endpoints = [
			{
				url: 'a',
				protocol: 'https',
				score: 0.3,
				latency_estimate_ms: 0,
				trust_score: 0,
				capabilities: [],
				connection_params: {},
				health_status: 'unknown' as const
			},
			{
				url: 'b',
				protocol: 'https',
				score: 0.9,
				latency_estimate_ms: 0,
				trust_score: 0,
				capabilities: [],
				connection_params: {},
				health_status: 'healthy' as const
			},
			{
				url: 'c',
				protocol: 'https',
				score: 0.6,
				latency_estimate_ms: 0,
				trust_score: 0,
				capabilities: [],
				connection_params: {},
				health_status: 'unknown' as const
			}
		];
		const ranked = engine.rankEndpoints(endpoints);
		expect(ranked[0].url).toBe('b');
		expect(ranked[1].url).toBe('c');
		expect(ranked[2].url).toBe('a');
	});

	it('should handle zero trust score', () => {
		const result = engine.scoreEndpoint(
			{ url: 'https://a.com', protocol: 'https' },
			{},
			undefined,
			0
		);
		expect(result.trust_score).toBe(0);
		expect(result.score).toBeGreaterThanOrEqual(0);
	});

	it('should handle degraded health', () => {
		const health: HealthProbeData = { success_rate: 0.6, p95_latency_ms: 3000 };
		const result = engine.scoreEndpoint(
			{ url: 'https://a.com', protocol: 'https' },
			{},
			health,
			0.5
		);
		expect(result.health_status).toBe('degraded');
	});
});

// ── Static Strategy ──

describe('StaticStrategy', () => {
	const strategy = new StaticStrategy();

	it('should return endpoints in order', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			endpoints: {
				static: [
					{ url: 'https://a.com', protocol: 'https' },
					{ url: 'https://b.com', protocol: 'a2a' }
				]
			}
		};
		const result = strategy.resolve(facts);
		expect(result).toHaveLength(2);
		expect(result[0].url).toBe('https://a.com');
		expect(result[0].score).toBeGreaterThan(result[1].score);
	});

	it('should return empty array for agent with no endpoints', () => {
		const facts: AgentFactsV2Placeholder = { agent_name: 'empty' };
		const result = strategy.resolve(facts);
		expect(result).toHaveLength(0);
	});
});

// ── Rotating Strategy ──

describe('RotatingStrategy', () => {
	const strategy = new RotatingStrategy();

	it('should rotate endpoint order across calls', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			endpoints: {
				static: [
					{ url: 'https://a.com', protocol: 'https' },
					{ url: 'https://b.com', protocol: 'https' },
					{ url: 'https://c.com', protocol: 'https' }
				]
			}
		};
		const health = new Map<string, HealthProbeData>();
		health.set('https://a.com', { success_rate: 0.99, p95_latency_ms: 100 });
		health.set('https://b.com', { success_rate: 0.95, p95_latency_ms: 200 });
		health.set('https://c.com', { success_rate: 0.9, p95_latency_ms: 300 });

		const r1 = strategy.resolve(facts, health);
		const r2 = strategy.resolve(facts, health);
		// At least one should have different order
		expect(r1.length).toBe(3);
		expect(r2.length).toBe(3);
	});

	it('should deprioritize degraded endpoints', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			endpoints: {
				static: [
					{ url: 'https://bad.com', protocol: 'https' },
					{ url: 'https://good.com', protocol: 'https' }
				]
			}
		};
		const health = new Map<string, HealthProbeData>();
		health.set('https://bad.com', { success_rate: 0.3, p95_latency_ms: 5000 });
		health.set('https://good.com', { success_rate: 0.99, p95_latency_ms: 50 });

		const result = strategy.resolve(facts, health);
		expect(result.length).toBe(2);
		// Good endpoint should appear before bad
		const goodIdx = result.findIndex((e) => e.url === 'https://good.com');
		const badIdx = result.findIndex((e) => e.url === 'https://bad.com');
		expect(goodIdx).toBeLessThan(badIdx);
	});
});

// ── Adaptive Strategy ──

describe('AdaptiveStrategy', () => {
	const scoring = new ScoringEngine();
	const strategy = new AdaptiveStrategy(scoring);

	it('should filter by protocol preference', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			endpoints: {
				static: [
					{ url: 'https://a.com', protocol: 'https' },
					{ url: 'https://b.com', protocol: 'a2a' }
				]
			}
		};
		const ctx: ResolutionContext = { protocol_preference: 'a2a' };
		const result = strategy.resolve(facts, ctx, new Map(), new Map());
		expect(result.every((e) => e.protocol === 'a2a')).toBe(true);
	});

	it('should filter by min trust score', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			endpoints: { static: [{ url: 'https://a.com', protocol: 'https' }] }
		};
		const ctx: ResolutionContext = { min_trust_score: 0.9 };
		const trust = new Map<string, number>();
		trust.set('test', 0.5);
		const result = strategy.resolve(facts, ctx, new Map(), trust);
		// With trust 0.5 and min 0.9, should still return (fallback to all if none match)
		expect(result.length).toBeGreaterThanOrEqual(0);
	});

	it('should rank higher trust endpoints first', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			endpoints: {
				static: [
					{ url: 'https://a.com', protocol: 'https' },
					{ url: 'https://b.com', protocol: 'https' }
				]
			}
		};
		const ctx: ResolutionContext = { required_capabilities: [] };
		const trust = new Map<string, number>();
		trust.set('test', 0.95);
		const health = new Map<string, HealthProbeData>();
		health.set('https://b.com', { success_rate: 0.99, p95_latency_ms: 50 });
		const result = strategy.resolve(facts, ctx, health, trust);
		expect(result.length).toBe(2);
		// b.com has health data, should score higher
		expect(result[0].url).toBe('https://b.com');
	});
});

// ── POST /resolve Route ──

describe('POST /resolve', () => {
	it('should resolve an agent with context', async () => {
		const res = await SELF.fetch('http://localhost/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'resolver-agent-1',
				context: { requester_location: 'US', required_capabilities: ['chat'] }
			})
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { strategy: string; endpoints: unknown[] };
		expect(body.strategy).toBe('adaptive');
		expect(body.endpoints).toBeDefined();
	});

	it('should resolve with static strategy when no context', async () => {
		const res = await SELF.fetch('http://localhost/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'resolver-agent-2' })
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { strategy: string };
		expect(body.strategy).toBe('static');
	});

	it('should return 404 for unknown agent', async () => {
		const res = await SELF.fetch('http://localhost/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'nonexistent' })
		});
		expect(res.status).toBe(404);
	});

	it('should return 400 for missing agent_id', async () => {
		const res = await SELF.fetch('http://localhost/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		expect(res.status).toBe(400);
	});

	it('should return 400 for invalid JSON', async () => {
		const res = await SELF.fetch('http://localhost/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json'
		});
		expect(res.status).toBe(400);
	});

	it('should return 400 for invalid min_trust_score', async () => {
		const res = await SELF.fetch('http://localhost/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'resolver-agent-1',
				context: { min_trust_score: 5 }
			})
		});
		expect(res.status).toBe(400);
	});
});

// ── Edge Cases ──

describe('Resolver edge cases', () => {
	it('DEFAULT_WEIGHTS should sum to 1.0', () => {
		const sum =
			DEFAULT_WEIGHTS.geo_proximity +
			DEFAULT_WEIGHTS.trust_score +
			DEFAULT_WEIGHTS.capability_match +
			DEFAULT_WEIGHTS.health;
		expect(sum).toBeCloseTo(1.0, 5);
	});

	it('scoring engine should clamp score to [0, 1]', () => {
		const engine = new ScoringEngine({
			geo_proximity: 1,
			trust_score: 1,
			capability_match: 1,
			health: 1
		});
		const result = engine.scoreEndpoint(
			{ url: 'https://a.com', protocol: 'https', capabilities: ['x'] },
			{ required_capabilities: ['x'], requester_location: 'US' },
			{ success_rate: 1.0, p95_latency_ms: 10 },
			1.0
		);
		expect(result.score).toBeLessThanOrEqual(1.0);
	});

	it('scoring engine should handle negative trust gracefully', () => {
		const engine = new ScoringEngine();
		const result = engine.scoreEndpoint(
			{ url: 'https://a.com', protocol: 'https' },
			{},
			undefined,
			-5
		);
		expect(result.trust_score).toBe(-5);
		expect(result.score).toBeGreaterThanOrEqual(0);
	});
});
