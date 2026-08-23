/**
 * Set C — Dual-Node Federation Proof (TWO INDEPENDENTLY CONFIGURED NODES)
 *
 * Node-a is this node (env.NANDA_NODE_ID, env Ed25519 keypair). Node-b gets an
 * INDEPENDENTLY generated Ed25519 keypair and its own node id, registered as a
 * federation peer. The test proves both gossip directions honour the privacy
 * rules across distinct identities:
 *
 *  (a) OUTBOUND node-a → node-b: with globalThis.fetch stubbed (pattern from
 *      certifier.test.ts), a gossip push to node-b must carry ONLY
 *      public/for_hire agents and node-a's Ed25519 signature.
 *  (b) INBOUND node-b → node-a: a gossip message signed with node-b's
 *      independent key is POSTed via SELF.fetch to /federation/gossip; it must
 *      verify against node-b's public key, merge with source 'federated:node-b',
 *      and node-b's private-visibility delta must be dropped.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createDbClient } from '$lib/db/client';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { GossipService } from '$lib/services/federation/gossip';
import { PeerService } from '$lib/services/federation/peers';
import { importSigningKey } from '$lib/crypto/sign-agent';
import type { GossipMessage } from '$lib/types/federation-v2';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		ENVIRONMENT: string;
		NANDA_FEDERATION_ADMIN_KEY: string;
		NANDA_NODE_ID: string;
		KYM_NANDA_ED25519_PRIVATE_KEY_v1: string;
		NANDA_ED25519_PUBLIC_KEY_v1: string;
	}
}

const TABLES = [
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

// ── helpers ────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

function hexEncode(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Generate an independent Ed25519 keypair; returns private CryptoKey + spki public base64. */
async function generateNodeKeypair(): Promise<{ privateKey: CryptoKey; publicKeyBase64: string }> {
	const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
	const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
	return { privateKey: pair.privateKey, publicKeyBase64: bytesToBase64(spki) };
}

/** Sign a gossip payload with the given key — same canonicalization as GossipService.signMessage. */
async function signGossipPayload(
	payload: Omit<GossipMessage, 'signature_hex'>,
	privateKey: CryptoKey
): Promise<string> {
	const data = new TextEncoder().encode(JSON.stringify(payload));
	const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, data));
	return hexEncode(sig);
}

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
			VALUES (?, ?, 'node-key', '', 'node-sig', ?, ?, ?, ?, ?)`
		)
		.bind(agentId, agentUrl, source, source, status, visibility, updatedAt)
		.run();
}

async function getRow(agentId: string) {
	return env.DB.prepare(`SELECT * FROM agent_addrs WHERE agent_id = ?`)
		.bind(agentId)
		.first<{ agent_id: string; source: string; visibility: string }>();
}

describe('Dual-node federation — two independently configured nodes', () => {
	const NODE_B_ID = 'node-b';
	const NODE_B_PEER_URL = 'https://node-b.example.com';

	it('(a) outbound gossip to node-b carries only public/for_hire agents + node-a signature', async () => {
		const db = createDbClient(env.DB);
		const now = Math.floor(Date.now() / 1000);

		// Preflight: the configured node keypair must actually be a pair. The test
		// env is shared across suites (singleWorker, isolatedStorage:false); a leak
		// that mutates KYM_NANDA_ED25519_PRIVATE_KEY_v1 would otherwise surface
		// here as a flaky signature failure (certifier.test.ts once did this).
		const privDer = Uint8Array.from(atob(env.KYM_NANDA_ED25519_PRIVATE_KEY_v1), (c) =>
			c.charCodeAt(0)
		);
		const privJwk = await crypto.subtle.exportKey(
			'jwk',
			await crypto.subtle.importKey('pkcs8', privDer, { name: 'Ed25519' }, true, ['sign'])
		);
		const derivedPub = await crypto.subtle.importKey(
			'jwk',
			{ kty: 'OKP', crv: 'Ed25519', x: privJwk.x as string },
			{ name: 'Ed25519' },
			true,
			['verify']
		);
		const derivedPubSpki = bytesToBase64(
			new Uint8Array(await crypto.subtle.exportKey('spki', derivedPub))
		);
		expect(derivedPubSpki).toBe(env.NANDA_ED25519_PUBLIC_KEY_v1);

		// Node-a registry: one agent per visibility state
		await seedAgentAddr(env.DB, 'dn-out-public', 'https://dn-out-pub.example.com', 'public', {
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'dn-out-forhire', 'https://dn-out-hire.example.com', 'for_hire', {
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'dn-out-private', 'https://dn-out-priv.example.com', 'private', {
			updatedAt: now
		});
		await seedAgentAddr(env.DB, 'dn-out-unlisted', 'https://dn-out-unl.example.com', 'unlisted', {
			updatedAt: now
		});

		// Register node-b (independent node id) as a federation peer of node-a
		const peers = new PeerService(db);
		await peers.registerPeer({ peer_id: NODE_B_ID, peer_url: NODE_B_PEER_URL, node_id: NODE_B_ID });

		const crdt = new CRDTMergeEngine(db, await importSigningKey(env));
		const nodeAId = env.NANDA_NODE_ID;
		const gossip = new GossipService(
			db,
			crdt,
			peers,
			nodeAId,
			env.NANDA_FEDERATION_ADMIN_KEY,
			env.KYM_NANDA_ED25519_PRIVATE_KEY_v1
		);

		// Stub globalThis.fetch to capture the gossip push (certifier.test.ts pattern)
		let capturedUrl = '';
		let capturedBody: GossipMessage | null = null;
		let capturedAuth: string | null = null;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi
			.fn()
			.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
				capturedUrl = String(input);
				capturedBody = JSON.parse(String(init?.body)) as GossipMessage;
				const hdrs = new Headers(init?.headers);
				capturedAuth = hdrs.get('Authorization');
				return new Response(
					JSON.stringify({
						accepted: 2,
						rejected: 0,
						conflicts: 0,
						tombstones: 0,
						acceptedIndices: []
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}) as unknown as typeof fetch;

		try {
			await gossip.pushToPeer(NODE_B_ID);
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(capturedUrl).toBe(`${NODE_B_PEER_URL}/federation/gossip`);
		expect(capturedBody).not.toBeNull();
		expect(capturedBody!.node_id).toBe(nodeAId);
		expect(capturedAuth).toBeNull();

		// Payload carries node-a's signature, verifiable with node-a's public key
		expect(capturedBody!.signature_hex).not.toBe('');
		const verified = await gossip.verifySignature(capturedBody!, env.NANDA_ED25519_PUBLIC_KEY_v1);
		expect(verified).toBe(true);

		// Only public/for_hire agents propagate; each delta carries visibility
		const deltasById = new Map(capturedBody!.agent_addr_deltas.map((d) => [d.agent_id, d]));
		expect(deltasById.has('dn-out-public')).toBe(true);
		expect(deltasById.has('dn-out-forhire')).toBe(true);
		expect(deltasById.has('dn-out-private')).toBe(false);
		expect(deltasById.has('dn-out-unlisted')).toBe(false);
		expect(deltasById.get('dn-out-public')!.agent_addr?.visibility).toBe('public');
		expect(deltasById.get('dn-out-forhire')!.agent_addr?.visibility).toBe('for_hire');
	});

	it('(b) inbound gossip signed with node-b independent key verifies, merges, drops private', async () => {
		const db = createDbClient(env.DB);
		const now = Math.floor(Date.now() / 1000);

		// Independent node-b identity: fresh Ed25519 keypair + node id
		const nodeB = await generateNodeKeypair();

		// Register node-b as a federation peer (handleInbound keys peers by node_id)
		const peers = new PeerService(db);
		await peers.registerPeer({
			peer_id: NODE_B_ID,
			peer_url: NODE_B_PEER_URL,
			node_id: NODE_B_ID,
			public_key_spki: nodeB.publicKeyBase64
		});
		// Outbound test pushed recently — clear the inbound rate-limit window
		await env.DB.prepare(`UPDATE federation_peers SET last_gossip_at = 0 WHERE peer_id = ?`)
			.bind(NODE_B_ID)
			.run();

		// Build node-b's gossip message: one public + one private delta
		const payload: Omit<GossipMessage, 'signature_hex'> = {
			node_id: NODE_B_ID,
			timestamp: now,
			agent_addr_deltas: [
				{
					agent_id: 'dn-in-public',
					agent_addr: {
						agent_id: 'dn-in-public',
						agent_url: 'https://dn-in-pub.example.com',
						status: 'alive',
						visibility: 'public'
					},
					updated_at: now,
					source_node: NODE_B_ID
				},
				{
					agent_id: 'dn-in-private',
					agent_addr: {
						agent_id: 'dn-in-private',
						agent_url: 'https://dn-in-priv.example.com',
						status: 'alive',
						visibility: 'private'
					},
					updated_at: now,
					source_node: NODE_B_ID
				}
			],
			vector_clock: { [NODE_B_ID]: now }
		};
		const message: GossipMessage = {
			...payload,
			signature_hex: await signGossipPayload(payload, nodeB.privateKey)
		};

		// The signature verifies against node-b's independent public key
		const crdt = new CRDTMergeEngine(db, await importSigningKey(env));
		const verifier = new GossipService(db, crdt, peers, env.NANDA_NODE_ID);
		expect(await verifier.verifySignature(message, nodeB.publicKeyBase64)).toBe(true);
		// …and NOT against node-a's public key (distinct identities)
		expect(await verifier.verifySignature(message, env.NANDA_ED25519_PUBLIC_KEY_v1)).toBe(false);

		// Deliver via the real gossip endpoint
		const res = await SELF.fetch('https://fake.host/federation/gossip', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CF-Connecting-IP': '10.0.9.1'
			},
			body: JSON.stringify(message)
		});
		expect(res.status).toBe(200);
		const result = (await res.json()) as { accepted: number; rejected: number };
		expect(result.accepted).toBe(1);
		expect(result.rejected).toBe(1);

		// Public delta merged under node-b's federated source; private delta dropped
		const pub = await getRow('dn-in-public');
		expect(pub).not.toBeNull();
		expect(pub!.source).toBe(`federated:${NODE_B_ID}`);
		expect(pub!.visibility).toBe('public');
		expect(await getRow('dn-in-private')).toBeNull();
	});
});
