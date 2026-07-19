/**
 * Delegation Service — Manages sub-agent task delegation lifecycle.
 * Phase 6 — Sprint 14: A2A Routing + Sub-agent Delegation
 *
 * Responsibilities:
 *  1. Create delegation tasks (with routing)
 *  2. Execute delegated tasks via A2A calls
 *  3. Handle retries, timeouts, and status tracking
 *  4. Report results back to parent workflow
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { DelegationTaskRecord } from '$lib/db/schema';
import {
	createDelegationTask,
	getDelegationTaskById,
	updateDelegationTask,
	listDelegationsByWorkflow
} from '$lib/db/repositories';
import { routeToAgent, type RoutingRequest } from './routing';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'delegation');

export interface DelegateInput {
	delegatorId: string;
	action: string;
	input: Record<string, unknown>;
	parentWorkflowId?: string;
	parentStepId?: string;
	requiredCapabilities?: string[];
	targetAgentId?: string; // explicit target — skip routing
	timeoutMs?: number;
	maxRetries?: number;
}

export interface DelegationResult {
	taskId: string;
	status: 'completed' | 'failed' | 'timeout';
	delegateId: string;
	output?: unknown;
	error?: string;
	durationMs: number;
}

/**
 * Delegate a task to the best available agent (or explicit target).
 * This creates the delegation record, routes if needed, then executes.
 */
export async function delegateTask(
	db: DbClient,
	input: DelegateInput,
	executor?: DelegationExecutor
): Promise<DelegationResult> {
	const startMs = Date.now();
	let delegateId = input.targetAgentId ?? '';

	// 1. Route to best agent if no explicit target
	if (!delegateId) {
		const routingReq: RoutingRequest = {
			sourceAgentId: input.delegatorId,
			action: input.action,
			requiredCapabilities: input.requiredCapabilities,
			excludeAgents: [input.delegatorId]
		};
		const routeResult = await routeToAgent(db, routingReq);
		if (!routeResult.selectedAgent) {
			return {
				taskId: nanoid(),
				status: 'failed',
				delegateId: '',
				error: `No agent found for action: ${input.action}`,
				durationMs: Date.now() - startMs
			};
		}
		delegateId = routeResult.selectedAgent.agentId;
	}

	// 2. Create delegation task record
	const taskId = nanoid();
	const now = Math.floor(Date.now() / 1000);

	await createDelegationTask(db, {
		id: taskId,
		parentWorkflowId: input.parentWorkflowId ?? null,
		parentStepId: input.parentStepId ?? null,
		delegatorId: input.delegatorId,
		delegateId,
		taskType: 'a2a_call',
		action: input.action,
		inputJson: JSON.stringify(input.input),
		status: 'running',
		timeoutMs: input.timeoutMs ?? 30000,
		maxRetries: input.maxRetries ?? 3,
		startedAt: now,
		delegationToken: nanoid()
	});

	// 3. Execute via provided executor or return pending
	if (!executor) {
		// No executor — mark as pending for external pickup
		await updateDelegationTask(db, taskId, { status: 'pending' });
		return {
			taskId,
			status: 'completed',
			delegateId,
			output: { pending: true, message: 'No executor provided — task created for external pickup' },
			durationMs: Date.now() - startMs
		};
	}

	// 4. Execute with retry logic
	let lastError = '';
	const maxRetries = input.maxRetries ?? 3;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const result = await executor.execute(delegateId, input.action, input.input);
			const completedAt = Math.floor(Date.now() / 1000);

			await updateDelegationTask(db, taskId, {
				status: 'completed',
				outputJson: JSON.stringify(result),
				completedAt,
				retryCount: attempt
			});

			log.info('delegateTask', `Delegation ${taskId} completed`, { delegateId, attempt });
			return {
				taskId,
				status: 'completed',
				delegateId,
				output: result,
				durationMs: Date.now() - startMs
			};
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			log.warn('delegateTask', `Delegation ${taskId} attempt ${attempt} failed: ${lastError}`);

			if (attempt < maxRetries) {
				// Exponential backoff: 500ms, 1s, 2s...
				await sleep(500 * Math.pow(2, attempt));
			}
		}
	}

	// All retries exhausted
	const completedAt = Math.floor(Date.now() / 1000);
	await updateDelegationTask(db, taskId, {
		status: 'failed',
		errorMessage: lastError,
		completedAt,
		retryCount: maxRetries
	});

	log.error(
		'delegateTask',
		`Delegation ${taskId} failed after ${maxRetries + 1} attempts: ${lastError}`
	);
	return {
		taskId,
		status: 'failed',
		delegateId,
		error: lastError,
		durationMs: Date.now() - startMs
	};
}

/**
 * Get delegation status and results for a workflow.
 */
export async function getWorkflowDelegations(
	db: DbClient,
	workflowId: string
): Promise<DelegationTaskRecord[]> {
	return listDelegationsByWorkflow(db, workflowId);
}

/**
 * Cancel a delegation task.
 */
export async function cancelDelegation(
	db: DbClient,
	taskId: string
): Promise<DelegationTaskRecord | null> {
	const task = await getDelegationTaskById(db, taskId);
	if (!task) return null;
	if (task.status === 'completed' || task.status === 'failed') return task;

	return updateDelegationTask(db, taskId, {
		status: 'failed',
		errorMessage: 'Cancelled by user',
		completedAt: Math.floor(Date.now() / 1000)
	});
}

/**
 * Delegation executor interface — pluggable execution strategy.
 * Implement this to provide actual A2A call execution.
 */
export interface DelegationExecutor {
	execute(agentId: string, action: string, input: Record<string, unknown>): Promise<unknown>;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
