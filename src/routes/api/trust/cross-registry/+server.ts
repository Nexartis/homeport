/**
 * POST /api/trust/cross-registry
 *
 * Lane C (M2M) endpoint that triggers cross-registry trust sync:
 *   1. Fetch trust scores from the configured federation peer
 *   2. Compute aggregated cross-registry scores for all agents
 *
 * Authentication: any authenticated M2M caller (developer API key) or an
 * admin session. The aggregated data is global (not per-tenant), so no
 * ownership check is applied.
 *
 * @swagger
 * /api/trust/cross-registry:
 *   post:
 *     summary: Sync cross-registry trust scores (apikey or admin)
 *     tags:
 *       - Trust Scores
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed
 *       401:
 *         description: Unauthenticated
 *       403:
 *         description: Forbidden — apikey or admin required
 *       503:
 *         description: Federation peer not configured
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { syncCrossRegistryTrust } from '$lib/services/federation';
import { getActor, requireApiKeyOrAdmin } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-trust-cross-registry');

export const POST: RequestHandler = async ({ platform, locals }) => {
	const actor = getActor(locals);
	requireApiKeyOrAdmin(actor, { log, fn: 'POST' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const env = platform.env;

	// Require federation peer URL
	const peerUrl = env.NANDA_FEDERATION_PEER_URL;
	if (!peerUrl) {
		return json(
			{ error: 'No federation peer configured (NANDA_FEDERATION_PEER_URL)' },
			{ status: 503 }
		);
	}

	const db = createDbClient(env.DB);

	try {
		const result = await syncCrossRegistryTrust(db, peerUrl, env.ENVIRONMENT, env);

		log.info('POST', 'Cross-registry sync completed', {
			fetchedAgents: result.fetch.agents,
			computedScores: result.compute.computed,
			fetchErrors: result.fetch.errors,
			computeErrors: result.compute.errors,
			durationMs: result.fetch.durationMs
		});

		return json({
			ok: true,
			fetch: {
				peer_url: result.fetch.peerUrl,
				agents_fetched: result.fetch.agents,
				errors: result.fetch.errors,
				duration_ms: result.fetch.durationMs
			},
			compute: {
				scores_computed: result.compute.computed,
				errors: result.compute.errors
			}
		});
	} catch (err) {
		log.error('POST', 'Cross-registry sync failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
