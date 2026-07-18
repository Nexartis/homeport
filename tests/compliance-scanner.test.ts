/**
 * Compliance Scanner Tests — Agent Beta Phase 3
 *
 * Covers:
 *   - scanAgent: evaluates single agent against compliance thresholds
 *   - scanAllAgents: batch scan for all alive agents
 *   - getLastScanResults: retrieves recent scan results
 *   - Threshold checks: MIN_REPUTATION=0.30, MAX_FRAUD_RATE=0.10, MIN_AVAILABILITY=0.50
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
	scanAgent,
	scanAllAgents,
	getLastScanResults
} from '../src/lib/services/compliance/scanner';
import { createDbClient } from '../src/lib/db/client';

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

// Table setup
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
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL, p95_latency_ms REAL,
    probe_success REAL, cert_score REAL, reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS compliance_scan_runs (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    policy_id TEXT NOT NULL, decision TEXT NOT NULL,
    reasons TEXT, scan_type TEXT DEFAULT 'scheduled',
    created_at INTEGER DEFAULT (unixepoch()))`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	// Delete child tables referencing agents first to avoid FK constraint errors
	// Tables from other test suites may not exist, so delete individually
	for (const tbl of [
		'compliance_scan_runs',
		'reputation_snapshots',
		'agent_facts',
		'clients',
		'agent_versions',
		'agent_addrs'
	]) {
		try {
			await env.DB.prepare(`DELETE FROM ${tbl}`).run();
		} catch {
			/* table may not exist */
		}
	}
});

// ─── Helpers ────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);

async function seedAgent(agentId: string) {
	await env.DB.prepare(
		`INSERT INTO agent_addrs (agent_id, agent_url, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, 'alive', 'test', 'test', 'test')`
	)
		.bind(agentId, `https://${agentId}.test`)
		.run();
}

async function seedReputation(
	agentId: string,
	reputation: number,
	availability: number,
	fraudRate: number
) {
	await env.DB.prepare(
		`INSERT INTO reputation_snapshots (id, agent_id, reputation, availability, fraud_rate, error_rate, created_at)
     VALUES (?, ?, ?, ?, ?, 0.01, ?)`
	)
		.bind(`rep-${agentId}-${now}`, agentId, reputation, availability, fraudRate, now)
		.run();
}

// ─── scanAgent Tests ────────────────────────────────────────────

describe('scanAgent', () => {
	it('should ALLOW compliant agent', async () => {
		await seedAgent('good-agent');
		await seedReputation('good-agent', 0.85, 0.95, 0.01);

		const result = await scanAgent(db, 'good-agent');

		expect(result.decision).toBe('ALLOW');
		expect(result.agent_id).toBe('good-agent');
		expect(result.policy_id).toBe('minimum-standards');
		expect(result.reasons).toContain('All compliance checks passed');
	});

	it('should DENY agent with low reputation', async () => {
		await seedAgent('low-rep-agent');
		await seedReputation('low-rep-agent', 0.1, 0.95, 0.01);

		const result = await scanAgent(db, 'low-rep-agent');

		expect(result.decision).toBe('DENY');
		expect(result.reasons.some((r: string) => r.includes('Reputation'))).toBe(true);
	});

	it('should DENY agent with high fraud rate', async () => {
		await seedAgent('fraud-agent');
		await seedReputation('fraud-agent', 0.85, 0.95, 0.2);

		const result = await scanAgent(db, 'fraud-agent');

		expect(result.decision).toBe('DENY');
		expect(result.reasons.some((r: string) => r.includes('Fraud rate'))).toBe(true);
	});

	it('should ESCALATE agent with low availability', async () => {
		await seedAgent('low-avail-agent');
		await seedReputation('low-avail-agent', 0.85, 0.3, 0.01);

		const result = await scanAgent(db, 'low-avail-agent');

		expect(result.decision).toBe('ESCALATE');
		expect(result.reasons.some((r: string) => r.includes('Availability'))).toBe(true);
	});

	it('should ESCALATE agent with no reputation data', async () => {
		await seedAgent('no-data-agent');

		const result = await scanAgent(db, 'no-data-agent');

		expect(result.decision).toBe('ESCALATE');
		expect(result.reasons).toContain('No reputation data available for evaluation');
	});

	it('should persist scan result to compliance_scan_runs', async () => {
		await seedAgent('persist-agent');
		await seedReputation('persist-agent', 0.85, 0.95, 0.01);

		const result = await scanAgent(db, 'persist-agent');

		const stored = await getLastScanResults(db, 'persist-agent', 1);
		expect(stored.length).toBe(1);
		expect(stored[0].id).toBe(result.id);
		expect(stored[0].decision).toBe('ALLOW');
	});

	it('should DENY over ESCALATE when both reputation and availability fail', async () => {
		await seedAgent('bad-agent');
		await seedReputation('bad-agent', 0.1, 0.3, 0.01);

		const result = await scanAgent(db, 'bad-agent');

		// DENY takes priority because reputation check runs first
		expect(result.decision).toBe('DENY');
	});
});

// ─── scanAllAgents Tests ────────────────────────────────────────

describe('scanAllAgents', () => {
	it('should scan all alive agents', async () => {
		await seedAgent('agent-a');
		await seedAgent('agent-b');
		await seedReputation('agent-a', 0.9, 0.95, 0.01);
		await seedReputation('agent-b', 0.1, 0.95, 0.01);

		const result = await scanAllAgents(db);

		expect(result.scanned).toBe(2);
		expect(result.results.length).toBe(2);

		const agentA = result.results.find((r) => r.agent_id === 'agent-a');
		const agentB = result.results.find((r) => r.agent_id === 'agent-b');
		expect(agentA?.decision).toBe('ALLOW');
		expect(agentB?.decision).toBe('DENY');
	});

	it('should return 0 scanned when no agents exist', async () => {
		const result = await scanAllAgents(db);
		expect(result.scanned).toBe(0);
		expect(result.results).toEqual([]);
	});
});

// ─── getLastScanResults Tests ───────────────────────────────────

describe('getLastScanResults', () => {
	it('should return scan results ordered by created_at DESC', async () => {
		await seedAgent('history-agent');
		await seedReputation('history-agent', 0.9, 0.95, 0.01);

		// Run two scans
		await scanAgent(db, 'history-agent');
		await scanAgent(db, 'history-agent');

		const results = await getLastScanResults(db, 'history-agent', 10);
		expect(results.length).toBe(2);
		// Most recent first
		expect(results[0].createdAt!).toBeGreaterThanOrEqual(results[1].createdAt!);
	});

	it('should respect limit parameter', async () => {
		await seedAgent('limit-agent');
		await seedReputation('limit-agent', 0.9, 0.95, 0.01);

		await scanAgent(db, 'limit-agent');
		await scanAgent(db, 'limit-agent');
		await scanAgent(db, 'limit-agent');

		const results = await getLastScanResults(db, 'limit-agent', 2);
		expect(results.length).toBe(2);
	});
});
