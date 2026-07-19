/**
 * POST /api/orchestration — Create a new workflow
 * GET  /api/orchestration?ownerId={id}&status={status} — List workflows
 *
 * Phase 6 — Sprint 13: Multi-Agent Orchestration
 *
 * @swagger
 * /api/orchestration:
 *   get:
 *     summary: List workflows
 *     description: List workflows filtered by owner ID or status.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: query
 *         name: ownerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, paused, archived]
 *     responses:
 *       200:
 *         description: Array of workflows
 *   post:
 *     summary: Create a workflow
 *     description: Create a new multi-agent workflow with DAG-ordered steps.
 *     tags:
 *       - Orchestration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ownerId
 *               - dag
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               ownerId:
 *                 type: string
 *               dag:
 *                 type: object
 *               templateId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Workflow created
 *       400:
 *         description: Invalid DAG or missing fields
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { createWorkflowWithSteps, type CreateWorkflowInput } from '$lib/services/orchestration';
import { listWorkflowsByOwner, listWorkflowsByStatus } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { isAdmin } from '$lib/server/roles';

const log = createLogger(undefined, 'api-orchestration');

function callerOwnerId(actor: Exclude<ReturnType<typeof getActor>, { kind: 'anonymous' }>): string {
	return actor.kind === 'apikey' ? actor.ownerId : actor.user.id;
}

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const status = url.searchParams.get('status');

	try {
		const db = createDbClient(platform.env.DB);
		const adminBypass = actor.kind === 'session' && isAdmin(actor.user);

		if (status) {
			const workflows = await listWorkflowsByStatus(db, status);
			const filtered = adminBypass
				? workflows
				: workflows.filter((w) => w.ownerId === callerOwnerId(actor));
			return json({ workflows: filtered });
		}

		const ownerId = adminBypass
			? (url.searchParams.get('ownerId') ?? callerOwnerId(actor))
			: callerOwnerId(actor);
		const workflows = await listWorkflowsByOwner(db, ownerId);
		return json({ workflows });
	} catch (err) {
		log.error('GET', 'Failed to list workflows', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	let body: {
		name?: string;
		description?: string;
		owner_id?: string;
		dag?: { nodes: unknown[]; edges: unknown[] };
		template_id?: string;
		metadata?: Record<string, unknown>;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.name || typeof body.name !== 'string') {
		return json({ error: 'name is required and must be a string' }, { status: 400 });
	}
	if (!body.dag || !Array.isArray(body.dag.nodes) || !Array.isArray(body.dag.edges)) {
		return json({ error: 'dag is required with nodes and edges arrays' }, { status: 400 });
	}

	// Owner is derived from the actor; any `owner_id` in the body is ignored
	// to prevent cross-tenant spoofing.
	const ownerId = callerOwnerId(actor);

	try {
		const db = createDbClient(platform.env.DB);

		const input: CreateWorkflowInput = {
			name: body.name,
			description: body.description,
			ownerId,
			dag: body.dag as CreateWorkflowInput['dag'],
			templateId: body.template_id,
			metadata: body.metadata
		};

		const workflow = await createWorkflowWithSteps(db, input);
		return json({ status: 'created', workflow }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to create workflow', { error: message });

		if (message.includes('Invalid DAG')) {
			return json({ error: message }, { status: 400 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
