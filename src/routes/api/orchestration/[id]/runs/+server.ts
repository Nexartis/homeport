/**
 * POST /api/orchestration/[id]/runs — Start a new workflow run
 * GET  /api/orchestration/[id]/runs — List runs for a workflow
 *
 * Phase 6 — Sprint 13: Multi-Agent Orchestration
 *
 * @swagger
 * /api/orchestration/{id}/runs:
 *   get:
 *     summary: List workflow runs
 *     description: Returns all runs for a workflow.
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
 *         description: Array of workflow runs
 *   post:
 *     summary: Start workflow run
 *     description: Start a new execution of a workflow.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Run started
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { startWorkflowRun } from '$lib/services/orchestration';
import { listWorkflowRuns, getWorkflowById } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-runs');

export const GET: RequestHandler = async ({ params, url, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

	try {
		const db = createDbClient(platform.env.DB);
		const workflow = await getWorkflowById(db, params.id);
		if (!workflow) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });

		const runs = await listWorkflowRuns(db, params.id, Math.min(limit, 100));
		return json({ runs });
	} catch (err) {
		log.error('GET', 'Failed to list workflow runs', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	let body: { input?: Record<string, unknown>; trigger_type?: string };
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	try {
		const db = createDbClient(platform.env.DB);

		const workflow = await getWorkflowById(db, params.id);
		if (!workflow) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'POST' });

		const runId = await startWorkflowRun(
			db,
			params.id,
			body.input ?? {},
			body.trigger_type ?? 'manual'
		);

		return json({ status: 'started', run_id: runId }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to start workflow run', { error: message });

		if (message.includes('not found')) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		if (message.includes('not active')) {
			return json({ error: message }, { status: 400 });
		}
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
