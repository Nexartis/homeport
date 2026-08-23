/**
 * POST /federation/join — Mutual peer registration (handshake)
 *
 * Initiates a two-way peer registration. When Node A calls Node B's /federation/join:
 *   1. Node B registers Node A as a peer.
 *   2. Node B calls Node A's POST /federation/peers to register itself.
 *   3. Both nodes are now mutually registered.
 *
 * Authenticated via NANDA_FEDERATION_ADMIN_KEY (shared key).
 *
 * @swagger
 * /federation/join:
 *   post:
 *     summary: Mutual peer registration
 *     description: Registers the caller as a peer and reciprocally registers this node on the caller.
 *     tags:
 *       - Federation
 *     security:
 *       - FederationAdmin: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [peer_id, peer_url, node_id]
 *             properties:
 *               peer_id:
 *                 type: string
 *               peer_url:
 *                 type: string
 *               node_id:
 *                 type: string
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Both sides registered
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { PeerService } from '$lib/services/federation/peers';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';
import { validatePeerUrl } from '$lib/services/federation';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, resolvePublicKey, SECRET_KEYS } from '$lib/utils/node-secrets';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'federation-join');

export const POST: RequestHandler = async ({ request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	const env = platform!.env;
	const db = createDbClient(env.DB);
	const peerService = new PeerService(db);

	const body = (await request.json()) as Record<string, unknown>;
	const { peer_id, peer_url, node_id, capabilities, public_key_spki } = body as {
		peer_id?: string;
		peer_url?: string;
		node_id?: string;
		capabilities?: string[];
		public_key_spki?: string;
	};

	if (!peer_id || !peer_url || !node_id) {
		return json({ error: 'peer_id, peer_url, and node_id are required' }, { status: 400 });
	}

	// Step 1: Register the remote peer locally
	try {
		await peerService.registerPeer({
			peer_id,
			peer_url,
			node_id,
			capabilities: capabilities ?? [],
			quilt_types: [],
			public_key_spki: public_key_spki ?? null
		});
		log.info('POST', `Registered incoming peer ${peer_id} (${node_id})`);
	} catch (err) {
		log.error('POST', 'Failed to register remote peer locally', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to register peer' }, { status: 500 });
	}

	// Step 2: Register ourselves on the remote node
	const myNodeId = env.NANDA_NODE_ID ?? 'unknown';
	const myRegistryUrl = env.NANDA_REGISTRY_URL;
	if (!myRegistryUrl) {
		log.warn('POST', 'NANDA_REGISTRY_URL not configured — skipping reciprocal registration');
		return json({
			ok: true,
			mutual: false,
			reason: 'NANDA_REGISTRY_URL not configured on this node'
		});
	}

	const fedKey = await resolveSecret(
		env.NANDA_FEDERATION_ADMIN_KEY,
		kvFallback(env, SECRET_KEYS.FEDERATION_ADMIN_KEY)
	);

	// SSRF validation — block private/loopback IPs
	try {
		validatePeerUrl(peer_url, env.ENVIRONMENT);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Invalid peer URL' },
			{ status: 400 }
		);
	}

	const myPublicKey = await resolvePublicKey(env.NANDA_ED25519_PUBLIC_KEY_v1, env, 'v1');

	try {
		const reciprocal = await fetch(`${peer_url}/federation/peers`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(fedKey ? { Authorization: `Bearer ${fedKey}` } : {})
			},
			body: JSON.stringify({
				peer_id: myNodeId,
				peer_url: myRegistryUrl,
				node_id: myNodeId,
				capabilities: ['registry', 'gossip'],
				public_key_spki: myPublicKey ?? null
			}),
			signal: AbortSignal.timeout(10_000)
		});

		if (!reciprocal.ok) {
			const errText = await reciprocal.text();
			log.warn('POST', `Reciprocal registration failed (${reciprocal.status}): ${errText}`);
			return json({ ok: true, mutual: false, reason: `Remote returned ${reciprocal.status}` });
		}

		log.info('POST', `Mutual registration complete: ${myNodeId} ↔ ${node_id}`);
		return json({ ok: true, mutual: true });
	} catch (err) {
		log.warn('POST', 'Reciprocal registration network error', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({
			ok: true,
			mutual: false,
			reason: err instanceof Error ? err.message : String(err)
		});
	}
};
