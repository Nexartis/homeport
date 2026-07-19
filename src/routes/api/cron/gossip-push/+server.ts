/**
 * POST /api/cron/gossip-push — Cron-triggered gossip push to all healthy peers
 *
 * Called by the injected scheduled handler. Authenticated via X-Cron-Auth.
 * Pushes agent deltas to all active/degraded federation peers.
 
 * @swagger
 * /api/cron/gossip-push:
 *   post:
 *     summary: Cron gossip push
 *     description: Scheduled gossip push to all healthy federation peers. Internal cron endpoint.
 *     tags:
 *       - Internal
 *     security:
 *       - CronAuth: []
 *     responses:
 *       200:
 *         description: Gossip pushed
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { requireCronAuth } from '$lib/middleware/auth-guards';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { GossipService } from '$lib/services/federation/gossip';
import { PeerService } from '$lib/services/federation/peers';
import { createLogger } from '$lib/utils/logger';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { importSigningKey } from '$lib/crypto/sign-agent';

const log = createLogger(undefined, 'cron-gossip');

export const POST: RequestHandler = async ({ request, platform }) => {
	// Auth guard first — safe even if platform is undefined
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const env = platform.env;

	try {
		const db = createDbClient(env.DB);
		const signingKey = await importSigningKey(env);
		const crdt = new CRDTMergeEngine(db, signingKey);
		const peers = new PeerService(db);
		const nodeId = env.NANDA_NODE_ID ?? 'homeport-node';
		const fedKey = await resolveSecret(
			env.NANDA_FEDERATION_ADMIN_KEY,
			kvFallback(env, SECRET_KEYS.FEDERATION_ADMIN_KEY)
		);
		const ed25519Key = await resolveSecret(
			env.KYM_NANDA_ED25519_PRIVATE_KEY_v1,
			kvFallback(env, SECRET_KEYS.ED25519_PRIVATE_KEY_V1)
		);
		const gossip = new GossipService(
			db,
			crdt,
			peers,
			nodeId,
			fedKey ?? undefined,
			ed25519Key ?? undefined
		);

		const results = await gossip.pushToAllPeers();

		// Also run tombstone GC
		const gcCount = await crdt.gcTombstones();

		const summary = {
			peers_pushed: results.size,
			results: Object.fromEntries(results),
			tombstones_gc: gcCount
		};

		log.info('POST', `Gossip push complete: ${results.size} peers`, summary);

		return json(summary);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Gossip push failed', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
