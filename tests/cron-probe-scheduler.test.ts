/**
 * Cron Probe-Scheduler Tests — POST /api/cron/probe-scheduler
 *
 * Covers:
 *   - CRON_AUTH_TOKEN auth: rejects missing token, wrong token
 *   - Missing DB / queue bindings → 500
 *   - Happy-path: enqueues probe jobs for alive agents, returns count
 *
 * Uses @cloudflare/vitest-pool-workers SELF.fetch() pattern.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
		CRON_AUTH_TOKEN?: string;
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
	`CREATE TABLE IF NOT EXISTS telemetry_events (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    latency_ms INTEGER, success INTEGER, status_code INTEGER,
    fraud_flag INTEGER DEFAULT 0, note TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_te_agent ON telemetry_events(agent_id, created_at)`,
	`CREATE TABLE IF NOT EXISTS probe_runs (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    endpoint TEXT, capability TEXT,
    probes_sent INTEGER, success_count INTEGER, p95_latency_ms INTEGER,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_pr_agent ON probe_runs(agent_id, created_at)`,
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL,
    p95_latency_ms INTEGER, probe_success REAL, cert_score REAL,
    reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rs_agent ON reputation_snapshots(agent_id, created_at)`,
	`CREATE TABLE IF NOT EXISTS certificates (
    cert_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    score REAL NOT NULL, grade TEXT NOT NULL, ci95_lo REAL, ci95_hi REAL,
    n_trials INTEGER NOT NULL, hmac_signature TEXT NOT NULL, ed25519_vc TEXT,
    evidence_uri TEXT, issued_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY, assigned_agent_id TEXT REFERENCES agent_addrs(agent_id),
    created_at INTEGER DEFAULT (unixepoch()))`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
	// CRON_AUTH_TOKEN is provided as a plain string via vitest.config.ts miniflare bindings,
	// overriding the Secrets Store object from wrangler.jsonc.
});

beforeEach(async () => {
	await env.DB.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM agent_facts;
    DELETE FROM clients;
    DELETE FROM agent_addrs;
    PRAGMA foreign_keys = ON;
  `);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('POST /api/cron/probe-scheduler — auth', () => {
	it('returns 401 when X-Cron-Auth header is missing', async () => {
		const res = await SELF.fetch('https://test.local/api/cron/probe-scheduler', {
			method: 'POST'
		});
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Unauthorized');
	});

	it('returns 401 when X-Cron-Auth header is wrong', async () => {
		const res = await SELF.fetch('https://test.local/api/cron/probe-scheduler', {
			method: 'POST',
			headers: { 'X-Cron-Auth': 'wrong-token' }
		});
		expect(res.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('POST /api/cron/probe-scheduler — inline probes', () => {
	it('probes alive agents and returns counts', async () => {
		// Seed 2 alive + 1 offline agent
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
			).bind('cron-alive-1', 'https://a1.test', 'alive'),
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
			).bind('cron-alive-2', 'https://a2.test', 'alive'),
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
			).bind('cron-offline-1', 'https://off.test', 'offline')
		]);

		const res = await SELF.fetch('https://test.local/api/cron/probe-scheduler', {
			method: 'POST',
			headers: { 'X-Cron-Auth': env.CRON_AUTH_TOKEN! }
		});
		expect(res.status).toBe(200);

		const body = (await res.json()) as { ok: boolean; probed: number; failed: number };
		expect(body.ok).toBe(true);
		// Both alive agents should be attempted (probed + failed = 2)
		expect(body.probed + body.failed).toBe(2);
	});

	it('returns probed=0 when no alive agents exist', async () => {
		const res = await SELF.fetch('https://test.local/api/cron/probe-scheduler', {
			method: 'POST',
			headers: { 'X-Cron-Auth': env.CRON_AUTH_TOKEN! }
		});
		expect(res.status).toBe(200);

		const body = (await res.json()) as { ok: boolean; probed: number; failed: number };
		expect(body.ok).toBe(true);
		expect(body.probed).toBe(0);
		expect(body.failed).toBe(0);
	});
});
