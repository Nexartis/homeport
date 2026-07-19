/**
 * GET /api/orchestration/runs/:runId/events — SSE stream of workflow run events
 * POST /api/orchestration/runs/:runId/events — Get event history (non-streaming)
 *
 * Phase 6 — Sprint 15: Real-time Collaboration
 
 * @swagger
 * /api/orchestration/runs/{runId}/events:
 *   get:
 *     summary: SSE event stream
 *     description: Server-Sent Events stream of workflow run progress. For real-time monitoring.
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
 *         description: SSE event stream
 *   post:
 *     summary: Get event history
 *     description: Non-streaming retrieval of run event history.
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
 *         description: Event history array
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { createEventStream, getRunEventHistory } from '$lib/services/orchestration';
import { getWorkflowRunById, getWorkflowById } from '$lib/db/repositories';
import { safeJsonParse } from '$lib/utils/safe-json';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-events');

/**
 * GET — SSE stream. Client connects with EventSource / fetch and receives
 * a text/event-stream response with real-time workflow step events.
 */
export const GET: RequestHandler = async ({ params, url, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const { runId } = params;
	if (!runId) {
		return json({ error: 'runId is required' }, { status: 400 });
	}

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
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });

		const pollInterval = parseInt(url.searchParams.get('poll_interval_ms') ?? '1000', 10);
		const maxDuration = parseInt(url.searchParams.get('max_duration_ms') ?? '300000', 10);

		const stream = createEventStream(db, runId, {
			pollIntervalMs: Math.max(500, Math.min(pollInterval, 10000)),
			maxDurationMs: Math.max(5000, Math.min(maxDuration, 600000))
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no'
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('GET', 'Failed to create event stream', { error: message, runId });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * POST — Returns historical event log for a run (non-streaming).
 */
export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const { runId } = params;
	if (!runId) {
		return json({ error: 'runId is required' }, { status: 400 });
	}

	let body: { limit?: number } = {};
	try {
		body = await request.json();
	} catch {
		// default limit
	}

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

		const limit = Math.max(1, Math.min(body.limit ?? 100, 500));
		const events = await getRunEventHistory(db, runId, limit);

		return json({
			run_id: runId,
			events: events.map((e) => ({
				id: e.id,
				type: e.eventType,
				step_id: e.stepId,
				timestamp: e.emittedAt,
				data: safeJsonParse(e.payloadJson, {}),
				consumed: e.consumed === 1
			})),
			total: events.length
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to get event history', { error: message, runId });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
