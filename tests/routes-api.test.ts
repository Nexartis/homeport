/**
 * Public API Route Tests — /search, /lookup, /list, /stats, /reputation
 * Exercises the thin SvelteKit route wrappers via SELF.fetch().
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
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
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY, assigned_agent_id TEXT REFERENCES agent_addrs(agent_id),
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL, p95_latency_ms INTEGER,
    probe_success REAL, cert_score REAL, reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rs_agent ON reputation_snapshots(agent_id, created_at)`,
	`CREATE TABLE IF NOT EXISTS certificates (
    cert_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    score REAL NOT NULL, grade TEXT NOT NULL, ci95_lo REAL, ci95_hi REAL,
    n_trials INTEGER NOT NULL, hmac_signature TEXT NOT NULL, ed25519_vc TEXT,
    evidence_uri TEXT, issued_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE TABLE IF NOT EXISTS cert_revocations (
    cert_id TEXT PRIMARY KEY REFERENCES certificates(cert_id),
    reason TEXT NOT NULL, status_list_index INTEGER,
    revoked_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_rev_status_list_index
    ON cert_revocations(status_list_index)`,
	`CREATE TABLE IF NOT EXISTS cert_jobs (
    job_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    status TEXT DEFAULT 'pending', num_trials INTEGER DEFAULT 5,
    completed_trials INTEGER DEFAULT 0, pass_threshold REAL DEFAULT 0.8,
    score REAL, grade TEXT,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));

	// Seed agents for route tests
	const db = createDbClient(env.DB);
	const agentSql = `INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, tags, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`;
	await env.DB.batch([
		env.DB.prepare(agentSql).bind(
			'api-agent-1',
			'https://one.example.com',
			'["chat","math"]',
			'["llm","fast"]'
		),
		env.DB.prepare(agentSql).bind('api-agent-2', 'https://two.example.com', '["code"]', '["dev"]'),
		env.DB.prepare(agentSql).bind('api-agent-3', 'https://three.example.com', '["chat"]', '["llm"]')
	]);

	// Seed reputation + cert data for /reputation tests
	await env.DB.batch([
		env.DB.prepare(
			`INSERT OR IGNORE INTO reputation_snapshots (id, agent_id, availability, error_rate, fraud_rate, p95_latency_ms, probe_success, cert_score, reputation, actions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).bind('rs-1', 'api-agent-1', 0.99, 0.01, 0.0, 120, 0.98, 0.85, 0.92, '["none"]'),
		env.DB.prepare(
			`INSERT OR IGNORE INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
		).bind('cert-1', 'api-agent-1', 'chat', 0.9, 'A', 10, 'sig123')
	]);
});

// ─── /search ──────────────────────────────────────────────────

describe('GET /search', () => {
	it('returns matching agents for q param', async () => {
		const res = await SELF.fetch('https://fake.host/search?q=api-agent-1');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body.length).toBe(1);
		expect(body[0].agent_id).toBe('api-agent-1');
	});

	it('filters by capabilities param', async () => {
		const res = await SELF.fetch('https://fake.host/search?capabilities=math');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body.some((a) => a.agent_id === 'api-agent-1')).toBe(true);
		expect(body.some((a) => a.agent_id === 'api-agent-2')).toBe(false);
	});

	it('filters by tags param', async () => {
		const res = await SELF.fetch('https://fake.host/search?tags=dev');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body.length).toBe(1);
		expect(body[0].agent_id).toBe('api-agent-2');
	});

	it('returns all agents when no params given', async () => {
		const res = await SELF.fetch('https://fake.host/search');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body.length).toBeGreaterThanOrEqual(3);
	});

	it('supports combined capabilities and tags', async () => {
		const res = await SELF.fetch('https://fake.host/search?capabilities=chat&tags=llm');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<Record<string, unknown>>;
		expect(body.some((a) => a.agent_id === 'api-agent-1')).toBe(true);
		expect(body.some((a) => a.agent_id === 'api-agent-3')).toBe(true);
	});
});

// ─── /lookup ──────────────────────────────────────────────────

describe('GET /lookup/:id', () => {
	it('returns agent by ID', async () => {
		const res = await SELF.fetch('https://fake.host/lookup/api-agent-1');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.agent_id).toBe('api-agent-1');
		expect(body.agent_url).toBe('https://one.example.com');
	});

	it('returns 404 for unknown agent', async () => {
		const res = await SELF.fetch('https://fake.host/lookup/nonexistent');
		expect(res.status).toBe(404);
	});

	it('URL-decodes the ID param', async () => {
		// Register agent with special chars in ID
		await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'agent/special id',
				agent_url: 'https://special.example.com'
			})
		});
		const res = await SELF.fetch(
			'https://fake.host/lookup/' + encodeURIComponent('agent/special id')
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.agent_id).toBe('agent/special id');
	});
});

// ─── /list ────────────────────────────────────────────────────

describe('GET /list', () => {
	it('returns discoverable agents as rich records', async () => {
		const res = await SELF.fetch('https://fake.host/list');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>[];
		const byId = Object.fromEntries(body.map((a) => [a.agent_id as string, a]));
		expect(byId['api-agent-1'].agent_url).toBe('https://one.example.com');
		expect(byId['api-agent-2'].agent_url).toBe('https://two.example.com');
		expect(byId['api-agent-1'].visibility).toBe('public');
	});

	it('includes all registered agents', async () => {
		const res = await SELF.fetch('https://fake.host/list');
		const body = (await res.json()) as Record<string, unknown>[];
		expect(body.length).toBeGreaterThanOrEqual(3);
	});
});

// ─── /stats ───────────────────────────────────────────────────

describe('GET /stats', () => {
	it('returns total_agents, alive_agents, total_clients', async () => {
		const res = await SELF.fetch('https://fake.host/stats');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, number>;
		expect(typeof body.total_agents).toBe('number');
		expect(typeof body.alive_agents).toBe('number');
		expect(typeof body.total_clients).toBe('number');
		expect(body.total_agents).toBeGreaterThanOrEqual(3);
		expect(body.alive_agents).toBeGreaterThanOrEqual(3);
		expect(body.total_clients).toBe(0);
	});
});

// ─── /reputation ──────────────────────────────────────────────

describe('GET /reputation', () => {
	it('returns merged reputation + cert data', async () => {
		const res = await SELF.fetch('https://fake.host/reputation');
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			agents: Array<Record<string, unknown>>;
			total: number;
			fetchedAt: string;
		};
		expect(body.total).toBeGreaterThanOrEqual(1);
		expect(body.fetchedAt).toBeDefined();

		const agent1 = body.agents.find((a) => a.agent_id === 'api-agent-1');
		expect(agent1).toBeDefined();
		expect(agent1!.reputation).toBe(0.92);
		expect(agent1!.availability).toBe(0.99);
		// cert data merged from certificates table
		expect(agent1!.cert_score).toBe(0.9);
		expect(agent1!.cert_grade).toBe('A');
		expect(agent1!.cert_capability).toBe('chat');
	});

	it('includes agents with certs but no reputation snapshot', async () => {
		// Seed an agent with only a certificate, no reputation snapshot
		await env.DB.batch([
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, 'test', 'test', 'test')`
			).bind('cert-only-agent', 'https://certonly.example.com'),
			env.DB.prepare(
				`INSERT OR IGNORE INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
			).bind('cert-only-1', 'cert-only-agent', 'math', 0.75, 'B', 5, 'sig456')
		]);

		const res = await SELF.fetch('https://fake.host/reputation');
		const body = (await res.json()) as { agents: Array<Record<string, unknown>> };
		const certOnly = body.agents.find((a) => a.agent_id === 'cert-only-agent');
		expect(certOnly).toBeDefined();
		expect(certOnly!.reputation).toBeNull();
		expect(certOnly!.cert_score).toBe(0.75);
		expect(certOnly!.cert_grade).toBe('B');
	});
});
