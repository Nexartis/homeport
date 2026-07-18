/**
 * Trust Score Public API Tests — GET /api/trust/scores
 * Validates API key auth gating, response shape, filtering, and pagination.
 *
 * Phase 3 — Agent Alpha
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

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

// Test API key — we insert it directly via DB to bypass key generation flow
const TEST_API_KEY_RAW = 'nanda_test_trust_api_key_abcdef1234';
let testKeyHash: string;

async function sha256(data: string): Promise<string> {
	const encoded = new TextEncoder().encode(data);
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
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
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
		availability REAL, error_rate REAL, fraud_rate REAL,
		p95_latency_ms INTEGER, probe_success REAL, cert_score REAL,
		reputation REAL, actions TEXT,
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS federation_trust_scores (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, peer_url TEXT NOT NULL,
		reputation REAL, availability REAL, probe_success REAL,
		cert_score REAL, fraud_rate REAL, badge_tier TEXT DEFAULT 'none',
		fetched_at INTEGER DEFAULT (unixepoch()),
		UNIQUE(agent_id, peer_url))`,
	`CREATE INDEX IF NOT EXISTS idx_fts_agent ON federation_trust_scores(agent_id)`,
	`CREATE TABLE IF NOT EXISTS cross_registry_scores (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL UNIQUE,
		local_reputation REAL, federated_reputation REAL,
		combined_reputation REAL, peer_count INTEGER DEFAULT 0,
		confidence REAL DEFAULT 0, badge_tier TEXT DEFAULT 'none',
		computed_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_crs_agent ON cross_registry_scores(agent_id)`,
	`CREATE TABLE IF NOT EXISTS developer_keys (
		id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL,
		name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT,
		status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'free',
		rate_limit_monthly INTEGER NOT NULL DEFAULT 1000, scopes TEXT,
		last_used_at INTEGER, usage_count_monthly INTEGER NOT NULL DEFAULT 0,
		usage_reset_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
		revoked_at INTEGER, expires_at INTEGER)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_keys_key_hash ON developer_keys(key_hash)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_owner ON developer_keys(owner_id)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_status ON developer_keys(status)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_prefix ON developer_keys(key_prefix)`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));

	// Compute hash and insert test API key
	testKeyHash = await sha256(TEST_API_KEY_RAW);
	await env.DB.prepare(
		`INSERT OR IGNORE INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, status, tier, rate_limit_monthly, usage_count_monthly, usage_reset_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			'test-key-trust-1',
			testKeyHash,
			TEST_API_KEY_RAW.slice(0, 12),
			'Trust Test Key',
			'user-trust-test',
			'trust@test.com',
			'active',
			'free',
			1000,
			0,
			Math.floor(Date.now() / 1000) + 86400 * 30
		)
		.run();

	// Seed agents with reputation
	await env.DB.prepare(
		`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, source, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, 'test', 'test', 'test')`
	)
		.bind('trust-api-alpha', 'https://agent1.example.com', 'local')
		.run();

	await env.DB.prepare(
		`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, source, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, 'test', 'test', 'test')`
	)
		.bind('trust-api-beta', 'https://agent2.example.com', 'local')
		.run();

	await env.DB.prepare(
		`INSERT OR IGNORE INTO reputation_snapshots (id, agent_id, availability, error_rate, fraud_rate, probe_success, cert_score, reputation)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind('snap-s1', 'trust-api-alpha', 0.95, 0.02, 0.01, 0.9, 0.8, 0.88)
		.run();

	await env.DB.prepare(
		`INSERT OR IGNORE INTO reputation_snapshots (id, agent_id, availability, error_rate, fraud_rate, probe_success, cert_score, reputation)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind('snap-s2', 'trust-api-beta', 0.7, 0.1, 0.05, 0.65, 0.5, 0.6)
		.run();

	// Seed cross-registry score for trust-api-alpha
	await env.DB.prepare(
		`INSERT OR IGNORE INTO cross_registry_scores (id, agent_id, local_reputation, federated_reputation, combined_reputation, peer_count, confidence, badge_tier)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind('crs-tsa-1', 'trust-api-alpha', 0.88, 0.825, 0.858, 2, 0.67, 'gold')
		.run();
});

// ─── GET /api/trust/scores ───────────────────────────────────────

describe('GET /api/trust/scores', () => {
	it('returns 401 without API key', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/scores', {
			headers: { 'CF-Connecting-IP': '10.0.6.1', Accept: 'application/json' }
		});
		expect(res.status).toBe(401);
		// Lane C: anonymous caller → SvelteKit error(401, 'unauthenticated').
		// Body is JSON when Accept: application/json is set.
		const body = (await res.json()) as Record<string, unknown>;
		const reason = String(body.message ?? body.error ?? '').toLowerCase();
		expect(reason).toMatch(/unauthenticated|api key/);
	});

	it('returns 401 with invalid API key', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/scores', {
			headers: {
				Authorization: 'Bearer nanda_invalid_key',
				'CF-Connecting-IP': '10.0.6.2'
			}
		});
		expect(res.status).toBe(401);
	});

	it('returns paginated list with valid API key', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/scores', {
			headers: {
				Authorization: `Bearer ${TEST_API_KEY_RAW}`,
				'CF-Connecting-IP': '10.0.6.3'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			agents: Array<Record<string, unknown>>;
			total: number;
			badge_distribution: Record<string, number>;
			fetchedAt: string;
		};
		expect(body.total).toBeGreaterThanOrEqual(2);
		expect(Array.isArray(body.agents)).toBe(true);
		expect(body.badge_distribution).toBeDefined();
		expect(body.fetchedAt).toBeDefined();
	});

	it('returns single agent with ?agent= filter', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/scores?agent=trust-api-alpha', {
			headers: {
				Authorization: `Bearer ${TEST_API_KEY_RAW}`,
				'CF-Connecting-IP': '10.0.6.4'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			agent: {
				agent_id: string;
				local_reputation: number;
				combined_reputation: number;
				peer_count: number;
				badge: { tier: string };
			};
			fetchedAt: string;
		};
		expect(body.agent.agent_id).toBe('trust-api-alpha');
		expect(body.agent.local_reputation).toBeCloseTo(0.88, 1);
		expect(body.agent.combined_reputation).toBeCloseTo(0.858, 1);
		expect(body.agent.peer_count).toBe(2); // Matches seeded cross_registry_scores.peer_count
		expect(body.agent.badge).toBeDefined();
		expect(body.fetchedAt).toBeDefined();
	});

	it('returns 404 for unknown agent', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/scores?agent=nonexistent', {
			headers: {
				Authorization: `Bearer ${TEST_API_KEY_RAW}`,
				'CF-Connecting-IP': '10.0.6.5'
			}
		});
		expect(res.status).toBe(404);
	});

	it('respects pagination params', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/scores?offset=0&limit=1', {
			headers: {
				Authorization: `Bearer ${TEST_API_KEY_RAW}`,
				'CF-Connecting-IP': '10.0.6.6'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { agents: unknown[]; total: number };
		expect(body.agents.length).toBe(1);
		expect(body.total).toBeGreaterThanOrEqual(2);
	});
});
