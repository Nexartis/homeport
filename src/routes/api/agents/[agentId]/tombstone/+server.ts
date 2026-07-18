/**
 * POST /api/agents/:agentId/tombstone
 *
 * Permanently mark an agent as dead (tombstoned).
 * Auth: X-Cron-Auth header (admin-only).
 *
 * Response: { agent_id, tombstoned: true }
 
 * @swagger
 * /api/agents/{agentId}/tombstone:
 *   post:
 *     summary: Tombstone agent
 *     description: Permanently mark an agent as dead. Irreversible.
 *     tags:
 *       - Lifecycle
 *     security:
 *       - CronAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent tombstoned
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { tombstoneAgent } from '$lib/services/deprecation/service';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';

const log = createLogger(undefined, 'api-tombstone');

export const POST: RequestHandler = async ({ request, platform, params }) => {
	const env = platform?.env;

	// Auth
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const agentId = params.agentId;
	if (!agentId) {
		return json({ error: 'Missing agentId' }, { status: 400 });
	}

	try {
		const db = createDbClient(env.DB);
		const result = await tombstoneAgent(db, agentId);

		if (!result.success) {
			return json({ error: result.error }, { status: 400 });
		}

		return json({ agent_id: agentId, tombstoned: true });
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('POST', `Tombstone failed for agent=${agentId}`, { error: errMsg });
		return json({ error: 'Tombstone failed' }, { status: 500 });
	}
};
