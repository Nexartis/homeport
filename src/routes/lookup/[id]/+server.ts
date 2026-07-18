/**
 * GET /lookup/:id — Look up a single agent by ID
 *
 * @swagger
 * /lookup/{id}:
 *   get:
 *     summary: Look up agent by ID
 *     description: Returns full registration details for a specific agent.
 *     tags:
 *       - Registry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *       404:
 *         description: Agent not found
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lookupAgent } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = createDbClient(platform!.env.DB);
	const agent = await lookupAgent(db, decodeURIComponent(params.id));
	if (!agent) return json({ error: 'Agent not found' }, { status: 404 });
	return json(agent);
};
