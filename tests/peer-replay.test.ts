/**
 * Peer Replay Tests — HP-S1 timestamp freshness for signed gossip
 *
 * A valid Ed25519 signature alone does not stop replay: gcTombstones can
 * resurrect dead agents from re-delivered old 'alive' deltas. These tests
 * pin verifySignedPeerRequest's freshness window (REPLAY_SKEW_MS).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '$lib/db/client';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { PeerService } from '$lib/services/federation/peers';
import { GossipService } from '$lib/services/federation/gossip';
import { PeerAuthError, REPLAY_SKEW_MS } from '$lib/services/federation/peer-auth';
import { importSigningKey } from '$lib/crypto/sign-agent';
import type { GossipMessage } from '$lib/types/federation-v2';

const PEER_ID = 'replay-peer';

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
    rejected INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()))`
];

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

async function makeGossip(): Promise<GossipService> {
	const db = createDbClient(env.DB);
	const crdt = new CRDTMergeEngine(db, await importSigningKey(env));
	const peers = new PeerService(db);
	return new GossipService(db, crdt, peers, 'kym-test', env.NANDA_FEDERATION_ADMIN_KEY);
}

async function seedEnrolledPeer(): Promise<void> {
	await env.DB.prepare(
		`INSERT OR REPLACE INTO federation_peers
		(peer_id, peer_url, node_id, status, last_gossip_at, public_key_spki)
		VALUES (?, ?, ?, ?, ?, ?)`
	)
		.bind(
			PEER_ID,
			'https://replay.example.com',
			PEER_ID,
			'active',
			0,
			env.NANDA_ED25519_PUBLIC_KEY_v1
		)
		.run();
}

describe('gossip replay protection (HP-S1)', () => {
	beforeEach(async () => {
		await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
		await seedEnrolledPeer();
	});

	it('refuses a signed replay with a stale timestamp', async () => {
		const gossip = await makeGossip();
		const message = await signNodeGossip({
			node_id: PEER_ID,
			timestamp: Math.floor(Date.now() / 1000) - REPLAY_SKEW_MS / 1000 - 5,
			agent_addr_deltas: [],
			vector_clock: { [PEER_ID]: 1 }
		});
		const err: unknown = await gossip.handleInbound(message, PEER_ID).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(PeerAuthError);
		expect((err as PeerAuthError).status).toBe(401);
	});

	it('still accepts a signed message with a fresh timestamp', async () => {
		const gossip = await makeGossip();
		const now = Math.floor(Date.now() / 1000);
		const message = await signNodeGossip({
			node_id: PEER_ID,
			timestamp: now,
			agent_addr_deltas: [
				{
					agent_id: 'replay-fresh-agent',
					agent_addr: {
						agent_id: 'replay-fresh-agent',
						agent_url: 'https://fresh.example.com'
					},
					updated_at: now,
					source_node: PEER_ID
				}
			],
			vector_clock: { [PEER_ID]: 1 }
		});
		const result = await gossip.handleInbound(message, PEER_ID);
		expect(result.accepted).toBe(1);
	});

	it('honors the skew boundary defined by REPLAY_SKEW_MS', async () => {
		const gossip = await makeGossip();

		// Just inside the window: ceil() keeps age strictly below REPLAY_SKEW_MS.
		const insideTs = Math.ceil((Date.now() - REPLAY_SKEW_MS + 1000) / 1000);
		const inside = await signNodeGossip({
			node_id: PEER_ID,
			timestamp: insideTs,
			agent_addr_deltas: [],
			vector_clock: { [PEER_ID]: 1 }
		});
		await expect(gossip.handleInbound(inside, PEER_ID)).resolves.toBeDefined();

		// One tick beyond: floor() keeps age strictly above REPLAY_SKEW_MS.
		const outsideTs = Math.floor((Date.now() - REPLAY_SKEW_MS - 1000) / 1000);
		const outside = await signNodeGossip({
			node_id: PEER_ID,
			timestamp: outsideTs,
			agent_addr_deltas: [],
			vector_clock: { [PEER_ID]: 1 }
		});
		await expect(gossip.handleInbound(outside, PEER_ID)).rejects.toBeInstanceOf(PeerAuthError);
	});

	it('refuses a future-dated timestamp beyond the skew window', async () => {
		const gossip = await makeGossip();
		const message = await signNodeGossip({
			node_id: PEER_ID,
			timestamp: Math.floor(Date.now() / 1000) + REPLAY_SKEW_MS / 1000 + 5,
			agent_addr_deltas: [],
			vector_clock: { [PEER_ID]: 1 }
		});
		await expect(gossip.handleInbound(message, PEER_ID)).rejects.toMatchObject({
			name: 'PeerAuthError',
			status: 401
		});
	});
});
