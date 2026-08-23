/**
 * POST /federation/gossip — Gossip inbound endpoint
 *
 * Receives gossip messages from federation peers.
 * Authenticated via enrolled peer Ed25519 signature (no shared bearer).
 * Returns CRDT merge result.
 *
 * @swagger
 * /federation/gossip:
 *   post:
 *     summary: Receive gossip from peers
 *     description: CRDT gossip inbound endpoint. Merges agent state from peer registries using LWW-Element-Set CRDTs.
 *     tags:
 *       - Federation
 *     security:
 *       - PeerEd25519: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - peer_url
 *               - entries
 *             properties:
 *               peer_url:
 *                 type: string
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Merge results
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { GossipService } from '$lib/services/federation/gossip';
import { PeerService } from '$lib/services/federation/peers';
import { PeerAuthError } from '$lib/services/federation/peer-auth';
import type { GossipMessage } from '$lib/types/federation-v2';
import { importSigningKey } from '$lib/crypto/sign-agent';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'gossip-route');

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const env = platform.env;
	const db = createDbClient(env.DB);

	let message: GossipMessage;
	try {
		message = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate message structure (reject null, arrays, and non-object vector_clock)
	if (
		!message.node_id ||
		!Array.isArray(message.agent_addr_deltas) ||
		typeof message.vector_clock !== 'object' ||
		message.vector_clock === null ||
		Array.isArray(message.vector_clock)
	) {
		return json({ error: 'Invalid gossip message structure' }, { status: 400 });
	}

	const signingKey = await importSigningKey(env);
	const crdt = new CRDTMergeEngine(db, signingKey);
	const peers = new PeerService(db);
	const nodeId = env.NANDA_NODE_ID ?? 'homeport-node';
	const gossip = new GossipService(db, crdt, peers, nodeId);

	// Use node_id as peer_id for inbound gossip
	const peerId = message.node_id;

	let result;
	try {
		result = await gossip.handleInbound(message, peerId);
	} catch (err) {
		if (err instanceof PeerAuthError) {
			return json({ error: err.message }, { status: err.status });
		}
		throw err;
	}

	log.info(
		'POST',
		`Gossip inbound from ${peerId}: ${result.accepted} accepted, ${result.rejected} rejected`,
		{
			peerId,
			deltasCount: message.agent_addr_deltas.length,
			...result
		}
	);

	return json(result);
};
