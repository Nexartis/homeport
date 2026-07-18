/**
 * Route-level Integration Tests — POST /api/queue/probe-run
 *
 * Covers:
 *   - CRON_AUTH_TOKEN auth: rejects missing token, wrong token
 *   - Validation: rejects invalid JSON, non-object body, missing/invalid fields
 *   - Idempotency: skips duplicate probes within 300s window
 *   - Partial failure recovery: re-runs computeReputation when probe exists but snapshot missing
 *   - Happy path: 200 with valid ProbeJobMessage (runProbe + computeReputation)
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
    created_at INTEGER DEFAULT (unixepoch()))`,
	// FK-child tables created by other test files — needed for safe cross-file cleanup
	`CREATE TABLE IF NOT EXISTS cert_revocations (
    cert_id TEXT PRIMARY KEY REFERENCES certificates(cert_id),
    reason TEXT NOT NULL, status_list_index INTEGER,
    revoked_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS cert_jobs (
    job_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    status TEXT DEFAULT 'pending', num_trials INTEGER DEFAULT 5,
    completed_trials INTEGER DEFAULT 0, pass_threshold REAL DEFAULT 0.8,
    score REAL, grade TEXT,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS trial_results (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES cert_jobs(job_id),
    trial_num INTEGER NOT NULL, topic TEXT DEFAULT 'general',
    prompt TEXT NOT NULL, expected TEXT NOT NULL,
    actual TEXT, score REAL, passed INTEGER, latency_ms INTEGER,
    evidence_r2_key TEXT, created_at INTEGER DEFAULT (unixepoch()))`
];

const URL = 'https://test.local/api/queue/probe-run';
const HEADERS = {
	'X-Cron-Auth': 'test-cron-token',
	'Content-Type': 'application/json'
};

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	// Delete FK-child tables before parents (shared D1, isolatedStorage: false)
	await env.DB.batch([
		// FK children first
		env.DB.prepare('DELETE FROM cert_revocations'),
		env.DB.prepare('DELETE FROM trial_results'),
		env.DB.prepare('DELETE FROM agent_facts'),
		env.DB.prepare('DELETE FROM clients'),
		// Leaf / self-contained tables
		env.DB.prepare('DELETE FROM telemetry_events'),
		env.DB.prepare('DELETE FROM probe_runs'),
		env.DB.prepare('DELETE FROM reputation_snapshots'),
		// Parents (safe after children removed)
		env.DB.prepare('DELETE FROM certificates'),
		env.DB.prepare('DELETE FROM cert_jobs'),
		env.DB.prepare('DELETE FROM agent_addrs')
	]);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('POST /api/queue/probe-run — auth', () => {
	it('returns 401 when X-Cron-Auth header is missing', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'a1', agent_url: 'https://a1.test' })
		});
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Unauthorized');
	});

	it('returns 401 when X-Cron-Auth header is wrong', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: { 'X-Cron-Auth': 'wrong-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'a1', agent_url: 'https://a1.test' })
		});
		expect(res.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('POST /api/queue/probe-run — validation', () => {
	it('returns 400 on invalid JSON body', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: 'not-json'
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid JSON body');
	});

	it('returns 400 when body is an array', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify([1, 2])
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Body must be a JSON object');
	});

	it('returns 400 when agent_id is missing', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_url: 'https://a1.test' })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid agent_id');
	});

	it('returns 400 when agent_url is missing', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_id: 'a1' })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid agent_url');
	});

	it('returns 400 when agent_id is not a string', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_id: 123, agent_url: 'https://a1.test' })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid agent_id');
	});

	it('returns 400 when agent_url is not a string', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_id: 'a1', agent_url: 42 })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid agent_url');
	});
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('POST /api/queue/probe-run — idempotency', () => {
	it('skips duplicate probe when both probe_run and reputation_snapshot exist within window', async () => {
		const agentId = 'idem-agent';
		const now = Math.floor(Date.now() / 1000);

		// Seed: recent probe run + reputation snapshot within the 300s window
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, "test", "test", "test")`
			).bind(agentId, 'https://idem.test'),
			env.DB.prepare(
				'INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
			).bind('pr-idem', agentId, 'https://idem.test/a2a', 5, 5, 50, now),
			env.DB.prepare(
				'INSERT INTO reputation_snapshots (id, agent_id, availability, reputation, created_at) VALUES (?, ?, ?, ?, ?)'
			).bind('rs-idem', agentId, 1.0, 0.9, now)
		]);

		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_id: agentId, agent_url: 'https://idem.test' })
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; skipped: boolean; reason: string };
		expect(body.ok).toBe(true);
		expect(body.skipped).toBe(true);
		expect(body.reason).toBe('idempotency');
	});

	it('re-runs computeReputation when probe exists but snapshot is missing (partial failure recovery)', async () => {
		const agentId = 'partial-agent';
		const now = Math.floor(Date.now() / 1000);

		// Seed: recent probe run but NO reputation snapshot → partial failure
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, "test", "test", "test")`
			).bind(agentId, 'https://partial.test'),
			env.DB.prepare(
				'INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
			).bind('pr-partial', agentId, 'https://partial.test/a2a', 5, 5, 50, now)
		]);

		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_id: agentId, agent_url: 'https://partial.test' })
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; recovered: boolean };
		expect(body.ok).toBe(true);
		expect(body.recovered).toBe(true);

		// Verify a reputation snapshot was created by the recovery path
		const snapshot = await env.DB.prepare('SELECT * FROM reputation_snapshots WHERE agent_id = ?')
			.bind(agentId)
			.first();
		expect(snapshot).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('POST /api/queue/probe-run — happy path', () => {
	it('returns 200 and runs full probe + reputation pipeline', { timeout: 15_000 }, async () => {
		const agentId = 'happy-probe-agent';

		// Seed an agent (runProbe will send A2A pings to agent_url — they'll fail
		// in test but the endpoint still returns 200 and records the probe run)
		await env.DB.prepare(
			`INSERT INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, "test", "test", "test")`
		)
			.bind(agentId, 'https://happy.test')
			.run();

		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ agent_id: agentId, agent_url: 'https://happy.test' })
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);

		// Verify probe run was recorded
		const probeRun = await env.DB.prepare('SELECT * FROM probe_runs WHERE agent_id = ?')
			.bind(agentId)
			.first();
		expect(probeRun).not.toBeNull();
		expect(probeRun!.agent_id).toBe(agentId);

		// Verify reputation snapshot was computed
		const snapshot = await env.DB.prepare('SELECT * FROM reputation_snapshots WHERE agent_id = ?')
			.bind(agentId)
			.first();
		expect(snapshot).not.toBeNull();
		expect(snapshot!.agent_id).toBe(agentId);
	});
});
