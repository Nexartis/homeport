/**
 * Federation Route Tests — /federation/sync, sync-peer, status, agents
 * Validates admin auth gating, peer URL validation, and response shapes.
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
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY, assigned_agent_id TEXT REFERENCES agent_addrs(agent_id),
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS cert_jobs (
    job_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    status TEXT DEFAULT 'pending', num_trials INTEGER DEFAULT 5,
    completed_trials INTEGER DEFAULT 0, pass_threshold REAL DEFAULT 0.8,
    score REAL, grade TEXT,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
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
	`CREATE TABLE IF NOT EXISTS federation_peers (
    peer_id TEXT PRIMARY KEY, peer_url TEXT NOT NULL, node_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', last_sync_at INTEGER,
    last_gossip_at INTEGER, vector_clock TEXT DEFAULT '{}',
    failure_count INTEGER DEFAULT 0, capabilities TEXT DEFAULT '[]',
    quilt_types TEXT DEFAULT '["native"]',
    public_key_spki TEXT, key_updated_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS gossip_log (
    id TEXT PRIMARY KEY, peer_id TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'inbound', message_json TEXT NOT NULL,
    deltas_count INTEGER DEFAULT 0, accepted INTEGER DEFAULT 0,
    rejected INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS quilt_routes (
    id TEXT PRIMARY KEY, prefix TEXT NOT NULL, quilt_type TEXT NOT NULL,
    peer_id TEXT NOT NULL, priority INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_prefix_peer ON quilt_routes(prefix, peer_id)`,
	`CREATE TABLE IF NOT EXISTS cross_registry_scores (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL UNIQUE,
    local_reputation REAL, federated_reputation REAL,
    combined_reputation REAL, peer_count INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0, badge_tier TEXT DEFAULT 'none',
    computed_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY NOT NULL, public_key_hex TEXT NOT NULL,
    facts_url TEXT NOT NULL, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300,
    signature_hex TEXT NOT NULL, signer_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER, source TEXT NOT NULL DEFAULT 'local',
    quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
    agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT,
    status TEXT DEFAULT 'alive')`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
	for (const sql of [
		'ALTER TABLE federation_peers ADD COLUMN public_key_spki TEXT',
		'ALTER TABLE federation_peers ADD COLUMN key_updated_at INTEGER'
	]) {
		await env.DB.prepare(sql)
			.run()
			.catch(() => undefined);
	}

	// Seed one federated agent in agent_addrs (H3 — CRDT writes to agent_addrs)
	await env.DB.prepare(
		`INSERT OR IGNORE INTO agent_addrs
		(agent_id, agent_url, public_key_hex, facts_url, signature_hex, signer_id, source, status)
		VALUES (?, ?, 'federated:unsigned', '', 'federated:unsigned', ?, ?, 'alive')`
	)
		.bind(
			'federation-peer-alpha',
			'https://fed.example.com',
			'federated:https://peer.example.com',
			'federated:https://peer.example.com'
		)
		.run();
});

// ─── /federation/sync ─────────────────────────────────────────

// v1 federation sync endpoints (/federation/sync, /federation/sync-peer) have been removed.
// Federation is now handled exclusively via CRDT gossip (federation/gossip/).

// ─── /federation/status ───────────────────────────────────────

describe('GET /federation/status', () => {
	it('returns status with configured_peer and peers', async () => {
		const res = await SELF.fetch('https://fake.host/federation/status', {
			headers: {
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.3.1'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toHaveProperty('configured_peer');
		expect(body).toHaveProperty('peers');
		expect(body.configured_peer).toBe(env.NANDA_FEDERATION_PEER_URL);
	});
});

// ─── /federation/agents ───────────────────────────────────────

describe('GET /federation/agents', () => {
	it('returns count and agents array', async () => {
		const res = await SELF.fetch('https://fake.host/federation/agents', {
			headers: {
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.4.1'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { count: number; agents: unknown[] };
		expect(typeof body.count).toBe('number');
		expect(Array.isArray(body.agents)).toBe(true);
	});

	it('includes agents with federated source', async () => {
		const res = await SELF.fetch('https://fake.host/federation/agents', {
			headers: {
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.4.2'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { agents: Array<Record<string, unknown>> };
		// Our seeded agent has source='federated:https://peer.example.com', which qualifies
		const found = body.agents.find(
			(a) =>
				(a.agent_id as string) === 'federation-peer-alpha' ||
				(a.agentId as string) === 'federation-peer-alpha'
		);
		expect(found).toBeDefined();
	});
});

// ─── /federation/peers POST (peer registration) ─────────────

describe('POST /federation/peers', () => {
	it('registers a new peer with valid admin key', async () => {
		const res = await SELF.fetch('https://fake.host/federation/peers', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.5.1'
			},
			body: JSON.stringify({
				peer_id: 'route-test-peer',
				peer_url: 'https://route-test.example.com',
				node_id: 'route-test-node',
				capabilities: ['registry', 'gossip']
			})
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; peer: Record<string, unknown> };
		expect(body.ok).toBe(true);
		expect(body.peer.peer_id).toBe('route-test-peer');
	});

	it('rejects without admin key (401)', async () => {
		const res = await SELF.fetch('https://fake.host/federation/peers', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CF-Connecting-IP': '10.0.5.2'
			},
			body: JSON.stringify({
				peer_id: 'unauthorized-peer',
				peer_url: 'https://bad.example.com',
				node_id: 'bad-node'
			})
		});
		expect(res.status).toBe(401);
	});

	it('upserts existing peer on re-registration', async () => {
		await SELF.fetch('https://fake.host/federation/peers', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.5.3'
			},
			body: JSON.stringify({
				peer_id: 'upsert-peer',
				peer_url: 'https://upsert-v1.example.com',
				node_id: 'upsert-node'
			})
		});

		const res = await SELF.fetch('https://fake.host/federation/peers', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.5.4'
			},
			body: JSON.stringify({
				peer_id: 'upsert-peer',
				peer_url: 'https://upsert-v2.example.com',
				node_id: 'upsert-node'
			})
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});
});

// ─── Auth gating on GET endpoints ────────────────────────────

describe('Auth gating on federation GET endpoints', () => {
	it('GET /federation/peers requires admin key (401 without)', async () => {
		const res = await SELF.fetch('https://fake.host/federation/peers', {
			headers: { 'CF-Connecting-IP': '10.0.7.1' }
		});
		expect(res.status).toBe(401);
	});

	it('GET /federation/agents requires admin key (401 without)', async () => {
		const res = await SELF.fetch('https://fake.host/federation/agents', {
			headers: { 'CF-Connecting-IP': '10.0.7.2' }
		});
		expect(res.status).toBe(401);
	});

	it('GET /federation/status requires admin key (401 without)', async () => {
		const res = await SELF.fetch('https://fake.host/federation/status', {
			headers: { 'CF-Connecting-IP': '10.0.7.3' }
		});
		expect(res.status).toBe(401);
	});
});

// ─── Cron Endpoints ──────────────────────────────────────────

describe('POST /api/cron/gossip-push', () => {
	it('requires cron auth', async () => {
		const res = await SELF.fetch('https://fake.host/api/cron/gossip-push', {
			method: 'POST',
			headers: { 'CF-Connecting-IP': '10.0.8.1' }
		});
		expect(res.status).toBe(401);
	});

	it('returns result with valid cron auth', async () => {
		const res = await SELF.fetch('https://fake.host/api/cron/gossip-push', {
			method: 'POST',
			headers: {
				'X-Cron-Auth': env.CRON_AUTH_TOKEN ?? '',
				'CF-Connecting-IP': '10.0.8.2'
			}
		});
		// Should succeed — not 401
		expect(res.status).not.toBe(401);
	});
});

// ─── Admin Federation API ────────────────────────────────────

describe('POST /api/admin/federation', () => {
	it('requires authentication (returns 401 or 503 without auth)', async () => {
		const res = await SELF.fetch('https://fake.host/api/admin/federation', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CF-Connecting-IP': '10.0.10.1'
			},
			body: JSON.stringify({ action: 'list-peers' })
		});
		// Should be 401 (no auth) or 503 (keys not initialized in test env)
		expect([401, 403, 503]).toContain(res.status);
	});
});
