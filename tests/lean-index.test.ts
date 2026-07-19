/**
 * Lean Index Tests — AgentAddr CRUD, signing, verification, caching, OASF interop
 * Phase 6 — Agent Bali
 * Uses @cloudflare/vitest-pool-workers with real local D1 + KV bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { LeanIndexService } from '../src/lib/services/lean-index';
import {
	upsertAgentAddr,
	getAgentAddr,
	listAgentAddrs,
	deleteAgentAddr,
	countAgentAddrs,
	getExpiredAgentAddrs
} from '../src/lib/db/repositories';
import { toOASFRecord, fromOASFRecord } from '../src/lib/types/agent-addr';
import type { AgentAddr } from '../src/lib/types/agent-addr';

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

// Table DDLs — each statement is a separate batch entry
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
	`CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL,
    facts_url TEXT NOT NULL, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300, signature_hex TEXT NOT NULL,
    signer_id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native',
    content_id TEXT)`,
	`CREATE INDEX IF NOT EXISTS idx_agent_addrs_source ON agent_addrs(source)`,
	`CREATE INDEX IF NOT EXISTS idx_agent_addrs_quilt ON agent_addrs(quilt_type)`,
	`CREATE INDEX IF NOT EXISTS idx_agent_addrs_expires ON agent_addrs(expires_at)`,
	`CREATE INDEX IF NOT EXISTS idx_agent_addrs_signer ON agent_addrs(signer_id)`
];

let signingKey: CryptoKey;
let verifyKey: CryptoKey;

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
	// Generate an Ed25519 key pair for testing
	const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
	signingKey = keyPair.privateKey;
	verifyKey = keyPair.publicKey;
});

// ── Repository Tests ────────────────────────────────────────────

describe('AgentAddr Repository', () => {
	it('upserts and retrieves a record', async () => {
		const db = createDbClient(env.DB);
		const record = await upsertAgentAddr(db, {
			agentId: 'repo-test-agent',
			publicKeyHex: 'aabbccdd',
			factsUrl: 'https://example.com/facts/repo-test',
			ttlSeconds: 600,
			signatureHex: 'deadbeef',
			signerId: 'test-signer'
		});
		expect(record.agentId).toBe('repo-test-agent');

		const fetched = await getAgentAddr(db, 'repo-test-agent');
		expect(fetched).not.toBeNull();
		expect(fetched!.factsUrl).toBe('https://example.com/facts/repo-test');
	});

	it('lists records with filters', async () => {
		const db = createDbClient(env.DB);
		await upsertAgentAddr(db, {
			agentId: 'filter-agent-gov',
			publicKeyHex: 'ab',
			factsUrl: 'https://gov.example.com/facts',
			ttlSeconds: 300,
			signatureHex: 'ab',
			signerId: 'test',
			quiltType: 'gov'
		});
		const govAddrs = await listAgentAddrs(db, { quiltType: 'gov' });
		expect(govAddrs.length).toBeGreaterThanOrEqual(1);
		expect(govAddrs.every((a) => a.quiltType === 'gov')).toBe(true);
	});

	it('deletes a record', async () => {
		const db = createDbClient(env.DB);
		await upsertAgentAddr(db, {
			agentId: 'delete-me',
			publicKeyHex: 'ab',
			factsUrl: 'https://example.com',
			ttlSeconds: 300,
			signatureHex: 'ab',
			signerId: 'test'
		});
		await deleteAgentAddr(db, 'delete-me');
		const fetched = await getAgentAddr(db, 'delete-me');
		expect(fetched).toBeNull();
	});

	it('counts records', async () => {
		const db = createDbClient(env.DB);
		const count = await countAgentAddrs(db);
		expect(count).toBeGreaterThanOrEqual(1);
	});

	it('upserts (updates) an existing record', async () => {
		const db = createDbClient(env.DB);
		await upsertAgentAddr(db, {
			agentId: 'upsert-agent',
			publicKeyHex: 'aa',
			factsUrl: 'https://v1.example.com',
			ttlSeconds: 100,
			signatureHex: 'sig1',
			signerId: 'test'
		});
		await upsertAgentAddr(db, {
			agentId: 'upsert-agent',
			publicKeyHex: 'bb',
			factsUrl: 'https://v2.example.com',
			ttlSeconds: 200,
			signatureHex: 'sig2',
			signerId: 'test'
		});
		const record = await getAgentAddr(db, 'upsert-agent');
		expect(record!.factsUrl).toBe('https://v2.example.com');
		expect(record!.publicKeyHex).toBe('bb');
	});
});

// ── Service Tests ───────────────────────────────────────────────

describe('LeanIndexService', () => {
	it('creates an AgentAddr with valid Ed25519 signature', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		const addr = await service.createAgentAddr({
			agent_id: 'svc-signed-agent',
			facts_url: 'https://example.com/facts/signed'
		});

		expect(addr.agent_id).toBe('svc-signed-agent');
		expect(addr.signature_hex).toBeTruthy();
		expect(addr.public_key_hex).toBeTruthy();
		expect(addr.ttl_seconds).toBe(300); // default
	});

	it('verifies a valid signature', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		const addr = await service.createAgentAddr({
			agent_id: 'verify-agent',
			facts_url: 'https://example.com/facts/verify'
		});

		const valid = await service.verify(addr);
		expect(valid).toBe(true);
	});

	it('rejects a tampered signature', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		const addr = await service.createAgentAddr({
			agent_id: 'tampered-agent',
			facts_url: 'https://example.com/facts/tampered'
		});

		// Tamper with the facts_url
		const tampered: AgentAddr = { ...addr, facts_url: 'https://evil.com/facts' };
		const valid = await service.verify(tampered);
		expect(valid).toBe(false);
	});

	it('resolves from KV cache', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		await service.createAgentAddr({
			agent_id: 'cached-agent',
			facts_url: 'https://example.com/facts/cached'
		});

		// First resolve populates cache, second should hit it
		const first = await service.resolve('cached-agent');
		expect(first).not.toBeNull();

		const second = await service.resolve('cached-agent');
		expect(second).not.toBeNull();
		expect(second!.cached).toBe(true);
	});

	it('resolves from D1 fallback when KV is empty', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		await service.createAgentAddr({
			agent_id: 'd1-fallback-agent',
			facts_url: 'https://example.com/facts/d1'
		});

		// Clear KV cache
		await env.NANDA_NODE_CACHE.delete('addr:d1-fallback-agent');

		const result = await service.resolve('d1-fallback-agent');
		expect(result).not.toBeNull();
		expect(result!.cached).toBe(false);
	});

	it('returns null for non-existent agent', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		const result = await service.resolve('does-not-exist');
		expect(result).toBeNull();
	});

	it('revokes an AgentAddr and prevents resolution', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		await service.createAgentAddr({
			agent_id: 'revoke-me',
			facts_url: 'https://example.com/facts/revoke'
		});

		await service.revoke('revoke-me');

		const result = await service.resolve('revoke-me');
		expect(result).toBeNull();
	});

	it('creates with custom ttl and quilt_type', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		const addr = await service.createAgentAddr({
			agent_id: 'custom-agent',
			facts_url: 'https://gov.example.com/facts',
			ttl_seconds: 3600,
			quilt_type: 'gov'
		});

		expect(addr.ttl_seconds).toBe(3600);
		expect(addr.quilt_type).toBe('gov');
	});

	it('canonicalize is deterministic with sorted keys', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);

		const signable = {
			agent_id: 'test',
			public_key_hex: 'abc',
			facts_url: 'https://example.com',
			private_url: undefined,
			resolver_url: undefined,
			ttl_seconds: 300,
			signer_id: 'test-signer'
		};

		const c1 = service.canonicalize(signable);
		const c2 = service.canonicalize(signable);
		expect(c1).toBe(c2);

		// Keys should be sorted
		const parsed = JSON.parse(c1);
		const keys = Object.keys(parsed);
		expect(keys).toEqual([...keys].sort());
	});

	it('count returns correct number', async () => {
		const db = createDbClient(env.DB);
		const service = new LeanIndexService(
			db,
			env.NANDA_NODE_CACHE,
			signingKey,
			'homeport-node',
			verifyKey
		);
		const count = await service.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});
});

// ── OASF Interop Tests ──────────────────────────────────────────

describe('OASF Interop', () => {
	it('converts AgentAddr to OASF record', () => {
		const addr: AgentAddr = {
			agent_id: 'oasf-test',
			public_key_hex: 'aabb',
			facts_url: 'https://example.com/facts',
			ttl_seconds: 300,
			signature_hex: 'deadbeef',
			signer_id: 'test-signer',
			created_at: 1700000000,
			updated_at: 1700000000,
			source: 'local',
			quilt_type: 'native'
		};

		const oasf = toOASFRecord(addr, {
			description: 'Test agent',
			skills: ['text_classification'],
			trust_certifications: ['cert-001']
		});

		expect(oasf.name).toBe('oasf-test');
		expect(oasf.locators[0].url).toBe('https://example.com/facts');
		expect(oasf.skills).toContain('text_classification');
		expect(oasf.annotations['nanda.trust/certifications']).toEqual(['cert-001']);
	});

	it('converts AgentAddr with content_id to OASF', () => {
		const addr: AgentAddr = {
			agent_id: 'cid-test',
			public_key_hex: 'aabb',
			facts_url: 'https://example.com/facts',
			ttl_seconds: 300,
			signature_hex: 'deadbeef',
			signer_id: 'test-signer',
			created_at: 1700000000,
			updated_at: 1700000000,
			source: 'local',
			quilt_type: 'native',
			content_id: 'sha256:abc123'
		};

		const oasf = toOASFRecord(addr);
		expect(oasf.annotations['agntcy.content_id']).toBe('sha256:abc123');
	});

	it('imports OASF record to partial AgentAddr', () => {
		const oasf = {
			name: 'imported-agent',
			version: '1.0.0',
			schema_version: '1.0.0',
			description: 'An imported agent',
			authors: ['someone'],
			created_at: '2024-01-01T00:00:00.000Z',
			skills: ['nlp'],
			domains: [],
			locators: [{ url: 'https://imported.example.com/facts', protocol: 'https' }],
			modules: [],
			annotations: { 'agntcy.content_id': 'sha256:def456' }
		};

		const partial = fromOASFRecord(oasf);
		expect(partial.agent_id).toBe('imported-agent');
		expect(partial.facts_url).toBe('https://imported.example.com/facts');
		expect(partial.content_id).toBe('sha256:def456');
	});

	it('handles OASF record with no locators', () => {
		const oasf = {
			name: 'no-locator',
			version: '1.0.0',
			schema_version: '1.0.0',
			description: 'Agent without locator',
			authors: [],
			created_at: '2024-01-01T00:00:00.000Z',
			skills: [],
			domains: [],
			locators: [],
			modules: [],
			annotations: {}
		};

		const partial = fromOASFRecord(oasf);
		expect(partial.agent_id).toBe('no-locator');
		expect(partial.facts_url).toBe('');
	});
});
