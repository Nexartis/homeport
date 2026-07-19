/**
 * GET    /api/orchestration/[id] — Get workflow details with steps
 * PATCH  /api/orchestration/[id] — Update workflow (name, description, status, DAG)
 * DELETE /api/orchestration/[id] — Delete a workflow
 *
 * Phase 6 — Sprint 13: Multi-Agent Orchestration
 *
 * @swagger
 * /api/orchestration/{id}:
 *   get:
 *     summary: Get workflow details
 *     description: Returns workflow with steps and DAG definition.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow with steps
 *       404:
 *         description: Workflow not found
 *   patch:
 *     summary: Update workflow
 *     description: Update workflow name, description, status, or DAG.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated workflow
 *   delete:
 *     summary: Delete workflow
 *     description: Permanently delete a workflow and its steps.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow deleted
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import {
	getWorkflowById,
	getWorkflowSteps,
	updateWorkflow,
	deleteWorkflowCascade
} from '$lib/db/repositories';
import { updateWorkflowDag } from '$lib/services/orchestration';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-id');

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	try {
		const db = createDbClient(platform.env.DB);
		const workflow = await getWorkflowById(db, params.id);
		if (!workflow) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });

		const steps = await getWorkflowSteps(db, params.id);
		return json({
			workflow: {
				...workflow,
				dag: JSON.parse(workflow.dagJson),
				metadata: JSON.parse(workflow.metadata ?? '{}')
			},
			steps: steps.map((s) => ({
				...s,
				config: JSON.parse(s.configJson ?? '{}'),
				dependsOn: JSON.parse(s.dependsOn ?? '[]'),
				condition: s.conditionJson ? JSON.parse(s.conditionJson) : null
			}))
		});
	} catch (err) {
		log.error('GET', 'Failed to get workflow', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'PATCH' });

	let body: {
		name?: string;
		description?: string;
		status?: string;
		dag?: { nodes: unknown[]; edges: unknown[] };
		metadata?: Record<string, unknown>;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validStatuses = ['draft', 'active', 'archived'];
	if (body.status && !validStatuses.includes(body.status)) {
		return json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);

		const existing = await getWorkflowById(db, params.id);
		if (!existing) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, existing.ownerId, { log, fn: 'PATCH' });

		// If DAG is being updated, validate and replace steps
		if (body.dag) {
			const result = await updateWorkflowDag(
				db,
				params.id,
				body.dag as import('$lib/services/orchestration').DagDefinition
			);
			if (!result) {
				return json({ error: 'Workflow not found' }, { status: 404 });
			}
		}

		// Update other fields
		const updates: Record<string, unknown> = {};
		if (body.name) updates.name = body.name;
		if (body.description !== undefined) updates.description = body.description;
		if (body.status) updates.status = body.status;
		if (body.metadata) updates.metadata = JSON.stringify(body.metadata);

		if (Object.keys(updates).length > 0) {
			const result = await updateWorkflow(
				db,
				params.id,
				updates as Parameters<typeof updateWorkflow>[2]
			);
			if (!result) {
				return json({ error: 'Workflow not found' }, { status: 404 });
			}
		}

		const updated = await getWorkflowById(db, params.id);
		return json({ ok: true, workflow: updated });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('PATCH', 'Failed to update workflow', { error: message });

		if (message.includes('Invalid DAG')) {
			return json({ error: message }, { status: 400 });
		}
		if (message.includes('not found')) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'DELETE' });

	try {
		const db = createDbClient(platform.env.DB);
		const workflow = await getWorkflowById(db, params.id);
		if (!workflow) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'DELETE' });

		await deleteWorkflowCascade(db, params.id);
		return json({ ok: true, deleted: params.id });
	} catch (err) {
		log.error('DELETE', 'Failed to delete workflow', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
