/**
 * @swagger
 * /federation/status:
 *   get:
 *     summary: Federation status
 *     description: Returns federation status including v1 pull-sync and v2 CRDT gossip state.
 *     tags:
 *       - Federation
 *     responses:
 *       200:
 *         description: Federation status (v1 + v2)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFederationStatus, getFederationV2Status } from '$lib/services/federation';
import { createDbClient } from '$lib/db/client';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';
import { importSigningKey } from '$lib/crypto/sign-agent';

export const GET: RequestHandler = async ({ request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;
	const env = platform!.env;
	const db = createDbClient(env.DB);

	const v1Status = await getFederationStatus(db);

	// v2 status is best-effort — tables may not exist yet (pre-migration),
	// and the signing key may not be provisioned on brand-new nodes.
	let v2Status = null;
	try {
		const signingKey = await importSigningKey(env);
		v2Status = await getFederationV2Status(
			db,
			env as unknown as Record<string, unknown>,
			signingKey
		);
	} catch {
		// federation_peers table may not exist yet, or the Ed25519 key is
		// not configured — graceful degradation.
	}

	return json({
		node_id: env.NANDA_NODE_ID ?? 'unknown',
		configured_peer: env.NANDA_FEDERATION_PEER_URL ?? null,
		peers_count: v1Status?.length ?? 0,
		peers: v1Status,
		...(v2Status ? { v2: v2Status } : {})
	});
};
