/**
 * GET /federation/peers — List federation peers
 * POST /federation/peers — Register a peer (federation admin key required)
 *
 * Public endpoint (read-only) returning the list of known federation peers.
 * POST is authenticated via NANDA_FEDERATION_ADMIN_KEY and used by the mutual join flow.
 *
 * @swagger
 * /federation/peers:
 *   get:
 *     summary: List federation peers
 *     description: Returns all known federation peer registries with status and last sync time.
 *     tags:
 *       - Federation
 *     responses:
 *       200:
 *         description: Array of federation peers
 *   post:
 *     summary: Register a federation peer
 *     description: Register a new peer. Requires federation admin key.
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
 *         description: Peer registered
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { PeerService } from '$lib/services/federation/peers';
import { validatePeerUrl } from '$lib/services/federation';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'federation-peers');

export const GET: RequestHandler = async ({ request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	const env = platform!.env;
	const db = createDbClient(env.DB);
	const peers = new PeerService(db);

	const allPeers = await peers.getAllPeers();
	const summary = await peers.getPeerSummary();

	return json({
		peers: allPeers,
		summary
	});
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	const env = platform!.env;
	const db = createDbClient(env.DB);
	const peerService = new PeerService(db);

	const body = (await request.json()) as Record<string, unknown>;
	const { peer_id, peer_url, node_id, capabilities, quilt_types } = body as {
		peer_id?: string;
		peer_url?: string;
		node_id?: string;
		capabilities?: string[];
		quilt_types?: string[];
	};

	if (!peer_id || !peer_url || !node_id) {
		return json({ error: 'peer_id, peer_url, and node_id are required' }, { status: 400 });
	}

	// Validate the URL before persisting — same guard as /federation/join.
	// Rejects private/loopback hosts in non-dev so a holder of the shared
	// federation admin key cannot register an SSRF target that the
	// gossip-push cron will later fetch.
	try {
		validatePeerUrl(peer_url, env.ENVIRONMENT);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'Invalid peer_url' },
			{ status: 400 }
		);
	}

	try {
		const peer = await peerService.registerPeer({
			peer_id,
			peer_url,
			node_id,
			capabilities: capabilities ?? [],
			quilt_types: quilt_types ?? []
		});
		log.info('POST', `Registered peer ${peer_id} (${node_id}) at ${peer_url}`);
		return json({ ok: true, peer });
	} catch (err) {
		log.error('POST', 'Failed to register peer', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
