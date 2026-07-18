/**
 * @swagger
 * /credentials/status/{id}:
 *   get:
 *     summary: VC revocation status list
 *     description: Returns StatusList2021 credential for VC revocation checking. Cached for 5 minutes.
 *     tags:
 *       - Trust
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Status list ID
 *     responses:
 *       200:
 *         description: StatusList2021Credential
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRevocationList } from '$lib/services/certifier/revocation';
import { createDbClient } from '$lib/db/client';

export const GET: RequestHandler = async ({ platform }) => {
	const env = platform!.env;
	const db = createDbClient(env.DB);
	const list = await getRevocationList(db, env.NANDA_REGISTRY_URL);
	return json(list, {
		status: 200,
		headers: { 'Cache-Control': 'public, max-age=300' }
	});
};
