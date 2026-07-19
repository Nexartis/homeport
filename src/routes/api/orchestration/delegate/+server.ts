/**
 * POST /api/orchestration/delegate — Delegate a task to a sub-agent
 * GET  /api/orchestration/delegate?workflow_id={id} — List delegations for a workflow
 *
 * Phase 6 — Sprint 14: A2A Routing + Sub-agent Delegation
 *
 * @swagger
 * /api/orchestration/delegate:
 *   get:
 *     summary: List delegations
 *     description: List delegation tasks for a workflow.
 *     tags:
 *       - Orchestration
 *   post:
 *     summary: Delegate task
 *     description: Delegate a task to a sub-agent via A2A routing.
 *     tags:
 *       - Orchestration
 *     responses:
 *       201:
 *         description: Task delegated
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import {
	delegateTask,
	getWorkflowDelegations,
	type DelegateInput
} from '$lib/services/orchestration';
import { getWorkflowById } from '$lib/db/repositories';
import { parseJsonBody, requireDb } from '$lib/utils/request-helpers';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireResourceOwner } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-delegate');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const workflowId = url.searchParams.get('workflow_id');
	if (!workflowId) {
		return json({ error: 'workflow_id query parameter is required' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);
		const workflow = await getWorkflowById(db, workflowId);
		if (!workflow) {
			return json({ error: 'Workflow not found' }, { status: 404 });
		}
		requireResourceOwner(actor, workflow.ownerId, { log, fn: 'GET' });

		const delegations = await getWorkflowDelegations(db, workflowId);
		return json({ delegations });
	} catch (err) {
		log.error('GET', 'Failed to list delegations', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'POST' });

	const [body, parseErr] = await parseJsonBody<{
		delegator_id?: string;
		action?: string;
		input?: Record<string, unknown>;
		parent_workflow_id?: string;
		parent_step_id?: string;
		required_capabilities?: string[];
		target_agent_id?: string;
		timeout_ms?: number;
		max_retries?: number;
	}>(request);
	if (parseErr) return parseErr;

	if (!body.delegator_id || typeof body.delegator_id !== 'string') {
		return json({ error: 'delegator_id is required' }, { status: 400 });
	}
	if (!body.action || typeof body.action !== 'string') {
		return json({ error: 'action is required' }, { status: 400 });
	}
	if (body.timeout_ms !== undefined && !Number.isFinite(body.timeout_ms)) {
		return json({ error: 'timeout_ms must be a valid number' }, { status: 400 });
	}
	if (body.max_retries !== undefined && !Number.isFinite(body.max_retries)) {
		return json({ error: 'max_retries must be a valid number' }, { status: 400 });
	}

	try {
		const db = createDbClient(platform!.env.DB);

		// If this delegation is scoped to a parent workflow, verify the caller
		// owns it. Ad-hoc delegations (no parent workflow) only require auth.
		if (body.parent_workflow_id) {
			const workflow = await getWorkflowById(db, body.parent_workflow_id);
			if (!workflow) {
				return json({ error: 'Parent workflow not found' }, { status: 404 });
			}
			requireResourceOwner(actor, workflow.ownerId, { log, fn: 'POST' });
		}

		const delegateInput: DelegateInput = {
			delegatorId: body.delegator_id,
			action: body.action,
			input: body.input ?? {},
			parentWorkflowId: body.parent_workflow_id,
			parentStepId: body.parent_step_id,
			requiredCapabilities: body.required_capabilities,
			targetAgentId: body.target_agent_id,
			timeoutMs: body.timeout_ms,
			maxRetries: body.max_retries
		};

		// Delegate without executor — creates pending task for external pickup
		const result = await delegateTask(db, delegateInput);
		const statusCode = result.status === 'completed' ? 201 : 200;
		return json(result, { status: statusCode });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to delegate task', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
