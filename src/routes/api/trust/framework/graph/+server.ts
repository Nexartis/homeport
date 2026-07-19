/**
 * GET /api/trust/framework/graph
 *
 * Public API endpoint for querying the trust graph.
 * Requires a valid developer API key (nanda_ prefix, Bearer token).
 *
 * Query params:
 *   ?did=DID             — Get all trust edges for a DID (required unless ?from & ?to)
 *   ?from=DID&to=DID     — Compute trust path between two DIDs
 *
 * Response (edges):
 *   { did, incoming, outgoing, totalEdges, fetchedAt }
 *
 * Response (path):
 *   { path, fetchedAt } | { path: null, message: 'No trust path found', fetchedAt }
 *
 * Phase 3 — Agent Gamma
 *
 * @swagger
 * /api/trust/framework/graph:
 *   get:
 *     summary: Query trust graph
 *     description: Query trust graph edges. Get edges for a DID or compute trust path between two DIDs.
 *     tags:
 *       - Trust
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: did
 *         schema:
 *           type: string
 *         description: DID to get trust edges for
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: Source DID for path computation
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: Target DID for path computation
 *     responses:
 *       200:
 *         description: Trust graph edges or path
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getTrustGraph, computeTrustPath } from '$lib/services/trust-framework/trust-graph';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-trust-graph');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const db = createDbClient(platform.env.DB);

	const did = url.searchParams.get('did')?.trim() || null;
	const fromDid = url.searchParams.get('from')?.trim() || null;
	const toDid = url.searchParams.get('to')?.trim() || null;

	try {
		// Path finding mode: ?from=...&to=...
		if (fromDid && toDid) {
			const path = await computeTrustPath(db, fromDid, toDid);
			if (!path) {
				return json({
					path: null,
					message: 'No trust path found',
					fetchedAt: new Date().toISOString()
				});
			}
			return json({ path, fetchedAt: new Date().toISOString() });
		}

		// Edge query mode: ?did=...
		if (did) {
			const graph = await getTrustGraph(db, did);
			return json({
				did,
				incoming: graph.incoming,
				outgoing: graph.outgoing,
				totalEdges: graph.incoming.length + graph.outgoing.length,
				fetchedAt: new Date().toISOString()
			});
		}

		return json(
			{ error: 'Missing required query parameter: did (or from & to for path finding)' },
			{ status: 400 }
		);
	} catch (err) {
		log.error('GET', 'Trust graph query failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
