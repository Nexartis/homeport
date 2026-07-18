/**
 *
 * Covers:
 *   - Valid message → probe + reputation executed, ack'd
 *   - Invalid agent_id / agent_url → ack'd without processing
 *   - Idempotency: duplicate within window → ack'd, skipped
 *   - Max-retry guardrail: ack after 5 attempts
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { processProbeBatch } from '../src/lib/services/observer/queue-handler';
import { createDbClient } from '../src/lib/db/client';
import type { ProbeJobMessage } from '../src/lib/types';

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
});

async function clearTables() {
	// Only clear tables that queue-consumer tests actually write to.
	// Avoids FK issues with certificates → cert_revocations (created by other test files).
	await env.DB.batch([
		env.DB.prepare('DELETE FROM telemetry_events'),
		env.DB.prepare('DELETE FROM probe_runs'),
		env.DB.prepare('DELETE FROM reputation_snapshots')
	]);
}

/** Helper to build a mock MessageBatch */
function buildBatch(
	messages: Array<{
		body: ProbeJobMessage;
		ack: ReturnType<typeof vi.fn>;
		retry: ReturnType<typeof vi.fn>;
		attempts?: number;
	}>
): MessageBatch<ProbeJobMessage> {
	return {
		messages: messages.map((m, i) => ({
			body: m.body,
			id: `msg-${i}`,
			timestamp: new Date(),
			attempts: m.attempts ?? 1,
			ack: m.ack,
			retry: m.retry
		})),
		ackAll: vi.fn(),
		retryAll: vi.fn()
	} as unknown as MessageBatch<ProbeJobMessage>;
}

// ---------------------------------------------------------------------------
// processProbeBatch
// ---------------------------------------------------------------------------

describe('processProbeBatch (probe batch processor)', () => {
	beforeEach(async () => {
		await clearTables();
	});

	it('processes a valid message: runs probe + reputation, then acks', async () => {
		// Insert an alive agent
		await env.DB.prepare(
			`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, 'test', 'test', 'test')`
		)
			.bind('pqc-alpha', 'https://pqc-alpha.test', 'alive')
			.run();

		const ack = vi.fn();
		const retry = vi.fn();
		const batch = buildBatch([
			{ body: { agent_id: 'pqc-alpha', agent_url: 'https://pqc-alpha.test' }, ack, retry }
		]);

		await processProbeBatch(batch, env as never);

		expect(ack).toHaveBeenCalledOnce();
		expect(retry).not.toHaveBeenCalled();

		// Verify a probe_run was inserted
		const run = await env.DB.prepare('SELECT * FROM probe_runs WHERE agent_id = ?')
			.bind('pqc-alpha')
			.first();
		expect(run).not.toBeNull();
		expect(run!.probes_sent).toBe(3);

		// Verify reputation snapshot was created
		const snap = await env.DB.prepare('SELECT * FROM reputation_snapshots WHERE agent_id = ?')
			.bind('pqc-alpha')
			.first();
		expect(snap).not.toBeNull();
	});

	it('acks and skips message with empty agent_id', async () => {
		const ack = vi.fn();
		const retry = vi.fn();
		const batch = buildBatch([
			{ body: { agent_id: '', agent_url: 'https://any.test' } as ProbeJobMessage, ack, retry }
		]);

		await processProbeBatch(batch, env as never);

		expect(ack).toHaveBeenCalledOnce();
		expect(retry).not.toHaveBeenCalled();
	});

	it('acks and skips message with empty agent_url', async () => {
		const ack = vi.fn();
		const retry = vi.fn();
		const batch = buildBatch([
			{ body: { agent_id: 'any-agent', agent_url: '' } as ProbeJobMessage, ack, retry }
		]);

		await processProbeBatch(batch, env as never);

		expect(ack).toHaveBeenCalledOnce();
		expect(retry).not.toHaveBeenCalled();
	});

	it('idempotency: acks without re-probing when recent run exists', async () => {
		// Insert agent
		await env.DB.prepare(
			`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, 'test', 'test', 'test')`
		)
			.bind('idemp-agent', 'https://idemp.test', 'alive')
			.run();

		// Insert a recent probe run (within the 300s window)
		await env.DB.prepare(
			`INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				'existing-run',
				'idemp-agent',
				'https://idemp.test',
				3,
				3,
				50,
				Math.floor(Date.now() / 1000)
			)
			.run();

		const ack = vi.fn();
		const retry = vi.fn();
		const batch = buildBatch([
			{ body: { agent_id: 'idemp-agent', agent_url: 'https://idemp.test' }, ack, retry }
		]);

		await processProbeBatch(batch, env as never);

		expect(ack).toHaveBeenCalledOnce();
		expect(retry).not.toHaveBeenCalled();

		// Should still only have the original probe run (no new one)
		const { results } = await env.DB.prepare('SELECT * FROM probe_runs WHERE agent_id = ?')
			.bind('idemp-agent')
			.all();
		expect(results.length).toBe(1);
		expect(results[0].id).toBe('existing-run');
	});

	it('retries on processing error, acks at max attempts (5)', async () => {
		const ack = vi.fn();
		const retry = vi.fn();

		// First attempt (attempt=1) — should retry
		const batch1 = buildBatch([
			{
				body: { agent_id: 'error-agent', agent_url: 'https://error.test' },
				ack,
				retry,
				attempts: 1
			}
		]);

		// Sabotage env.DB.prepare — Drizzle ORM calls prepare() for all queries,
		// so this forces an error in getRecentProbeRun before runProbe is reached.
		const origPrepare = env.DB.prepare;
		env.DB.prepare = () => {
			throw new Error('DB sabotaged');
		};

		await processProbeBatch(batch1, env as never);

		// Restore immediately
		env.DB.prepare = origPrepare;

		// At attempt 1, should retry (not ack)
		expect(retry).toHaveBeenCalledOnce();
		expect(ack).not.toHaveBeenCalled();

		// At attempt 5 (max), should ack instead of retry
		const ack5 = vi.fn();
		const retry5 = vi.fn();
		const batch5 = buildBatch([
			{
				body: { agent_id: 'error-agent', agent_url: 'https://error.test' },
				ack: ack5,
				retry: retry5,
				attempts: 5
			}
		]);

		env.DB.prepare = () => {
			throw new Error('DB sabotaged');
		};
		await processProbeBatch(batch5, env as never);
		env.DB.prepare = origPrepare;

		expect(ack5).toHaveBeenCalledOnce();
		expect(retry5).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Route-level tests — POST /api/queue/probe-run (SELF.fetch)
// ---------------------------------------------------------------------------

describe('POST /api/queue/probe-run — route', () => {
	const VALID_HEADERS = {
		'Content-Type': 'application/json',
		'X-Cron-Auth': 'test-cron-token'
	};

	it('returns 401 when X-Cron-Auth is missing', async () => {
		const res = await SELF.fetch('https://test.local/api/queue/probe-run', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'a', agent_url: 'https://a.test' })
		});
		expect(res.status).toBe(401);
	});

	it('returns 401 when X-Cron-Auth is wrong', async () => {
		const res = await SELF.fetch('https://test.local/api/queue/probe-run', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Cron-Auth': 'wrong' },
			body: JSON.stringify({ agent_id: 'a', agent_url: 'https://a.test' })
		});
		expect(res.status).toBe(401);
	});

	it('returns 400 when body is not a JSON object (null)', async () => {
		const res = await SELF.fetch('https://test.local/api/queue/probe-run', {
			method: 'POST',
			headers: VALID_HEADERS,
			body: 'null'
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('JSON object');
	});

	it('returns 400 when body is an array', async () => {
		const res = await SELF.fetch('https://test.local/api/queue/probe-run', {
			method: 'POST',
			headers: VALID_HEADERS,
			body: '[]'
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when agent_id is missing', async () => {
		const res = await SELF.fetch('https://test.local/api/queue/probe-run', {
			method: 'POST',
			headers: VALID_HEADERS,
			body: JSON.stringify({ agent_url: 'https://a.test' })
		});
		expect(res.status).toBe(400);
	});
});
