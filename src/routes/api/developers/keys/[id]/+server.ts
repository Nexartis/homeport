/**
 * Single API Key Management Endpoint
 *
 * DELETE /api/developers/keys/:id — Revoke an API key (requires session auth + ownership)
 *
 * @swagger
 * /api/developers/keys/{id}:
 *   delete:
 *     summary: Revoke an API key
 *     description: Revokes a developer API key. Requires session auth and ownership of the key.
 *     tags:
 *       - Developer Keys
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The API key ID to revoke
 *     responses:
 *       200:
 *         description: Key revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 key:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     key_prefix:
 *                       type: string
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                     revoked_at:
 *                       type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: API key auth not permitted
 *       404:
 *         description: Key not found or not owned by user
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { revokeDevApiKey } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireDeveloperSession } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'developer-keys');

/** DELETE — Revoke an API key */
export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
	const actor = getActor(locals);
	requireDeveloperSession(actor, { log, fn: 'DELETE' });

	const keyId = params.id;
	if (!keyId) {
		return json({ error: 'Key ID is required' }, { status: 400 });
	}

	const env = platform!.env;
	const db = createDbClient(env.DB);

	try {
		const revoked = await revokeDevApiKey(db, keyId, actor.user.id);
		if (!revoked) {
			return json({ error: 'Key not found or not owned by you' }, { status: 404 });
		}

		log.info('DELETE', 'API key revoked', { keyId, ownerId: actor.user.id });
		return json({
			message: 'API key revoked successfully',
			key: {
				id: revoked.id,
				key_prefix: revoked.keyPrefix,
				name: revoked.name,
				status: revoked.status,
				revoked_at: revoked.revokedAt
			}
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('DELETE', 'Failed to revoke API key', { error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
