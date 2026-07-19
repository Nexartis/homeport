/**
 * @swagger
 * /agents/{id}:
 *   get:
 *     summary: Get agent by ID
 *     description: Returns full registration for a specific agent.
 *     tags:
 *       - Agents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent record
 *       404:
 *         description: Agent not found
 *   put:
 *     summary: Update agent fields
 *     description: Partial update of agent_url, api_url, facts_url, capabilities, tags.
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
 *     responses:
 *       200:
 *         description: Updated agent
 *       404:
 *         description: Agent not found
 *   delete:
 *     summary: Delete an agent
 *     description: Remove agent from registry. Requires federation admin auth.
 *     tags:
 *       - Agents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteAgent, registerAgent, lookupAgent } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';
import { resolveAndSign } from '$lib/crypto/sign-agent';

const log = createLogger(undefined, 'agents-id');

/**
 * PUT /agents/:id — Update an existing agent's fields.
 *
 * Accepts any subset of: agent_url, api_url, facts_url, capabilities, tags.
 * Returns the updated agent record.
 */
export const PUT: RequestHandler = async ({ params, request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let agentId: string;
	try {
		agentId = decodeURIComponent(params.id);
	} catch {
		return json({ error: 'Invalid agent ID encoding' }, { status: 400 });
	}
	const db = createDbClient(platform.env.DB);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Validate body shape — must be a non-null, non-array object
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Body must be a JSON object' }, { status: 400 });
	}
	const fields = body as Record<string, unknown>;

	try {
		// Must exist
		const existing = await lookupAgent(db, agentId);
		if (!existing) {
			return json({ error: 'Agent not found' }, { status: 404 });
		}

		// Merge with existing values — only provided fields overwrite.
		// Re-sign with our Ed25519 key on every update.
		const sig = await resolveAndSign(agentId, platform.env);
		await registerAgent(db, {
			agent_id: agentId,
			agent_url: (fields.agent_url as string) ?? (existing.agent_url as string),
			api_url: (fields.api_url as string) ?? (existing.api_url as string | undefined),
			facts_url: (fields.facts_url as string) ?? (existing.facts_url as string | undefined),
			capabilities:
				(fields.capabilities as string[]) ?? (existing.capabilities as string[] | undefined),
			tags: (fields.tags as string[]) ?? (existing.tags as string[] | undefined),
			source: (existing.source as string) ?? 'local',
			status: (existing.status as string) ?? 'alive',
			...sig
		});

		const updated = await lookupAgent(db, agentId);
		log.info('PUT', `Agent updated: ${agentId}`);

		return json(updated);
	} catch (err) {
		log.error('PUT', `Failed to update agent ${agentId}`, {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}
	const db = createDbClient(platform.env.DB);
	let agentId: string;
	try {
		agentId = decodeURIComponent(params.id);
	} catch {
		return json({ error: 'Invalid agent ID encoding' }, { status: 400 });
	}

	try {
		const deleted = await deleteAgent(db, agentId);
		if (!deleted) return json({ error: 'Agent not found' }, { status: 404 });
		return json({ status: 'deleted' });
	} catch (err) {
		log.error('DELETE', `Failed to delete agent ${agentId}`, {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
