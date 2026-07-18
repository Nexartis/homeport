/**
 * Cross-Registry Trust Tests — aggregation logic + /api/trust/cross-registry endpoint
 *
 * Phase 3 — Agent Alpha
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { aggregateCrossRegistryScore } from '$lib/services/trust/cross-registry';

// Lane C now accepts developer API keys (nanda_ prefix) or admin sessions via
// requireApiKeyOrAdmin. The previous shared-secret NANDA_FEDERATION_ADMIN_KEY
// bearer flow is no longer honoured here.
const TEST_API_KEY_RAW = 'nanda_test_cross_registry_key_0123456789';
let testKeyHash: string;

async function sha256(data: string): Promise<string> {
	const encoded = new TextEncoder().encode(data);
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

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

	// Seed a developer API key for Lane C (M2M) auth tests
	testKeyHash = await sha256(TEST_API_KEY_RAW);
	await env.DB.prepare(
		`INSERT OR IGNORE INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, status, tier, rate_limit_monthly, usage_count_monthly, usage_reset_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			'test-key-cross-registry-1',
			testKeyHash,
			TEST_API_KEY_RAW.slice(0, 12),
			'Cross-Registry Test Key',
			'user-cross-registry-test',
			'cross-registry@test.com',
			'active',
			'free',
			1000,
			0,
			Math.floor(Date.now() / 1000) + 86400 * 30
		)
		.run();

	// Seed a local agent with reputation
	await env.DB.prepare(
		`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, source, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, 'test', 'test', 'test')`
	)
		.bind('trust-agent-alpha', 'https://alpha.example.com', 'local')
		.run();

	await env.DB.prepare(
		`INSERT OR IGNORE INTO reputation_snapshots (id, agent_id, availability, error_rate, fraud_rate, probe_success, cert_score, reputation)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind('snap-alpha-1', 'trust-agent-alpha', 0.95, 0.02, 0.01, 0.9, 0.8, 0.88)
		.run();

	// Seed federation trust scores from two peers
	await env.DB.prepare(
		`INSERT OR IGNORE INTO federation_trust_scores (id, agent_id, peer_url, reputation, availability, probe_success, cert_score, fraud_rate, badge_tier)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			'fts-1',
			'trust-agent-alpha',
			'https://peer1.example.com',
			0.85,
			0.9,
			0.88,
			0.75,
			0.02,
			'gold'
		)
		.run();

	await env.DB.prepare(
		`INSERT OR IGNORE INTO federation_trust_scores (id, agent_id, peer_url, reputation, availability, probe_success, cert_score, fraud_rate, badge_tier)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			'fts-2',
			'trust-agent-alpha',
			'https://peer2.example.com',
			0.8,
			0.85,
			0.82,
			0.7,
			0.03,
			'silver'
		)
		.run();
});

// ─── Pure aggregation logic ──────────────────────────────────────

describe('aggregateCrossRegistryScore', () => {
	it('returns local-only when no peers', () => {
		const result = aggregateCrossRegistryScore(0.88, []);
		expect(result.combined).toBe(0.88);
		expect(result.federated).toBe(0);
		expect(result.confidence).toBe(0);
		expect(result.peerCount).toBe(0);
	});

	it('blends local and federated with default 60/40 weight', () => {
		const result = aggregateCrossRegistryScore(0.88, [0.85, 0.8]);
		// federated = (0.85 + 0.80) / 2 = 0.825
		// combined = 0.6 * 0.88 + 0.4 * 0.825 = 0.528 + 0.33 = 0.858
		expect(result.combined).toBeCloseTo(0.858, 2);
		expect(result.federated).toBeCloseTo(0.825, 2);
		expect(result.peerCount).toBe(2);
		expect(result.confidence).toBeCloseTo(2 / 3, 2);
	});

	it('caps confidence at 1.0 with 3+ peers', () => {
		const result = aggregateCrossRegistryScore(0.88, [0.85, 0.8, 0.9, 0.82]);
		expect(result.confidence).toBe(1.0);
		expect(result.peerCount).toBe(4);
	});

	it('respects custom local weight', () => {
		const result = aggregateCrossRegistryScore(1.0, [0.5], 0.8);
		// combined = 0.8 * 1.0 + 0.2 * 0.5 = 0.9
		expect(result.combined).toBeCloseTo(0.9, 2);
	});
});

// ─── POST /api/trust/cross-registry ──────────────────────────────

describe('POST /api/trust/cross-registry', () => {
	it('returns 401 without auth header', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/cross-registry', {
			method: 'POST',
			headers: { 'CF-Connecting-IP': '10.0.5.1', Accept: 'application/json' }
		});
		expect(res.status).toBe(401);
		// Lane C: anonymous caller → SvelteKit error(401, 'forbidden').
		const body = (await res.json()) as Record<string, unknown>;
		const reason = String(body.message ?? body.error ?? '').toLowerCase();
		expect(reason).toMatch(/forbidden|unauthenticated|admin key/);
	});

	it('returns 401 with unrecognised bearer token', async () => {
		const res = await SELF.fetch('https://fake.host/api/trust/cross-registry', {
			method: 'POST',
			headers: { Authorization: 'Bearer wrong-key', 'CF-Connecting-IP': '10.0.5.2' }
		});
		expect(res.status).toBe(401);
	});

	it('accepts valid developer API key (may fail on peer fetch in test env)', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
			json: async () => ({ agents: [] })
		} as unknown as Response);
		try {
			const res = await SELF.fetch('https://fake.host/api/trust/cross-registry', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${TEST_API_KEY_RAW}`,
					'CF-Connecting-IP': '10.0.5.3'
				}
			});

			// Should not be 401 — actual sync may fail due to peer being unreachable
			expect(res.status).not.toBe(401);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
