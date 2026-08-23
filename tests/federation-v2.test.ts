/**
 * Federation v2 Tests — CRDT, Gossip, Quilt, Peers (Phase 6 — Agent Hawaii)
 *
 * Tests the core federation v2 services:
 *  - CRDTMergeEngine: LWW merge, vector clocks, tombstones, GC
 *  - QuiltService: prefix parsing, routing
 *  - PeerService: registration, health tracking, 3-strike rule
 *  - GossipService: inbound handling, stats
 *  - Routes: /federation/gossip, /federation/peers
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createDbClient } from '$lib/db/client';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { QuiltService } from '$lib/services/federation/quilt';
import { PeerService } from '$lib/services/federation/peers';
import { GossipService } from '$lib/services/federation/gossip';
import { importSigningKey } from '$lib/crypto/sign-agent';
import type { AgentAddrDelta, GossipMessage, VectorClock } from '$lib/types/federation-v2';

async function signNodeGossip(
	payload: Omit<GossipMessage, 'signature_hex'>
): Promise<GossipMessage> {
	const der = Uint8Array.from(atob(env.KYM_NANDA_ED25519_PRIVATE_KEY_v1 as string), (c) =>
		c.charCodeAt(0)
	);
	const key = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
	const data = new TextEncoder().encode(JSON.stringify(payload));
	const sig = await crypto.subtle.sign('Ed25519', key, data);
	const signature_hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return { ...payload, signature_hex };
}

/** Cached Ed25519 signing key for tests */
let _testSigningKey: CryptoKey;
async function getTestSigningKey(): Promise<CryptoKey> {
	if (_testSigningKey) return _testSigningKey;
	_testSigningKey = await importSigningKey(env);
	return _testSigningKey;
}

/**
 * Helper: insert a federation agent_addr row with required NOT NULL fields.
 * CRDT writes to agent_addrs (H3 isolation), so tests must seed agent_addrs.
 */
function seedAgentAddr(
	db: D1Database,
	agentId: string,
	agentUrl: string,
	opts: { source?: string; status?: string; updatedAt?: number } = {}
) {
	const { source, status = 'alive', updatedAt = Math.floor(Date.now() / 1000) } = opts;
	return db
		.prepare(
			`INSERT OR REPLACE INTO agent_addrs
			(agent_id, agent_url, public_key_hex, facts_url, signature_hex, signer_id, source, status, updated_at)
			VALUES (?, ?, 'federated:unsigned', '', 'federated:unsigned', ?, ?, ?, ?)`
		)
		.bind(agentId, agentUrl, source ?? 'local', source ?? 'local', status, updatedAt)
		.run();
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
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
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
});

// ─── CRDT Merge Engine ──────────────────────────────────────────

describe('CRDTMergeEngine', () => {
	it('accepts a new agent delta when no local record exists', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-new-agent-1',
			agent_addr: {
				agent_id: 'crdt-new-agent-1',
				agent_url: 'https://new.example.com',
				status: 'alive'
			},
			updated_at: Math.floor(Date.now() / 1000),
			source_node: 'peer-alpha'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(1);
		expect(result.rejected).toBe(0);
	});

	it('rejects a delta with older timestamp (LWW)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Insert a federated agent with current timestamp (source must be non-local for LWW to apply)
		await seedAgentAddr(env.DB, 'crdt-lww-agent', 'https://local.example.com', {
			source: 'federated:peer-alpha',
			updatedAt: now
		});

		// Try to merge with older timestamp
		const delta: AgentAddrDelta = {
			agent_id: 'crdt-lww-agent',
			agent_addr: {
				agent_id: 'crdt-lww-agent',
				agent_url: 'https://old.example.com',
				status: 'alive'
			},
			updated_at: now - 100,
			source_node: 'peer-beta'
		};

		const result = await crdt.merge([delta]);
		expect(result.rejected).toBe(1);
		expect(result.conflicts).toBe(1);
	});

	it('accepts a delta with newer timestamp (LWW)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Insert a federated agent (source must be non-local for LWW to apply)
		await seedAgentAddr(env.DB, 'crdt-lww-newer', 'https://local.example.com', {
			source: 'federated:peer-alpha',
			updatedAt: now - 200
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-lww-newer',
			agent_addr: {
				agent_id: 'crdt-lww-newer',
				agent_url: 'https://newer.example.com',
				status: 'alive'
			},
			updated_at: now,
			source_node: 'peer-gamma'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(1);
		expect(result.conflicts).toBe(1);
	});

	it('applies tombstone (null agent_addr)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'crdt-tombstone', 'https://alive.example.com', {
			source: 'federated:peer-delta',
			status: 'alive',
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-tombstone',
			agent_addr: null,
			updated_at: now,
			source_node: 'peer-delta'
		};

		const result = await crdt.merge([delta]);
		expect(result.tombstones).toBe(1);
		expect(result.accepted).toBe(1);
	});

	it('resolves timestamp tie deterministically (higher agent_id wins)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		// agent_id "zzz" > "aaa" → remote wins
		const result1 = crdt.resolveConflict(
			{ updatedAt: 1000, agentId: 'aaa' },
			{ agent_id: 'zzz', agent_addr: null, updated_at: 1000, source_node: 'x' }
		);
		expect(result1).toBe('remote');

		// agent_id "aaa" < "zzz" → local wins
		const result2 = crdt.resolveConflict(
			{ updatedAt: 1000, agentId: 'zzz' },
			{ agent_id: 'aaa', agent_addr: null, updated_at: 1000, source_node: 'x' }
		);
		expect(result2).toBe('local');
	});

	it('merges vector clocks correctly', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		const local: VectorClock = { 'node-a': 5, 'node-b': 3 };
		const remote: VectorClock = { 'node-a': 3, 'node-b': 7, 'node-c': 1 };

		const merged = crdt.mergeVectorClocks(local, remote);
		expect(merged['node-a']).toBe(5);
		expect(merged['node-b']).toBe(7);
		expect(merged['node-c']).toBe(1);
	});

	// ─── H1: Hybrid Lamport tick tests ──────────────────────────────

	it('tick() returns wall-clock when current < wall-clock', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const wallClock = Math.floor(Date.now() / 1000);

		// Current clock is well in the past
		const result = crdt.tick('node-a', { 'node-a': wallClock - 1000 });
		expect(result).toBeGreaterThanOrEqual(wallClock);
	});

	it('tick() returns current + 1 when current >= wall-clock (monotonicity)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		// Simulate a clock that's ahead of wall-clock (e.g., after rapid ticks)
		const futureTs = Math.floor(Date.now() / 1000) + 99999;
		const result = crdt.tick('node-a', { 'node-a': futureTs });
		expect(result).toBe(futureTs + 1);
	});

	it('tick() always advances (never returns same or lower value)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		const wallClock = Math.floor(Date.now() / 1000);
		const result1 = crdt.tick('node-a', { 'node-a': wallClock });
		expect(result1).toBeGreaterThan(wallClock);

		const result2 = crdt.tick('node-a', { 'node-a': result1 });
		expect(result2).toBeGreaterThan(result1);
	});

	it('tick() initializes from zero when no prior clock entry', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		const result = crdt.tick('new-node', {});
		const wallClock = Math.floor(Date.now() / 1000);
		expect(result).toBeGreaterThanOrEqual(wallClock);
	});

	it('advancePastRemote() returns value > both local and remote clocks', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());

		const localClock: VectorClock = { 'node-a': 100 };
		const remoteClock = 200;

		const result = crdt.advancePastRemote('node-a', localClock, remoteClock);
		expect(result).toBeGreaterThan(200);
		expect(result).toBeGreaterThan(100);
	});

	it('advancePastRemote() is wall-clock grounded', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const wallClock = Math.floor(Date.now() / 1000);

		// Both local and remote are in the past
		const result = crdt.advancePastRemote('node-a', { 'node-a': 10 }, 20);
		expect(result).toBeGreaterThanOrEqual(wallClock);
	});

	it('handles batch merge with mixed accept/reject', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		const deltas: AgentAddrDelta[] = [
			{
				agent_id: 'crdt-batch-1',
				agent_addr: { agent_id: 'crdt-batch-1', agent_url: 'https://b1.example.com' },
				updated_at: now,
				source_node: 'peer-x'
			},
			{
				agent_id: 'crdt-batch-2',
				agent_addr: { agent_id: 'crdt-batch-2', agent_url: 'https://b2.example.com' },
				updated_at: now,
				source_node: 'peer-x'
			}
		];

		const result = await crdt.merge(deltas);
		expect(result.accepted).toBe(2);
	});

	it('rejects merge delta for agent with source=null (local guard)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Insert a local agent (source defaults to 'local' in agent_addrs)
		await seedAgentAddr(env.DB, 'crdt-local-null', 'https://local.example.com', {
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-local-null',
			agent_addr: {
				agent_id: 'crdt-local-null',
				agent_url: 'https://evil.example.com',
				status: 'alive'
			},
			updated_at: now,
			source_node: 'peer-evil'
		};

		const result = await crdt.merge([delta]);
		expect(result.rejected).toBe(1);
		expect(result.accepted).toBe(0);
	});

	it('rejects merge delta for agent with source=local (local guard)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'crdt-local-explicit', 'https://local.example.com', {
			source: 'local',
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-local-explicit',
			agent_addr: {
				agent_id: 'crdt-local-explicit',
				agent_url: 'https://evil.example.com',
				status: 'alive'
			},
			updated_at: now,
			source_node: 'peer-evil'
		};

		const result = await crdt.merge([delta]);
		expect(result.rejected).toBe(1);
		expect(result.accepted).toBe(0);
	});

	it('accepts merge delta for agent with federated source (local guard allows)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'crdt-fed-ok', 'https://old.example.com', {
			source: 'federated:peer-x',
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-fed-ok',
			agent_addr: {
				agent_id: 'crdt-fed-ok',
				agent_url: 'https://new.example.com',
				status: 'alive'
			},
			updated_at: now,
			source_node: 'peer-x'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(1);
		expect(result.conflicts).toBe(1);
	});

	it('rejects tombstone for local agent (tombstone guard)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Insert a local agent in agent_addrs
		await seedAgentAddr(env.DB, 'crdt-tomb-local', 'https://local.example.com', {
			status: 'alive',
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-tomb-local',
			agent_addr: null,
			updated_at: now,
			source_node: 'peer-evil'
		};

		const result = await crdt.merge([delta]);
		// Tombstone should be rejected — agent should stay alive
		expect(result.tombstones).toBe(0);

		const agent = await env.DB.prepare(`SELECT status FROM agent_addrs WHERE agent_id = ?`)
			.bind('crdt-tomb-local')
			.first<{ status: string }>();
		expect(agent!.status).toBe('alive');
	});

	it('accepts tombstone for federated agent (tombstone guard allows)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'crdt-tomb-fed', 'https://fed.example.com', {
			source: 'federated:peer-alpha',
			status: 'alive',
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'crdt-tomb-fed',
			agent_addr: null,
			updated_at: now,
			source_node: 'peer-alpha'
		};

		const result = await crdt.merge([delta]);
		expect(result.tombstones).toBe(1);
		expect(result.accepted).toBe(1);

		const agent = await env.DB.prepare(`SELECT status FROM agent_addrs WHERE agent_id = ?`)
			.bind('crdt-tomb-fed')
			.first<{ status: string }>();
		expect(agent!.status).toBe('dead');
	});

	it('gcTombstones deletes dead agent_addrs older than 7 days', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);
		const eightDaysAgo = now - 8 * 24 * 3600;

		await seedAgentAddr(env.DB, 'crdt-gc-old', 'https://gc.example.com', {
			source: 'federated:peer-x',
			status: 'dead',
			updatedAt: eightDaysAgo
		});

		const deleted = await crdt.gcTombstones();
		expect(deleted).toBeGreaterThanOrEqual(1);

		const agent = await env.DB.prepare(`SELECT * FROM agent_addrs WHERE agent_id = ?`)
			.bind('crdt-gc-old')
			.first();
		expect(agent).toBeNull();
	});

	it('gcTombstones keeps dead agent_addrs within 7 days', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);
		const twoDaysAgo = now - 2 * 24 * 3600;

		await seedAgentAddr(env.DB, 'crdt-gc-recent', 'https://gc-recent.example.com', {
			source: 'federated:peer-x',
			status: 'dead',
			updatedAt: twoDaysAgo
		});

		await crdt.gcTombstones();

		const agent = await env.DB.prepare(`SELECT * FROM agent_addrs WHERE agent_id = ?`)
			.bind('crdt-gc-recent')
			.first();
		expect(agent).not.toBeNull();
	});
});

// ─── CRDT getDeltasSince ──────────────────────────────────────

describe('CRDTMergeEngine.getDeltasSince', () => {
	it('returns agents updated after max clock value', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'delta-new', 'https://delta.example.com', {
			source: 'federated:peer-y',
			updatedAt: now
		});

		const deltas = await crdt.getDeltasSince({ 'peer-y': now - 50 });
		const found = deltas.find((d) => d.agent_id === 'delta-new');
		expect(found).toBeDefined();
	});

	it('returns empty when no agents newer than clock', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const futureTs = Math.floor(Date.now() / 1000) + 99999;

		const deltas = await crdt.getDeltasSince({ 'any-node': futureTs });
		expect(deltas.length).toBe(0);
	});

	it('derives source_node correctly from source column', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Insert agent_addrs with different source values
		await seedAgentAddr(env.DB, 'src-local', 'https://a.example.com', {
			source: 'local',
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'src-fed', 'https://b.example.com', {
			source: 'federated:kym-dev',
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'src-null', 'https://c.example.com', { updatedAt: now });

		const deltas = await crdt.getDeltasSince({ x: 0 });
		const localDelta = deltas.find((d) => d.agent_id === 'src-local');
		const fedDelta = deltas.find((d) => d.agent_id === 'src-fed');
		const nullDelta = deltas.find((d) => d.agent_id === 'src-null');

		expect(localDelta?.source_node).toBe('local');
		expect(fedDelta?.source_node).toBe('kym-dev');
		expect(nullDelta?.source_node).toBe('local');
	});

	it('tracks acceptedIndices correctly with mixed accept/reject', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Seed a local agent_addr (will be rejected) and a federated one (will be accepted)
		await seedAgentAddr(env.DB, 'idx-local', 'https://local.example.com', { updatedAt: now });
		await seedAgentAddr(env.DB, 'idx-fed', 'https://fed.example.com', {
			source: 'federated:peer-z',
			updatedAt: now - 200
		});

		const deltas: AgentAddrDelta[] = [
			// delta[0]: targets local agent → rejected by guard
			{
				agent_id: 'idx-local',
				agent_addr: { agent_id: 'idx-local', agent_url: 'https://evil.example.com' },
				updated_at: now + 10,
				source_node: 'peer-evil'
			},
			// delta[1]: targets federated agent → accepted (newer timestamp)
			{
				agent_id: 'idx-fed',
				agent_addr: { agent_id: 'idx-fed', agent_url: 'https://updated.example.com' },
				updated_at: now,
				source_node: 'peer-z'
			}
		];

		const result = await crdt.merge(deltas);
		expect(result.accepted).toBe(1);
		expect(result.rejected).toBe(1);
		// Only index 1 should be accepted
		expect(result.acceptedIndices).toEqual([1]);
	});

	it('acceptedIndices is empty when all deltas rejected', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		// Seed a local agent
		// Must seed in agent_addrs since CRDT queries agent_addrs (H3)
		await seedAgentAddr(env.DB, 'idx-all-reject', 'https://local.example.com', {
			updatedAt: now
		});

		const deltas: AgentAddrDelta[] = [
			{
				agent_id: 'idx-all-reject',
				agent_addr: { agent_id: 'idx-all-reject', agent_url: 'https://evil.example.com' },
				updated_at: now + 10,
				source_node: 'peer-evil'
			}
		];

		const result = await crdt.merge(deltas);
		expect(result.accepted).toBe(0);
		expect(result.acceptedIndices).toEqual([]);
	});
});

// ─── Quilt Address Parser ───────────────────────────────────────

describe('QuiltService', () => {
	it('parses native agent IDs (no prefix)', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		const result = quilt.parseAgentId('my-agent');
		expect(result.quiltType).toBe('native');
		expect(result.prefix).toBeNull();
	});

	it('parses @US: prefix as gov quilt', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		const result = quilt.parseAgentId('@US:federal-agent');
		expect(result.quiltType).toBe('gov');
		expect(result.prefix).toBe('@US:');
	});

	it('parses @DID: prefix as web3 quilt', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		const result = quilt.parseAgentId('@DID:did:web:example.com');
		expect(result.quiltType).toBe('web3');
		expect(result.prefix).toBe('@DID:');
	});

	it('parses @agntcy: prefix as enterprise quilt', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		const result = quilt.parseAgentId('@agntcy:cisco-agent');
		expect(result.quiltType).toBe('enterprise');
		expect(result.prefix).toBe('@agntcy:');
	});

	it('detects AGNTCY agents', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		expect(quilt.isAgntcyAgent('@agntcy:test')).toBe(true);
		expect(quilt.isAgntcyAgent('regular-agent')).toBe(false);
	});

	it('strips prefix correctly', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		expect(quilt.stripPrefix('@US:federal-agent')).toBe('federal-agent');
		expect(quilt.stripPrefix('no-prefix')).toBe('no-prefix');
	});

	it('defaults unknown prefix to enterprise', () => {
		const db = createDbClient(env.DB);
		const quilt = new QuiltService(db);
		const result = quilt.parseAgentId('@custom:my-agent');
		expect(result.quiltType).toBe('enterprise');
		expect(result.prefix).toBe('@custom:');
	});
});

// ─── Peer Management ────────────────────────────────────────────

describe('PeerService', () => {
	it('registers and retrieves a peer', async () => {
		const db = createDbClient(env.DB);
		const peers = new PeerService(db);

		const peer = await peers.registerPeer({
			peer_id: 'test-peer-1',
			peer_url: 'https://peer1.example.com',
			node_id: 'node-1'
		});

		expect(peer.peer_id).toBe('test-peer-1');
		expect(peer.status).toBe('active');

		const retrieved = await peers.getPeer('test-peer-1');
		expect(retrieved).not.toBeNull();
		expect(retrieved!.peer_url).toBe('https://peer1.example.com');
	});

	it('tracks failure count and degrades peer', async () => {
		const db = createDbClient(env.DB);
		const peers = new PeerService(db);

		await peers.registerPeer({
			peer_id: 'test-peer-fail',
			peer_url: 'https://fail.example.com',
			node_id: 'node-fail'
		});

		// First failure → degraded
		await peers.updatePeerStatus('test-peer-fail', false);
		let peer = await peers.getPeer('test-peer-fail');
		expect(peer!.status).toBe('degraded');

		// Second failure → still degraded
		await peers.updatePeerStatus('test-peer-fail', false);
		peer = await peers.getPeer('test-peer-fail');
		expect(peer!.status).toBe('degraded');

		// Third failure → offline
		await peers.updatePeerStatus('test-peer-fail', false);
		peer = await peers.getPeer('test-peer-fail');
		expect(peer!.status).toBe('offline');
	});

	it('resets failure count on success', async () => {
		const db = createDbClient(env.DB);
		const peers = new PeerService(db);

		await peers.registerPeer({
			peer_id: 'test-peer-recover',
			peer_url: 'https://recover.example.com',
			node_id: 'node-recover'
		});

		await peers.updatePeerStatus('test-peer-recover', false);
		await peers.updatePeerStatus('test-peer-recover', true);

		const peer = await peers.getPeer('test-peer-recover');
		expect(peer!.status).toBe('active');
		expect(peer!.failure_count).toBe(0);
	});

	it('returns peer summary', async () => {
		const db = createDbClient(env.DB);
		const peers = new PeerService(db);
		const summary = await peers.getPeerSummary();
		expect(summary).toHaveProperty('total');
		expect(summary).toHaveProperty('active');
		expect(summary).toHaveProperty('degraded');
		expect(summary).toHaveProperty('offline');
	});

	it('removes a peer', async () => {
		const db = createDbClient(env.DB);
		const peers = new PeerService(db);

		await peers.registerPeer({
			peer_id: 'test-peer-remove',
			peer_url: 'https://remove.example.com',
			node_id: 'node-remove'
		});

		const removed = await peers.removePeer('test-peer-remove');
		expect(removed).toBe(true);

		const peer = await peers.getPeer('test-peer-remove');
		expect(peer).toBeNull();
	});
});

// ─── Gossip Route Integration ───────────────────────────────────

describe('POST /federation/gossip', () => {
	it('returns 401 for unknown peer without enrolled signature', async () => {
		const res = await SELF.fetch('https://fake.host/federation/gossip', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.5.1' },
			body: JSON.stringify({
				node_id: 'unknown-gossip-peer',
				timestamp: Math.floor(Date.now() / 1000),
				agent_addr_deltas: [],
				vector_clock: {},
				signature_hex: ''
			})
		});
		expect(res.status).toBe(401);
	});

	it('returns 400 for invalid gossip message', async () => {
		const res = await SELF.fetch('https://fake.host/federation/gossip', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.5.2'
			},
			body: JSON.stringify({ bad: 'data' })
		});
		expect(res.status).toBe(400);
	});

	it('rejects empty-signature gossip', async () => {
		const res = await SELF.fetch('https://fake.host/federation/gossip', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CF-Connecting-IP': '10.0.5.3'
			},
			body: JSON.stringify({
				node_id: 'test-peer-gossip',
				timestamp: Math.floor(Date.now() / 1000),
				agent_addr_deltas: [
					{
						agent_id: 'gossip-agent-1',
						agent_addr: {
							agent_id: 'gossip-agent-1',
							agent_url: 'https://gossip.example.com'
						},
						updated_at: Math.floor(Date.now() / 1000),
						source_node: 'test-peer-gossip'
					}
				],
				vector_clock: { 'test-peer-gossip': 1 },
				signature_hex: ''
			})
		});
		expect(res.status).toBe(401);
	});
});

// ─── Peers Route Integration ────────────────────────────────────

describe('GET /federation/peers', () => {
	it('returns peer list and summary', async () => {
		const res = await SELF.fetch('https://fake.host/federation/peers', {
			headers: {
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`,
				'CF-Connecting-IP': '10.0.6.1'
			}
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toHaveProperty('peers');
		expect(body).toHaveProperty('summary');
	});
});

// ─── Gossip Service Unit Tests ─────────────────────────────────

describe('GossipService', () => {
	it('rate-limits inbound gossip from same peer within 30s', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const peers = new PeerService(db);
		const gossip = new GossipService(db, crdt, peers, 'kym-test', env.NANDA_FEDERATION_ADMIN_KEY);
		const now = Math.floor(Date.now() / 1000);

		// Register a peer with a recent last_gossip_at
		await env.DB.prepare(
			`INSERT OR REPLACE INTO federation_peers (peer_id, peer_url, node_id, status, last_gossip_at, public_key_spki) VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind(
				'rate-limit-peer',
				'https://rl.example.com',
				'rate-limit-peer',
				'active',
				now - 10,
				env.NANDA_ED25519_PUBLIC_KEY_v1
			)
			.run();

		const message = await signNodeGossip({
			node_id: 'rate-limit-peer',
			timestamp: now,
			agent_addr_deltas: [
				{
					agent_id: 'rl-agent-1',
					agent_addr: { agent_id: 'rl-agent-1', agent_url: 'https://rl.example.com' },
					updated_at: now,
					source_node: 'rate-limit-peer'
				}
			],
			vector_clock: { 'rate-limit-peer': now }
		});

		const result = await gossip.handleInbound(message, 'rate-limit-peer');
		// Should be rate-limited — all deltas rejected
		expect(result.accepted).toBe(0);
		expect(result.rejected).toBe(1);
	});

	it('allows inbound gossip after 30s has elapsed', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const peers = new PeerService(db);
		const gossip = new GossipService(db, crdt, peers, 'kym-test', env.NANDA_FEDERATION_ADMIN_KEY);
		const now = Math.floor(Date.now() / 1000);

		// Register a peer with gossip 60s ago (well past the 30s limit)
		await env.DB.prepare(
			`INSERT OR REPLACE INTO federation_peers (peer_id, peer_url, node_id, status, last_gossip_at, public_key_spki) VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind(
				'rl-allowed-peer',
				'https://rl2.example.com',
				'rl-allowed-peer',
				'active',
				now - 60,
				env.NANDA_ED25519_PUBLIC_KEY_v1
			)
			.run();

		const message = await signNodeGossip({
			node_id: 'rl-allowed-peer',
			timestamp: now,
			agent_addr_deltas: [
				{
					agent_id: 'rl-allowed-agent',
					agent_addr: { agent_id: 'rl-allowed-agent', agent_url: 'https://rl2.example.com' },
					updated_at: now,
					source_node: 'rl-allowed-peer'
				}
			],
			vector_clock: { 'rl-allowed-peer': now }
		});

		const result = await gossip.handleInbound(message, 'rl-allowed-peer');
		expect(result.accepted).toBe(1);
	});

	it('allows first gossip from new peer (last_gossip_at = 0)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const peers = new PeerService(db);
		const gossip = new GossipService(db, crdt, peers, 'kym-test', env.NANDA_FEDERATION_ADMIN_KEY);
		const now = Math.floor(Date.now() / 1000);

		// Register a peer with last_gossip_at = 0 (never gossipped)
		await env.DB.prepare(
			`INSERT OR REPLACE INTO federation_peers (peer_id, peer_url, node_id, status, last_gossip_at, public_key_spki) VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind(
				'rl-first-peer',
				'https://rl3.example.com',
				'rl-first-peer',
				'active',
				0,
				env.NANDA_ED25519_PUBLIC_KEY_v1
			)
			.run();

		const message = await signNodeGossip({
			node_id: 'rl-first-peer',
			timestamp: now,
			agent_addr_deltas: [
				{
					agent_id: 'rl-first-agent',
					agent_addr: { agent_id: 'rl-first-agent', agent_url: 'https://rl3.example.com' },
					updated_at: now,
					source_node: 'rl-first-peer'
				}
			],
			vector_clock: { 'rl-first-peer': now }
		});

		const result = await gossip.handleInbound(message, 'rl-first-peer');
		expect(result.accepted).toBe(1);
	});

	it('buildMessage includes nodeId in vector_clock', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const peers = new PeerService(db);
		const gossip = new GossipService(
			db,
			crdt,
			peers,
			'kym-test',
			env.NANDA_FEDERATION_ADMIN_KEY,
			env.KYM_NANDA_ED25519_PRIVATE_KEY_v1 as string
		);

		const message = await gossip.buildMessage({});
		expect(message.node_id).toBe('kym-test');
		expect(message.vector_clock).toHaveProperty('kym-test');
	});

	it('buildMessage uses hybrid Lamport tick (monotonic clock)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const peers = new PeerService(db);
		const gossip = new GossipService(
			db,
			crdt,
			peers,
			'kym-test',
			env.NANDA_FEDERATION_ADMIN_KEY,
			env.KYM_NANDA_ED25519_PRIVATE_KEY_v1 as string
		);

		const wallClock = Math.floor(Date.now() / 1000);
		const message = await gossip.buildMessage({});

		// The tick should be at least wall-clock grounded
		expect(message.vector_clock['kym-test']).toBeGreaterThanOrEqual(wallClock);
	});
});
