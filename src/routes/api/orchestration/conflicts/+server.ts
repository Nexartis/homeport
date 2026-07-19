/**
 * POST /api/orchestration/conflicts — Raise a conflict for resolution
 * GET  /api/orchestration/conflicts?workflow_id=...&run_id=... — List conflicts
 *
 * Phase 6 — Sprint 15: Conflict Resolution
 
 * @swagger
 * /api/orchestration/conflicts:
 *   get:
 *     summary: List conflicts
 *     description: List conflict events for a workflow run.
 *     tags:
 *       - Orchestration
 *     parameters:
 *       - in: query
 *         name: workflow_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: run_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of conflicts
 *   post:
 *     summary: Raise conflict
 *     description: Raise a conflict for resolution when agents produce conflicting results.
 *     tags:
 *       - Orchestration
 *     responses:
 *       201:
 *         description: Conflict raised
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { safeJsonParse } from '$lib/utils/safe-json';
import {
	raiseConflict,
	getRunConflicts,
	getPendingConflicts,
	type RaiseConflictInput,
	type ConflictStrategy,
	type ConflictType
} from '$lib/services/orchestration';
import { listConflictsByWorkflow, getWorkflowById, getWorkflowRunById } from '$lib/db/repositories';
import { parseJsonBody, requireDb } from '$lib/utils/request-helpers';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-conflicts');

const VALID_STRATEGIES: ConflictStrategy[] = ['highest_score', 'first_wins', 'voting', 'manual'];
const VALID_TYPES: ConflictType[] = ['competing_response', 'timeout_race', 'capability_overlap'];

/**
 * GET — List conflicts for a workflow or run.
 * Query params: workflow_id (required), run_id (optional), pending_only (optional)
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const workflowId = url.searchParams.get('workflow_id');
	const runId = url.searchParams.get('run_id');
	const pendingOnly = url.searchParams.get('pending_only') === 'true';

	if (!workflowId && !runId) {
		return json({ error: 'workflow_id or run_id is required' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);

		// Resolve the parent workflow so we can enforce ownership before
		// exposing any conflict data.
		let parentWorkflowId = workflowId;
		if (!parentWorkflowId && runId) {
			const run = await getWorkflowRunById(db, runId);
			if (!run) return json({ conflicts: [], total: 0 });
			parentWorkflowId = run.workflowId;
		}
		if (parentWorkflowId) {
			const workflow = await getWorkflowById(db, parentWorkflowId);
			if (!workflow) {
				return json({ error: 'Workflow not found' }, { status: 404 });
			}
			requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });
		}

		let conflicts;
		if (runId) {
			conflicts = await getRunConflicts(db, runId);
		} else if (pendingOnly && workflowId) {
			conflicts = await getPendingConflicts(db, workflowId);
		} else {
			conflicts = await listConflictsByWorkflow(db, workflowId!);
		}

		return json({
			conflicts: conflicts.map((c) => ({
				id: c.id,
				workflow_id: c.workflowId,
				run_id: c.runId,
				step_id: c.stepId,
				conflict_type: c.conflictType,
				strategy: c.strategy,
				candidates: safeJsonParse(c.candidatesJson, []),
				winner_agent_id: c.winnerAgentId,
				winner_response: safeJsonParse(c.winnerResponse),
				resolution_score: c.resolutionScore,
				resolved: c.resolved === 1,
				resolved_at: c.resolvedAt,
				created_at: c.createdAt
			})),
			total: conflicts.length
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('GET', 'Failed to list conflicts', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * POST — Raise a new conflict for auto- or manual resolution.
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const [body, parseErr] = await parseJsonBody<{
		workflow_id?: string;
		run_id?: string;
		step_id?: string;
		conflict_type?: string;
		strategy?: string;
		candidates?: Array<{
			agent_id: string;
			response: unknown;
			score: number;
			timestamp: number;
			metadata?: Record<string, unknown>;
		}>;
		metadata?: Record<string, unknown>;
	}>(request);
	if (parseErr) return parseErr;

	if (!body.workflow_id || typeof body.workflow_id !== 'string') {
		return json({ error: 'workflow_id is required' }, { status: 400 });
	}
	if (!body.candidates || !Array.isArray(body.candidates) || body.candidates.length < 2) {
		return json({ error: 'At least 2 candidates are required' }, { status: 400 });
	}

	const conflictType = (body.conflict_type ?? 'competing_response') as ConflictType;
	const strategy = (body.strategy ?? 'highest_score') as ConflictStrategy;

	if (!VALID_TYPES.includes(conflictType)) {
		return json(
			{ error: `Invalid conflict_type. Must be one of: ${VALID_TYPES.join(', ')}` },
			{ status: 400 }
		);
	}
	if (!VALID_STRATEGIES.includes(strategy)) {
		return json(
			{ error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}` },
			{ status: 400 }
		);
	}

	try {
		const db = createDbClient(platform!.env.DB);

		const workflow = await getWorkflowById(db, body.workflow_id);
		if (!workflow) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'POST' });

		const input: RaiseConflictInput = {
			workflowId: body.workflow_id,
			runId: body.run_id,
			stepId: body.step_id,
			conflictType,
			strategy,
			candidates: body.candidates.map((c) => ({
				agentId: c.agent_id,
				response: c.response,
				score: c.score,
				timestamp: c.timestamp,
				metadata: c.metadata
			})),
			metadata: body.metadata
		};

		const outcome = await raiseConflict(db, input);

		return json(
			{
				conflict_id: outcome.conflictId,
				resolved: outcome.resolved,
				winner_agent_id: outcome.winnerAgentId ?? null,
				winner_response: outcome.winnerResponse ?? null,
				resolution_score: outcome.resolutionScore ?? null,
				strategy: outcome.strategy
			},
			{ status: 201 }
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to raise conflict', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
