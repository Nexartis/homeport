/**
 * GET /stats — Registry statistics
 *
 * @swagger
 * /stats:
 *   get:
 *     summary: Get registry statistics
 *     description: Returns agent count, registration trends, and capability distribution.
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Registry statistics
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStats } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';

export const GET: RequestHandler = async ({ platform }) => {
	const db = createDbClient(platform!.env.DB);
	const stats = await getStats(db);
	return json(stats);
};
