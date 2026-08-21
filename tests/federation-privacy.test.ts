/**
 * Set C — Federation Privacy Tests (proof surface)
 *
 * Proves the gossip privacy rules:
 *  - getDeltasSince (outbound) emits ONLY public/for_hire rows and carries
 *    visibility in each delta's agent_addr.
 *  - Inbound merge rejects (strips) deltas whose visibility is not
 *    public/for_hire, and accepts discoverable ones while preserving
 *    visibility + federated source.
 *  - Tombstone semantics are unchanged (null agent_addr still deletes).
 */
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '$lib/db/client';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { importSigningKey } from '$lib/crypto/sign-agent';
import type { AgentAddrDelta } from '$lib/types/federation-v2';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		ENVIRONMENT: string;
	}
}

let _testSigningKey: CryptoKey;
async function getTestSigningKey(): Promise<CryptoKey> {
	if (_testSigningKey) return _testSigningKey;
	_testSigningKey = await importSigningKey(env);
	return _testSigningKey;
}

/** Seed an agent_addrs row with an explicit visibility. */
function seedAgentAddr(
	db: D1Database,
	agentId: string,
	agentUrl: string,
	visibility: string,
	opts: { source?: string; status?: string; updatedAt?: number } = {}
) {
	const { source = 'local', status = 'alive', updatedAt = Math.floor(Date.now() / 1000) } = opts;
	return db
		.prepare(
			`INSERT OR REPLACE INTO agent_addrs
			(agent_id, agent_url, public_key_hex, facts_url, signature_hex, signer_id, source, status, visibility, updated_at)
			VALUES (?, ?, 'federated:unsigned', '', 'federated:unsigned', ?, ?, ?, ?, ?)`
		)
		.bind(agentId, agentUrl, source, source, status, visibility, updatedAt)
		.run();
}

async function getRow(agentId: string) {
	return env.DB.prepare(`SELECT * FROM agent_addrs WHERE agent_id = ?`).bind(agentId).first<{
		agent_id: string;
		source: string;
		status: string;
		visibility: string;
	}>();
}

describe('CRDT getDeltasSince — outbound privacy', () => {
	it('emits only public/for_hire rows and includes visibility in agent_addr', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'fp-out-public', 'https://pub.example.com', 'public', {
			source: 'local',
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'fp-out-forhire', 'https://hire.example.com', 'for_hire', {
			source: 'local',
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'fp-out-private', 'https://priv.example.com', 'private', {
			source: 'local',
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'fp-out-unlisted', 'https://unlist.example.com', 'unlisted', {
			source: 'local',
			updatedAt: now
		});

		const deltas = await crdt.getDeltasSince({ 'some-peer': now - 50 });
		const byId = new Map(deltas.map((d) => [d.agent_id, d]));

		const pub = byId.get('fp-out-public');
		const hire = byId.get('fp-out-forhire');
		expect(pub).toBeDefined();
		expect(hire).toBeDefined();
		expect(pub!.agent_addr?.visibility).toBe('public');
		expect(hire!.agent_addr?.visibility).toBe('for_hire');

		expect(byId.has('fp-out-private')).toBe(false);
		expect(byId.has('fp-out-unlisted')).toBe(false);
	});

	it('still emits tombstones (dead rows) for discoverable agents', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'fp-out-dead', 'https://dead.example.com', 'public', {
			source: 'federated:peer-x',
			status: 'dead',
			updatedAt: now
		});

		const deltas = await crdt.getDeltasSince({ 'some-peer': now - 50 });
		const dead = deltas.find((d) => d.agent_id === 'fp-out-dead');
		expect(dead).toBeDefined();
		expect(dead!.agent_addr).toBeNull();
	});
});

describe('CRDT merge — inbound privacy', () => {
	it('rejects a private-visibility delta (not stored)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		const delta: AgentAddrDelta = {
			agent_id: 'fp-in-private',
			agent_addr: {
				agent_id: 'fp-in-private',
				agent_url: 'https://in-priv.example.com',
				status: 'alive',
				visibility: 'private'
			},
			updated_at: now,
			source_node: 'peer-alpha'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(0);
		expect(result.rejected).toBe(1);
		expect(await getRow('fp-in-private')).toBeNull();
	});

	it('rejects an unlisted-visibility delta (not stored)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		const delta: AgentAddrDelta = {
			agent_id: 'fp-in-unlisted',
			agent_addr: {
				agent_id: 'fp-in-unlisted',
				agent_url: 'https://in-unlist.example.com',
				status: 'alive',
				visibility: 'unlisted'
			},
			updated_at: now,
			source_node: 'peer-alpha'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(0);
		expect(result.rejected).toBe(1);
		expect(await getRow('fp-in-unlisted')).toBeNull();
	});

	it('accepts a public delta and preserves visibility + federated source', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		const delta: AgentAddrDelta = {
			agent_id: 'fp-in-public',
			agent_addr: {
				agent_id: 'fp-in-public',
				agent_url: 'https://in-pub.example.com',
				status: 'alive',
				visibility: 'public'
			},
			updated_at: now,
			source_node: 'peer-alpha'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(1);
		const row = await getRow('fp-in-public');
		expect(row).not.toBeNull();
		expect(row!.visibility).toBe('public');
		expect(row!.source).toBe('federated:peer-alpha');
	});

	it('accepts a for_hire delta and preserves visibility', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		const delta: AgentAddrDelta = {
			agent_id: 'fp-in-forhire',
			agent_addr: {
				agent_id: 'fp-in-forhire',
				agent_url: 'https://in-hire.example.com',
				status: 'alive',
				visibility: 'for_hire'
			},
			updated_at: now,
			source_node: 'peer-beta'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(1);
		const row = await getRow('fp-in-forhire');
		expect(row!.visibility).toBe('for_hire');
		expect(row!.source).toBe('federated:peer-beta');
	});

	it('treats a delta with missing visibility as public (accepted)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		const delta: AgentAddrDelta = {
			agent_id: 'fp-in-novis',
			agent_addr: {
				agent_id: 'fp-in-novis',
				agent_url: 'https://in-novis.example.com',
				status: 'alive'
			},
			updated_at: now,
			source_node: 'peer-gamma'
		};

		const result = await crdt.merge([delta]);
		expect(result.accepted).toBe(1);
		const row = await getRow('fp-in-novis');
		expect(row!.visibility).toBe('public');
	});

	it('keeps tombstone semantics intact (null agent_addr deletes federated row)', async () => {
		const db = createDbClient(env.DB);
		const crdt = new CRDTMergeEngine(db, await getTestSigningKey());
		const now = Math.floor(Date.now() / 1000);

		await seedAgentAddr(env.DB, 'fp-tombstone', 'https://tomb.example.com', 'public', {
			source: 'federated:peer-delta',
			status: 'alive',
			updatedAt: now - 100
		});

		const delta: AgentAddrDelta = {
			agent_id: 'fp-tombstone',
			agent_addr: null,
			updated_at: now,
			source_node: 'peer-delta'
		};

		const result = await crdt.merge([delta]);
		expect(result.tombstones).toBe(1);
		expect(result.accepted).toBe(1);
		const row = await getRow('fp-tombstone');
		expect(row!.status).toBe('dead');
	});
});
