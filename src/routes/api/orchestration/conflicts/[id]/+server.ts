/**
 * GET    /api/orchestration/conflicts/:id — Get conflict details
 * PATCH  /api/orchestration/conflicts/:id — Manually resolve a conflict
 *
 * Phase 6 — Sprint 15: Conflict Resolution
 
 * @swagger
 * /api/orchestration/conflicts/{id}:
 *   get:
 *     summary: Get conflict details
 *     description: Returns conflict details and resolution status.
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
 *         description: Conflict details
 *       404:
 *         description: Conflict not found
 *   patch:
 *     summary: Resolve conflict manually
 *     description: Submit a manual resolution for a conflict.
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
 *         description: Conflict resolved
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { safeJsonParse } from '$lib/utils/safe-json';
import { manuallyResolveConflict } from '$lib/services/orchestration';
import { getConflictResolutionById, getWorkflowById } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-conflict-detail');

/**
 * GET — Get a single conflict by ID.
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const { id } = params;
	if (!id) {
		return json({ error: 'id is required' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const conflict = await getConflictResolutionById(db, id);

		if (!conflict) {
			return json({ error: 'Conflict not found' }, { status: 404 });
		}

		const workflow = await getWorkflowById(db, conflict.workflowId);
		if (!workflow) {
			return json({ error: 'Conflict not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });

		return json({
			id: conflict.id,
			workflow_id: conflict.workflowId,
			run_id: conflict.runId,
			step_id: conflict.stepId,
			conflict_type: conflict.conflictType,
			strategy: conflict.strategy,
			candidates: safeJsonParse(conflict.candidatesJson, []),
			winner_agent_id: conflict.winnerAgentId,
			winner_response: safeJsonParse(conflict.winnerResponse),
			resolution_score: conflict.resolutionScore,
			resolved: conflict.resolved === 1,
			resolved_at: conflict.resolvedAt,
			metadata: safeJsonParse(conflict.metadataJson, {}),
			created_at: conflict.createdAt
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('GET', 'Failed to get conflict', { error: message, id });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * PATCH — Manually resolve a conflict (for strategy='manual' or override).
 */
export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'PATCH' });

	const { id } = params;
	if (!id) {
		return json({ error: 'id is required' }, { status: 400 });
	}

	let body: {
		winner_agent_id?: string;
		winner_response?: unknown;
		score?: number;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body.winner_agent_id || typeof body.winner_agent_id !== 'string') {
		return json({ error: 'winner_agent_id is required' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform.env.DB);

		const existing = await getConflictResolutionById(db, id);
		if (!existing) {
			return json({ error: 'Conflict not found' }, { status: 404 });
		}
		const workflow = await getWorkflowById(db, existing.workflowId);
		if (!workflow) {
			return json({ error: 'Conflict not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'PATCH' });

		const resolved = await manuallyResolveConflict(
			db,
			id,
			body.winner_agent_id,
			body.winner_response ?? null,
			body.score
		);

		if (!resolved) {
			return json({ error: 'Conflict not found' }, { status: 404 });
		}

		return json({
			id: resolved.id,
			resolved: resolved.resolved === 1,
			winner_agent_id: resolved.winnerAgentId,
			resolution_score: resolved.resolutionScore,
			resolved_at: resolved.resolvedAt
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('PATCH', 'Failed to resolve conflict', { error: message, id });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
