/**
 * @swagger
 * /agents/{id}/status:
 *   put:
 *     summary: Update agent status
 *     description: Update an agent's operational status and optionally its capabilities.
 *     tags:
 *       - Agents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, deprecated, tombstoned]
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Agent not found
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateAgentStatus } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';

export const PUT: RequestHandler = async ({ params, request, platform }) => {
	// Mutating an agent's status/capabilities is an admin-federation
	// operation — mirror sibling routes (`src/routes/agents/[id]/+server.ts`,
	// `.../refresh/+server.ts`) which all require the federation admin key.
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	try {
		const db = createDbClient(platform!.env.DB);
		const body = (await request.json()) as Record<string, unknown>;
		const updated = await updateAgentStatus(
			db,
			decodeURIComponent(params.id),
			body.status as string,
			body.capabilities as string[] | undefined
		);
		if (!updated) return json({ error: 'Agent not found' }, { status: 404 });
		return json({ status: 'updated' });
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
};
