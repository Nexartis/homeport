/**
 * Observer / Evaluator Tests — telemetry ingestion, health aggregation,
 * reputation scoring, action triggers, cron scheduling.
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
	ingestTelemetry,
	healthForAgent,
	computeReputation,
	runScheduledProbes
} from '../src/lib/services/observer/service';
import { handleA2A } from '../src/lib/services/a2a';
import { createDbClient } from '../src/lib/db/client';
import type { Env } from '../src/lib/types';

// Type the test env
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

// Table definitions matching schema.sql
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
	// FK-dependent tables (may be created by registry tests, but needed for cleanup)
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY, assigned_agent_id TEXT REFERENCES agent_addrs(agent_id),
    created_at INTEGER DEFAULT (unixepoch()))`,
	// FK-child of certificates — needed for safe cleanup across shared D1
	`CREATE TABLE IF NOT EXISTS cert_revocations (
    cert_id TEXT PRIMARY KEY REFERENCES certificates(cert_id),
    reason TEXT NOT NULL, status_list_index INTEGER,
    revoked_at INTEGER DEFAULT (unixepoch()))`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

// Helper: clear observer tables between tests for isolation.
// Delete FK-child tables before parents to satisfy constraints. PRAGMA foreign_keys
// cannot be toggled across separate D1 API calls in CI workerd, so correct ordering
// is the only reliable approach with shared D1 (isolatedStorage: false).
async function clearObserverTables() {
	await env.DB.batch([
		// FK children first
		env.DB.prepare('DELETE FROM cert_revocations'),
		env.DB.prepare('DELETE FROM agent_facts'),
		env.DB.prepare('DELETE FROM clients'),
		// Leaf tables
		env.DB.prepare('DELETE FROM telemetry_events'),
		env.DB.prepare('DELETE FROM probe_runs'),
		env.DB.prepare('DELETE FROM reputation_snapshots'),
		// Parents (safe after children removed)
		env.DB.prepare('DELETE FROM certificates'),
		env.DB.prepare('DELETE FROM agent_addrs')
	]);
}

// ---------------------------------------------------------------------------
// Telemetry Ingestion
// ---------------------------------------------------------------------------

describe('ingestTelemetry', () => {
	beforeEach(async () => {
		await clearObserverTables();
	});

	it('writes event to D1 and returns id', async () => {
		const result = await ingestTelemetry(db, {
			agent_id: 'agent-obs-1',
			latency_ms: 120,
			success: true,
			status_code: 200
		});

		expect(result.id).toBeDefined();
		expect(typeof result.id).toBe('string');

		// Verify the row in D1
		const row = await env.DB.prepare('SELECT * FROM telemetry_events WHERE id = ?')
			.bind(result.id)
			.first();
		expect(row).not.toBeNull();
		expect(row!.agent_id).toBe('agent-obs-1');
		expect(row!.latency_ms).toBe(120);
		expect(row!.success).toBe(1);
		expect(row!.status_code).toBe(200);
		expect(row!.fraud_flag).toBe(0);
	});

	it('rejects empty agent_id', async () => {
		await expect(
			ingestTelemetry(db, {
				agent_id: '',
				latency_ms: 100,
				success: true
			})
		).rejects.toThrow('[ingestTelemetry] agent_id must be a non-empty string');
	});

	it('stores fraud_flag and note correctly', async () => {
		const result = await ingestTelemetry(db, {
			agent_id: 'agent-obs-fraud',
			latency_ms: 500,
			success: false,
			status_code: 500,
			fraud_flag: true,
			note: 'suspicious response'
		});

		const row = await env.DB.prepare('SELECT * FROM telemetry_events WHERE id = ?')
			.bind(result.id)
			.first();
		expect(row!.fraud_flag).toBe(1);
		expect(row!.success).toBe(0);
		expect(row!.note).toBe('suspicious response');
	});
});

// ---------------------------------------------------------------------------
// Health Aggregation
// ---------------------------------------------------------------------------

describe('healthForAgent', () => {
	beforeEach(async () => {
		await clearObserverTables();
	});

	it('returns zeros for agent with no events', async () => {
		const health = await healthForAgent(db, 'ghost-agent');
		expect(health.agent_id).toBe('ghost-agent');
		expect(health.total_events).toBe(0);
		expect(health.availability).toBe(0);
		expect(health.error_rate).toBe(0);
		expect(health.fraud_rate).toBe(0);
		expect(health.p95_latency_ms).toBeNull();
	});

	it('computes correct availability (3 success / 4 total = 0.75)', async () => {
		// Insert 3 successes and 1 failure
		for (let i = 0; i < 3; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-health',
				latency_ms: 100 + i * 10,
				success: true,
				status_code: 200
			});
		}
		await ingestTelemetry(db, {
			agent_id: 'agent-health',
			latency_ms: 500,
			success: false,
			status_code: 500
		});

		const health = await healthForAgent(db, 'agent-health');
		expect(health.total_events).toBe(4);
		expect(health.success_count).toBe(3);
		expect(health.error_count).toBe(1);
		expect(health.availability).toBe(0.75);
		expect(health.error_rate).toBe(0.25);
	});

	it('computes correct fraud_rate', async () => {
		// 2 normal events + 1 fraud event = fraud_rate 1/3
		await ingestTelemetry(db, {
			agent_id: 'agent-fraud',
			latency_ms: 100,
			success: true
		});
		await ingestTelemetry(db, {
			agent_id: 'agent-fraud',
			latency_ms: 110,
			success: true
		});
		await ingestTelemetry(db, {
			agent_id: 'agent-fraud',
			latency_ms: 200,
			success: true,
			fraud_flag: true
		});

		const health = await healthForAgent(db, 'agent-fraud');
		expect(health.fraud_count).toBe(1);
		expect(health.fraud_rate).toBeCloseTo(1 / 3, 5);
	});

	it('computes p95 latency from sorted values', async () => {
		// Insert 20 events with latencies 10, 20, 30, ..., 200
		for (let i = 1; i <= 20; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-p95',
				latency_ms: i * 10,
				success: true
			});
		}

		const health = await healthForAgent(db, 'agent-p95');
		// p95 of [10,20,...,200]: index = floor(0.95 * 20) = 19 → sorted[19] = 200
		expect(health.p95_latency_ms).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// Reputation Computation
// ---------------------------------------------------------------------------

describe('computeReputation', () => {
	beforeEach(async () => {
		await clearObserverTables();
	});

	it('applies weights correctly: 0.4×avail + 0.4×probe + 0.2×cert − 0.1×fraud', async () => {
		// Setup: 100% availability (5 successes), no fraud
		for (let i = 0; i < 5; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-rep',
				latency_ms: 50,
				success: true
			});
		}
		// Insert a probe run: 3/3 success
		await env.DB.prepare(
			`INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms)
         VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind('probe-1', 'agent-rep', 'https://agent.test/a2a', 3, 3, 50)
			.run();
		// Insert a certificate with score 0.9
		await env.DB.prepare(
			`INSERT INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind('cert-1', 'agent-rep', 'math', 0.9, 'A', 10, 'sig-test')
			.run();

		const rep = await computeReputation(db, 'agent-rep');

		// Expected: 0.4*1.0 + 0.4*1.0 + 0.2*0.9 - 0.1*0.0 = 0.4+0.4+0.18 = 0.98
		expect(rep.availability).toBe(1.0);
		expect(rep.probe_success).toBeCloseTo(1.0);
		expect(rep.cert_score).toBe(0.9);
		expect(rep.fraud_rate).toBe(0);
		expect(rep.reputation).toBeCloseTo(0.98, 4);
	});

	it('clamps result to [0.0, 1.0] — no overflow above 1.0', async () => {
		// All perfect scores should clamp to 1.0
		for (let i = 0; i < 5; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-clamp-hi',
				latency_ms: 50,
				success: true
			});
		}
		await env.DB.prepare(
			`INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms)
         VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind('probe-clamp', 'agent-clamp-hi', 'https://agent.test/a2a', 3, 3, 50)
			.run();
		await env.DB.prepare(
			`INSERT INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind('cert-clamp', 'agent-clamp-hi', 'math', 1.0, 'A+', 10, 'sig-test')
			.run();

		const rep = await computeReputation(db, 'agent-clamp-hi');
		// 0.4*1 + 0.4*1 + 0.2*1 - 0.1*0 = 1.0 (exact)
		expect(rep.reputation).toBeLessThanOrEqual(1.0);
		expect(rep.reputation).toBeGreaterThanOrEqual(0.0);
	});

	it('clamps result to [0.0, 1.0] — no underflow below 0.0', async () => {
		// All failures + high fraud
		for (let i = 0; i < 5; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-clamp-lo',
				latency_ms: 5000,
				success: false,
				fraud_flag: true
			});
		}
		// No probes, no cert — everything is 0 or bad
		const rep = await computeReputation(db, 'agent-clamp-lo');
		// 0.4*0 + 0.4*0 + 0.2*0 - 0.1*1.0 = -0.1 → clamped to 0.0
		expect(rep.reputation).toBe(0.0);
	});

	it('always includes monitor as default action (P1-9)', async () => {
		// Simple healthy agent — should always have monitor
		await ingestTelemetry(db, { agent_id: 'agent-monitor', latency_ms: 50, success: true });
		const rep = await computeReputation(db, 'agent-monitor');
		expect(rep.actions).toContain('monitor');
	});

	it('triggers recert_requested when probe drops ≥15% below cert (n≥10)', async () => {
		// Insert 12 events (≥ RECERT_MIN_N = 10) with low success
		for (let i = 0; i < 12; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-recert',
				latency_ms: 100,
				success: i < 4 // only 4 out of 12 succeed → availability ~ 0.33
			});
		}
		// Probe with 1/3 success
		await env.DB.prepare(
			`INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms)
         VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind('probe-recert', 'agent-recert', 'https://agent.test/a2a', 3, 1, 100)
			.run();
		// Cert score 0.85 → probe_success (0.33) < cert_score (0.85) - 0.15 = 0.70 → trigger
		await env.DB.prepare(
			`INSERT INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind('cert-recert', 'agent-recert', 'math', 0.85, 'B', 10, 'sig-test')
			.run();

		const rep = await computeReputation(db, 'agent-recert');
		expect(rep.actions).toContain('monitor');
		expect(rep.actions).toContain('recert_requested');
	});

	it('does NOT trigger recert_requested when n < 10', async () => {
		// Only 5 events (< RECERT_MIN_N = 10) — recert should NOT fire
		for (let i = 0; i < 5; i++) {
			await ingestTelemetry(db, {
				agent_id: 'agent-no-recert',
				latency_ms: 100,
				success: false
			});
		}
		// Probe failure
		await env.DB.prepare(
			`INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms)
         VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind('probe-no-recert', 'agent-no-recert', 'https://agent.test/a2a', 3, 0, 100)
			.run();
		// Cert score 0.9 → probe_success (0) < 0.9 - 0.15 = 0.75, BUT n < 10
		await env.DB.prepare(
			`INSERT INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind('cert-no-recert', 'agent-no-recert', 'math', 0.9, 'A', 10, 'sig-test')
			.run();

		const rep = await computeReputation(db, 'agent-no-recert');
		expect(rep.actions).not.toContain('recert_requested');
	});

	it('triggers rate_limit when reputation < 0.5 (P1-8)', async () => {
		// All failures → reputation will be very low → rate_limit triggered
		for (let i = 0; i < 5; i++) {
			await ingestTelemetry(db, { agent_id: 'agent-ratelimit', latency_ms: 100, success: false });
		}

		const rep = await computeReputation(db, 'agent-ratelimit');
		expect(rep.reputation).toBeLessThan(0.5);
		expect(rep.actions).toContain('rate_limit');
		expect(rep.actions).toContain('monitor');
	});

	it('does NOT trigger rate_limit when reputation ≥ 0.5', async () => {
		// All successes + probe + cert → reputation high → no rate_limit
		for (let i = 0; i < 10; i++) {
			await ingestTelemetry(db, { agent_id: 'agent-no-ratelimit', latency_ms: 50, success: true });
		}
		// Add probe run: all probes pass → probe_success = 1.0
		await env.DB.prepare(
			`INSERT INTO probe_runs (id, agent_id, endpoint, probes_sent, success_count, p95_latency_ms)
         VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind('probe-noratelimit', 'agent-no-ratelimit', 'https://agent.test/a2a', 5, 5, 50)
			.run();
		// Add cert with good score → cert_score = 0.9
		await env.DB.prepare(
			`INSERT INTO certificates (cert_id, agent_id, capability, score, grade, n_trials, hmac_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
			.bind('cert-noratelimit', 'agent-no-ratelimit', 'math', 0.9, 'A', 10, 'sig-test')
			.run();

		const rep = await computeReputation(db, 'agent-no-ratelimit');
		// rep = 0.4×1.0 + 0.4×1.0 + 0.2×0.9 = 0.98
		expect(rep.reputation).toBeGreaterThanOrEqual(0.5);
		expect(rep.actions).not.toContain('rate_limit');
		expect(rep.actions).toContain('monitor');
	});

	it('persists snapshot to reputation_snapshots table', async () => {
		await ingestTelemetry(db, {
			agent_id: 'agent-snapshot',
			latency_ms: 80,
			success: true
		});

		const rep = await computeReputation(db, 'agent-snapshot');

		const row = await env.DB.prepare('SELECT * FROM reputation_snapshots WHERE agent_id = ?')
			.bind('agent-snapshot')
			.first();
		expect(row).not.toBeNull();
		expect(row!.reputation).toBe(rep.reputation);
		expect(row!.availability).toBe(rep.availability);
		const actions = JSON.parse(row!.actions as string);
		expect(actions).toEqual(rep.actions);
	});
});

// ---------------------------------------------------------------------------
// Cron: runScheduledProbes
// ---------------------------------------------------------------------------

describe('runScheduledProbes', () => {
	beforeEach(async () => {
		// Delete FK-child tables before parents (shared D1, isolatedStorage: false)
		await env.DB.batch([
			env.DB.prepare('DELETE FROM agent_facts'),
			env.DB.prepare('DELETE FROM clients'),
			env.DB.prepare('DELETE FROM agent_addrs')
		]);
	});

	it('processes alive agents and returns probed count', async () => {
		// Insert 3 agents: 2 alive, 1 offline
		await env.DB.batch([
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
			).bind('alive-1', 'https://alive1.test', 'alive'),
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
			).bind('alive-2', 'https://alive2.test', 'alive'),
			env.DB.prepare(
				`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
			).bind('offline-1', 'https://offline.test', 'offline')
		]);

		// runScheduledProbes processes inline — probes will fail for test URLs
		// but the function should still return counts (failed probes are caught)
		const result = await runScheduledProbes(db, env as unknown as Env);
		// Both alive agents should be attempted
		expect(result.probed + result.failed).toBe(2);
	});

	it('returns 0 when no alive agents exist', async () => {
		await env.DB.prepare(
			`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, "test", "test", "test")`
		)
			.bind('dead-1', 'https://dead.test', 'offline')
			.run();

		const result = await runScheduledProbes(db, env as unknown as Env);
		expect(result.probed).toBe(0);
		expect(result.failed).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// runProbe — D1 persistence (fetch is mocked by the test environment)
// ---------------------------------------------------------------------------

describe('runProbe', () => {
	beforeEach(async () => {
		await clearObserverTables();
	});

	it('records probe_run in D1 after probing', async () => {
		// Import runProbe separately since it makes real fetch calls.
		// In the test environment, fetch will fail (no real server), so success_count = 0
		// but the probe_run row should still be persisted.
		const { runProbe: runProbeImpl } = await import('../src/lib/services/observer/service');

		const result = await runProbeImpl(db, 'agent-probe-test', 'https://localhost:9999');

		expect(result.probes_sent).toBe(3);
		expect(typeof result.id).toBe('string');
		expect(typeof result.p95_latency_ms).toBe('number');

		// Verify D1 row
		const row = await env.DB.prepare('SELECT * FROM probe_runs WHERE id = ?')
			.bind(result.id)
			.first();
		expect(row).not.toBeNull();
		expect(row!.agent_id).toBe('agent-probe-test');
		expect(row!.probes_sent).toBe(3);

		// Verify telemetry events were also created (3 probe pings)
		const { results } = await env.DB.prepare('SELECT * FROM telemetry_events WHERE agent_id = ?')
			.bind('agent-probe-test')
			.all();
		expect(results.length).toBe(3);
	});
});

// ---------- P4-4: A2A Integration Tests (Observer routing) ----------

/** Helper to build an A2A JSON-RPC request */
function buildA2ARequest(action: string, payload: Record<string, unknown>, id?: string): Request {
	return new Request('https://test.local/a2a', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'message/send',
			params: {
				message: {
					role: 'user',
					parts: [{ text: JSON.stringify({ action, ...payload }) }]
				}
			},
			id: id ?? 'test-1'
		})
	});
}

describe('A2A routing — Observer actions (P4-4)', () => {
	beforeEach(async () => {
		await clearObserverTables();
	});

	it('telemetry.ingest creates a telemetry event via A2A', async () => {
		const req = buildA2ARequest('telemetry.ingest', {
			agent_id: 'a2a-observer-agent',
			latency_ms: 120,
			success: true,
			status_code: 200
		});
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			jsonrpc: string;
			result: { parts: Array<{ text: string }> };
			id: string;
		};
		expect(body.jsonrpc).toBe('2.0');

		const result = JSON.parse(body.result.parts[0].text) as { id: string };
		expect(result.id).toBeDefined();

		// Verify the event was persisted
		const row = await env.DB.prepare(
			'SELECT agent_id, latency_ms, success FROM telemetry_events WHERE id = ?'
		)
			.bind(result.id)
			.first<{ agent_id: string; latency_ms: number; success: number }>();
		expect(row).not.toBeNull();
		expect(row!.agent_id).toBe('a2a-observer-agent');
		expect(row!.latency_ms).toBe(120);
		expect(row!.success).toBe(1);
	});

	it('observer.health returns health snapshot via A2A', async () => {
		// Seed some telemetry events first
		await ingestTelemetry(db, { agent_id: 'a2a-health-agent', latency_ms: 50, success: true });
		await ingestTelemetry(db, { agent_id: 'a2a-health-agent', latency_ms: 80, success: true });
		await ingestTelemetry(db, {
			agent_id: 'a2a-health-agent',
			latency_ms: 200,
			success: false,
			status_code: 500
		});

		const req = buildA2ARequest('observer.health', { agent_id: 'a2a-health-agent' });
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(200);

		const body = (await res.json()) as { result: { parts: Array<{ text: string }> } };
		const result = JSON.parse(body.result.parts[0].text) as {
			agent_id: string;
			total_events: number;
			availability: number;
		};
		expect(result.agent_id).toBe('a2a-health-agent');
		expect(result.total_events).toBe(3);
		// 2 out of 3 succeeded → ~0.667 availability
		expect(result.availability).toBeCloseTo(0.667, 1);
	});

	it('returns JSON-RPC error for unknown observer action', async () => {
		const req = buildA2ARequest('observer.nonexistent', { agent_id: 'test' });
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(400);

		const body = (await res.json()) as { error: { code: number; message: string } };
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown observer action');
	});

	it('returns JSON-RPC error for missing agent_id on telemetry.ingest', async () => {
		const req = buildA2ARequest('telemetry.ingest', { latency_ms: 50 });
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(400);

		const body = (await res.json()) as { error: { code: number; message: string } };
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id must be a non-empty string');
	});
});
