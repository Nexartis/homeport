/**
 * Trust Framework & Trust Graph Tests
 *
 * Tests for framework CRUD, trust graph edge operations, and BFS path finding.
 * Uses cloudflare:test with real D1 for integration testing.
 *
 * Phase 3 — Agent Gamma
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '$lib/db/client';
import {
	registerFramework,
	getFrameworks,
	alignWithToIP,
	seedDefaultFramework,
	KYM_FRAMEWORK
} from '$lib/services/trust-framework/toip-alignment';
import {
	addTrustEdge,
	getTrustGraph,
	computeTrustPath,
	getTrustLevel
} from '$lib/services/trust-framework/trust-graph';

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
	`CREATE TABLE IF NOT EXISTS trust_framework_meta (
		id TEXT PRIMARY KEY, framework_id TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL, version TEXT NOT NULL,
		governance_url TEXT, alignment TEXT,
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS trust_graph_edges (
		id TEXT PRIMARY KEY, from_did TEXT NOT NULL, to_did TEXT NOT NULL,
		relationship TEXT NOT NULL, trust_level REAL DEFAULT 0,
		evidence_uri TEXT, framework_id TEXT,
		valid_from INTEGER, valid_until INTEGER,
		created_at INTEGER DEFAULT (unixepoch()),
		UNIQUE(from_did, to_did, relationship))`,
	`CREATE INDEX IF NOT EXISTS idx_tge_from ON trust_graph_edges(from_did)`,
	`CREATE INDEX IF NOT EXISTS idx_tge_to ON trust_graph_edges(to_did)`
];

let db: ReturnType<typeof createDbClient>;

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
	db = createDbClient(env.DB);
});

// ─── Trust Framework CRUD ────────────────────────────────────────

describe('Trust Framework Registration', () => {
	it('seeds the default KYM framework', async () => {
		const fw = await seedDefaultFramework(db);
		expect(fw.frameworkId).toBe('kym-trust-v1');
		expect(fw.name).toBe('KnowYourModel Trust Framework');
		expect(fw.alignment).toBe('toip-tswg');
	});

	it('returns existing framework on re-seed', async () => {
		const fw1 = await seedDefaultFramework(db);
		const fw2 = await seedDefaultFramework(db);
		expect(fw1.id).toBe(fw2.id);
	});

	it('registers a custom framework', async () => {
		const fw = await registerFramework(db, {
			frameworkId: 'custom-v1',
			name: 'Custom Framework',
			version: '0.1',
			alignment: 'dif-trust-graph'
		});
		expect(fw.frameworkId).toBe('custom-v1');
		expect(fw.version).toBe('0.1');
	});

	it('lists all registered frameworks', async () => {
		const all = await getFrameworks(db);
		expect(all.length).toBeGreaterThanOrEqual(2);
		const ids = all.map((f) => f.frameworkId);
		expect(ids).toContain('kym-trust-v1');
		expect(ids).toContain('custom-v1');
	});
});

// ─── Trust Graph ─────────────────────────────────────────────────

describe('Trust Graph', () => {
	it('adds a trust edge', async () => {
		await addTrustEdge(db, {
			fromDid: 'did:web:issuer.example',
			toDid: 'did:web:agent-a.example',
			relationship: 'issuer',
			trustLevel: 0.9,
			frameworkId: 'kym-trust-v1'
		});
		const graph = await getTrustGraph(db, 'did:web:agent-a.example');
		expect(graph.incoming).toHaveLength(1);
		expect(graph.incoming[0].fromDid).toBe('did:web:issuer.example');
		expect(graph.incoming[0].trustLevel).toBe(0.9);
	});

	it('retrieves outgoing edges', async () => {
		const graph = await getTrustGraph(db, 'did:web:issuer.example');
		expect(graph.outgoing).toHaveLength(1);
		expect(graph.outgoing[0].toDid).toBe('did:web:agent-a.example');
	});

	it('updates existing edge on conflict', async () => {
		await addTrustEdge(db, {
			fromDid: 'did:web:issuer.example',
			toDid: 'did:web:agent-a.example',
			relationship: 'issuer',
			trustLevel: 0.95,
			frameworkId: 'kym-trust-v1'
		});
		const graph = await getTrustGraph(db, 'did:web:agent-a.example');
		expect(graph.incoming).toHaveLength(1);
		expect(graph.incoming[0].trustLevel).toBe(0.95);
	});
});

// ─── BFS Path Finding ────────────────────────────────────────────

describe('Trust Path Computation', () => {
	beforeAll(async () => {
		// Build a chain: A → B → C → D
		await addTrustEdge(db, {
			fromDid: 'did:web:a',
			toDid: 'did:web:b',
			relationship: 'peer',
			trustLevel: 0.8
		});
		await addTrustEdge(db, {
			fromDid: 'did:web:b',
			toDid: 'did:web:c',
			relationship: 'peer',
			trustLevel: 0.9
		});
		await addTrustEdge(db, {
			fromDid: 'did:web:c',
			toDid: 'did:web:d',
			relationship: 'endorser',
			trustLevel: 0.7
		});
	});

	it('finds a direct path (1 hop)', async () => {
		const path = await computeTrustPath(db, 'did:web:a', 'did:web:b');
		expect(path).not.toBeNull();
		expect(path!.hops).toBe(1);
		expect(path!.edges).toHaveLength(1);
		expect(path!.aggregateTrust).toBeCloseTo(0.8, 2);
	});

	it('finds a multi-hop path (A → B → C → D)', async () => {
		const path = await computeTrustPath(db, 'did:web:a', 'did:web:d');
		expect(path).not.toBeNull();
		expect(path!.hops).toBe(3);
		// 0.8 × 0.9 × 0.7 = 0.504
		expect(path!.aggregateTrust).toBeCloseTo(0.504, 2);
	});

	it('returns null for unreachable DID', async () => {
		const path = await computeTrustPath(db, 'did:web:a', 'did:web:nonexistent');
		expect(path).toBeNull();
	});

	it('returns identity path for same DID', async () => {
		const path = await computeTrustPath(db, 'did:web:a', 'did:web:a');
		expect(path).not.toBeNull();
		expect(path!.hops).toBe(0);
		expect(path!.aggregateTrust).toBe(1.0);
	});

	it('getTrustLevel returns aggregate trust', async () => {
		const level = await getTrustLevel(db, 'did:web:a', 'did:web:d');
		expect(level).toBeCloseTo(0.504, 2);
	});

	it('getTrustLevel returns 0 for unreachable DID', async () => {
		const level = await getTrustLevel(db, 'did:web:a', 'did:web:nonexistent');
		expect(level).toBe(0);
	});
});

// ─── ToIP Alignment ──────────────────────────────────────────────

describe('ToIP Alignment Check', () => {
	it('returns aligned=true for DID with framework-linked edges', async () => {
		const result = await alignWithToIP(db, 'did:web:agent-a.example');
		expect(result.aligned).toBe(true);
		expect(result.alignedFrameworks).toContain('kym-trust-v1');
	});

	it('returns aligned=false for DID with no edges', async () => {
		const result = await alignWithToIP(db, 'did:web:unknown');
		expect(result.aligned).toBe(false);
		expect(result.alignedFrameworks).toHaveLength(0);
	});
});
