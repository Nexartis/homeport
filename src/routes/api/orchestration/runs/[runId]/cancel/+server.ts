/**
 * POST /api/orchestration/runs/:runId/cancel — Cancel a workflow run
 *
 * Sets the run status to 'cancelled' if it is currently 'pending' or 'running'.
 * Already-completed or already-cancelled runs return 409.
 
 * @swagger
 * /api/orchestration/runs/{runId}/cancel:
 *   post:
 *     summary: Cancel workflow run
 *     description: Cancel a pending or running workflow run.
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
 *         description: Run cancelled
 *       409:
 *         description: Run already completed or cancelled
 *       404:
 *         description: Run not found
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import {
	getWorkflowRunById,
	updateWorkflowRun,
	getStepRunsForRun,
	updateWorkflowStepRun,
	getWorkflowById
} from '$lib/db/repositories';
import { emitEvent } from '$lib/services/orchestration';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-cancel-run');

const CANCELLABLE_STATUSES = new Set(['pending', 'running']);

export const POST: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const { runId } = params;

	try {
		const db = createDbClient(platform.env.DB);
		const run = await getWorkflowRunById(db, runId);

		if (!run) {
			return json({ error: 'Run not found' }, { status: 404 });
		}

		const workflow = await getWorkflowById(db, run.workflowId);
		if (!workflow) {
			return json({ error: 'Run not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'POST' });

		if (!CANCELLABLE_STATUSES.has(run.status)) {
			return json(
				{ error: `Run cannot be cancelled (current status: ${run.status})` },
				{ status: 409 }
			);
		}

		const now = Math.floor(Date.now() / 1000);

		// Cancel the run itself
		await updateWorkflowRun(db, runId, {
			status: 'cancelled',
			errorMessage: 'Cancelled by user',
			completedAt: now
		});

		// Skip any pending/running step runs (schema allows: pending | running | completed | failed | skipped)
		const stepRuns = await getStepRunsForRun(db, runId);
		for (const sr of stepRuns) {
			if (CANCELLABLE_STATUSES.has(sr.status)) {
				await updateWorkflowStepRun(db, sr.id, {
					status: 'skipped',
					completedAt: now
				});
			}
		}

		// Emit run_cancelled event so SSE streams detect the terminal state.
		// Wrap separately: cancellation already succeeded in the DB, so an
		// event-emission failure should not turn the response into a 500.
		try {
			await emitEvent(db, {
				workflowId: run.workflowId,
				runId,
				eventType: 'run_cancelled',
				payload: { reason: 'Cancelled by user' }
			});
		} catch (emitErr) {
			log.error('POST', 'Failed to emit run_cancelled event (cancellation still applied)', {
				runId,
				error: emitErr instanceof Error ? emitErr.message : String(emitErr)
			});
		}

		log.info('POST', `Cancelled workflow run ${runId}`, { runId });

		return json({ status: 'cancelled', run_id: runId });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to cancel workflow run', { error: message, runId });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
