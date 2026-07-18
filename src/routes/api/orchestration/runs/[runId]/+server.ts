/**
 * GET /api/orchestration/runs/[runId] — Get workflow run details with step results
 *
 * Phase 6 — Sprint 13: Multi-Agent Orchestration
 
 * @swagger
 * /api/orchestration/runs/{runId}:
 *   get:
 *     summary: Get workflow run details
 *     description: Returns workflow run with step results and status.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Run details with step results
 *       404:
 *         description: Run not found
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getWorkflowRunById, getStepRunsForRun, getWorkflowById } from '$lib/db/repositories';
import { safeJsonParse } from '$lib/utils/safe-json';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-run-detail');

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	try {
		const db = createDbClient(platform.env.DB);
		const run = await getWorkflowRunById(db, params.runId);
		if (!run) {
			return json({ error: 'Run not found' }, { status: 404 });
		}

		const workflow = await getWorkflowById(db, run.workflowId);
		if (!workflow) {
			return json({ error: 'Run not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });

		const stepRuns = await getStepRunsForRun(db, params.runId);

		return json({
			run: {
				...run,
				input: safeJsonParse(run.inputJson) ?? {},
				output: safeJsonParse(run.outputJson)
			},
			stepRuns: stepRuns.map((sr) => ({
				...sr,
				input: safeJsonParse(sr.inputJson),
				output: safeJsonParse(sr.outputJson)
			}))
		});
	} catch (err) {
		log.error('GET', 'Failed to get run details', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
