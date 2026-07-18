/**
 * GET /list — List all registered agents
 *
 * @swagger
 * /list:
 *   get:
 *     summary: List all registered agents
 *     description: Returns all agents in the registry with parsed capabilities and tags.
 *     tags:
 *       - Registry
 *     responses:
 *       200:
 *         description: Array of agent objects
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAgents } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';

export const GET: RequestHandler = async ({ platform }) => {
	const db = createDbClient(platform!.env.DB);
	const result = await listAgents(db);
	return json(result);
};
