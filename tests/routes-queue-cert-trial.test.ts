/**
 * Route-level Integration Tests — POST /api/queue/cert-trial
 *
 * Covers:
 *   - CRON_AUTH_TOKEN auth: rejects missing token, wrong token
 *   - Validation: rejects invalid JSON, non-object body, missing/invalid fields
 *   - Validation: pass_threshold must be in [0, 1]
 *   - Happy path: 200 with valid CertJobMessage (processSingleTrial runs)
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
		KYM_NANDA_HMAC_SECRET: string;
		KYM_NANDA_ED25519_PRIVATE_KEY_v1: string;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
		NANDA_ED25519_PUBLIC_KEY_v1: string;
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
    evidence_r2_key TEXT, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_results_job_trial
    ON trial_results(job_id, trial_num)`,
	`CREATE TABLE IF NOT EXISTS certificates (
    cert_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    score REAL NOT NULL, grade TEXT NOT NULL, ci95_lo REAL, ci95_hi REAL,
    n_trials INTEGER NOT NULL, hmac_signature TEXT NOT NULL, ed25519_vc TEXT,
    evidence_uri TEXT, issued_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	// FK-child tables created by other test files — needed for safe cross-file cleanup
	`CREATE TABLE IF NOT EXISTS cert_revocations (
    cert_id TEXT PRIMARY KEY REFERENCES certificates(cert_id),
    reason TEXT NOT NULL, status_list_index INTEGER,
    revoked_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY, assigned_agent_id TEXT REFERENCES agent_addrs(agent_id),
    created_at INTEGER DEFAULT (unixepoch()))`
];

const URL = 'https://test.local/api/queue/cert-trial';
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
		// Parents (safe after children removed)
		env.DB.prepare('DELETE FROM certificates'),
		env.DB.prepare('DELETE FROM cert_jobs'),
		env.DB.prepare('DELETE FROM agent_addrs')
	]);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('POST /api/queue/cert-trial — auth', () => {
	it('returns 401 when X-Cron-Auth header is missing', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Unauthorized');
	});

	it('returns 401 when X-Cron-Auth header is wrong', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: { 'X-Cron-Auth': 'wrong-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		expect(res.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('POST /api/queue/cert-trial — validation', () => {
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
			body: JSON.stringify([1, 2, 3])
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Body must be a JSON object');
	});

	it('returns 400 when required fields are missing', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({ job_id: 'j1' })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Missing or invalid required fields');
	});

	it('returns 400 when trial_num is not a positive integer', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: 'j1',
				agent_id: 'a1',
				capability: 'math',
				trial_num: 0,
				pass_threshold: 0.8
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Missing or invalid required fields');
	});

	it('returns 400 when trial_num is a float', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: 'j1',
				agent_id: 'a1',
				capability: 'math',
				trial_num: 1.5,
				pass_threshold: 0.8
			})
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when pass_threshold is missing', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: 'j1',
				agent_id: 'a1',
				capability: 'math',
				trial_num: 1
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('pass_threshold must be a number between 0 and 1');
	});

	it('returns 400 when pass_threshold > 1', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: 'j1',
				agent_id: 'a1',
				capability: 'math',
				trial_num: 1,
				pass_threshold: 1.5
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('pass_threshold must be a number between 0 and 1');
	});

	it('returns 400 when pass_threshold < 0', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: 'j1',
				agent_id: 'a1',
				capability: 'math',
				trial_num: 1,
				pass_threshold: -0.1
			})
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when pass_threshold is NaN', async () => {
		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: 'j1',
				agent_id: 'a1',
				capability: 'math',
				trial_num: 1,
				pass_threshold: 'high'
			})
		});
		expect(res.status).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('POST /api/queue/cert-trial — happy path', () => {
	it('returns 200 and processes a valid trial message', async () => {
		// Seed: create a cert_job and an agent so processSingleTrial can look up the agent URL
		const jobId = crypto.randomUUID();
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, "test", "test", "test")`
			).bind('trial-agent', 'https://agent.test'),
			env.DB.prepare(
				`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials, pass_threshold)
         VALUES (?, 'trial-agent', 'math', 'running', 5, 0, 0.8)`
			).bind(jobId)
		]);

		const res = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: jobId,
				agent_id: 'trial-agent',
				capability: 'math',
				trial_num: 1,
				pass_threshold: 0.8
			})
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);

		// Verify trial result was inserted into D1
		const trial = await env.DB.prepare(
			'SELECT * FROM trial_results WHERE job_id = ? AND trial_num = 1'
		)
			.bind(jobId)
			.first();
		expect(trial).not.toBeNull();
		expect(trial!.job_id).toBe(jobId);

		// Verify evidence was stored in R2
		const evidenceKey = `evidence/${jobId}/1.json`;
		const r2Obj = await env.KYM_NANDA_EVIDENCE.get(evidenceKey);
		expect(r2Obj).not.toBeNull();
	});

	it('accepts pass_threshold at boundary values 0 and 1', async () => {
		const jobId = crypto.randomUUID();
		await env.DB.batch([
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, "test", "test", "test")`
			).bind('boundary-agent', 'https://agent.test'),
			env.DB.prepare(
				`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials, pass_threshold)
         VALUES (?, 'boundary-agent', 'math', 'running', 5, 0, 0.0)`
			).bind(jobId)
		]);

		// pass_threshold = 0 (boundary)
		const res0 = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: jobId,
				agent_id: 'boundary-agent',
				capability: 'math',
				trial_num: 1,
				pass_threshold: 0
			})
		});
		expect(res0.status).toBe(200);

		// pass_threshold = 1 (boundary)
		const jobId2 = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials, pass_threshold)
       VALUES (?, 'boundary-agent', 'math', 'running', 5, 0, 1.0)`
		)
			.bind(jobId2)
			.run();

		const res1 = await SELF.fetch(URL, {
			method: 'POST',
			headers: HEADERS,
			body: JSON.stringify({
				job_id: jobId2,
				agent_id: 'boundary-agent',
				capability: 'math',
				trial_num: 1,
				pass_threshold: 1
			})
		});
		expect(res1.status).toBe(200);
	});
});
