/**
 * @swagger
 * /federation/agents:
 *   get:
 *     summary: List federated agents
 *     description: Returns all agents imported from peer registries via federation sync.
 *     tags:
 *       - Federation
 *     responses:
 *       200:
 *         description: Array of federated agents with source peer
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFederatedAgents } from '$lib/services/federation';
import { createDbClient } from '$lib/db/client';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';

export const GET: RequestHandler = async ({ request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	const db = createDbClient(platform!.env.DB);
	const agents = await getFederatedAgents(db);
	return json({ count: agents.length, agents });
};
