/**
 * Workflow Engine — Executes multi-agent workflow DAGs.
 * Phase 6 — Sprint 13
 *
 * Responsibilities:
 *  1. Create and manage workflow definitions
 *  2. Execute workflow runs (topological order)
 *  3. Handle step retries and timeouts
 *  4. Track execution state per step
 *
 * Architecture:
 *  - Stateless execution: all state persisted in D1
 *  - Step execution is sequential within dependency chains
 *  - Parallel branches execute concurrently via Promise.all
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { WorkflowRecord, WorkflowStepRecord } from '$lib/db/schema';
import {
	createWorkflow as repoCreateWorkflow,
	getWorkflowById,
	updateWorkflow,
	createWorkflowSteps,
	getWorkflowSteps,
	deleteWorkflowSteps,
	createWorkflowRun as repoCreateRun,
	getWorkflowRunById,
	updateWorkflowRun,
	createWorkflowStepRun,
	getStepRunsForRun,
	updateWorkflowStepRun
} from '$lib/db/repositories';
import { validateDag, parseDagJson, getDependencies, type DagDefinition } from './dag';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'workflow-engine');

export interface CreateWorkflowInput {
	name: string;
	description?: string;
	ownerId: string;
	dag: DagDefinition;
	templateId?: string;
	metadata?: Record<string, unknown>;
}

export interface StepDefinition {
	id: string;
	stepType: string;
	agentId?: string;
	action?: string;
	config?: Record<string, unknown>;
	positionX?: number;
	positionY?: number;
	dependsOn?: string[];
	timeoutMs?: number;
	retryCount?: number;
	retryDelayMs?: number;
	condition?: Record<string, unknown>;
}

export interface WorkflowRunResult {
	runId: string;
	status: string;
	output?: Record<string, unknown>;
	stepResults: Array<{
		stepId: string;
		status: string;
		output?: string | null;
		error?: string | null;
		durationMs?: number | null;
	}>;
}

/**
 * Create a new workflow with DAG validation.
 */
export async function createWorkflowWithSteps(
	db: DbClient,
	input: CreateWorkflowInput
): Promise<WorkflowRecord> {
	// Validate DAG
	const validation = validateDag(input.dag);
	if (!validation.valid) {
		throw new Error(`Invalid DAG: ${validation.errors.join('; ')}`);
	}

	const workflowId = nanoid();

	// Create workflow record
	const workflow = await repoCreateWorkflow(db, {
		id: workflowId,
		name: input.name,
		description: input.description ?? null,
		ownerId: input.ownerId,
		dagJson: JSON.stringify(input.dag),
		status: 'draft',
		templateId: input.templateId ?? null,
		metadata: input.metadata ? JSON.stringify(input.metadata) : '{}'
	});

	// Create step records from DAG nodes
	// Use composite key (workflowId:nodeId) to prevent PK conflicts across workflows
	const steps = input.dag.nodes.map((node) => ({
		id: `${workflowId}:${node.id}`,
		workflowId,
		stepType: (node.data?.stepType as string) ?? 'agent_call',
		agentId: (node.data?.agentId as string) ?? null,
		action: (node.data?.action as string) ?? null,
		configJson: node.data?.config ? JSON.stringify(node.data.config) : '{}',
		positionX: (node.data?.positionX as number) ?? 0,
		positionY: (node.data?.positionY as number) ?? 0,
		dependsOn: JSON.stringify(getDependencies(input.dag, node.id)),
		timeoutMs: (node.data?.timeoutMs as number) ?? 30000,
		retryCount: (node.data?.retryCount as number) ?? 0,
		retryDelayMs: (node.data?.retryDelayMs as number) ?? 1000,
		conditionJson: node.data?.condition ? JSON.stringify(node.data.condition) : null
	}));

	if (steps.length > 0) {
		await createWorkflowSteps(db, steps);
	}

	log.info('createWorkflowWithSteps', `Workflow created: ${workflowId} with ${steps.length} steps`);
	return workflow;
}

/**
 * Update a workflow's DAG (re-validates and replaces steps).
 */
export async function updateWorkflowDag(
	db: DbClient,
	workflowId: string,
	dag: DagDefinition
): Promise<WorkflowRecord | null> {
	const validation = validateDag(dag);
	if (!validation.valid) {
		throw new Error(`Invalid DAG: ${validation.errors.join('; ')}`);
	}

	// Delete old steps and insert new ones
	await deleteWorkflowSteps(db, workflowId);

	const steps = dag.nodes.map((node) => ({
		id: `${workflowId}:${node.id}`,
		workflowId,
		stepType: (node.data?.stepType as string) ?? 'agent_call',
		agentId: (node.data?.agentId as string) ?? null,
		action: (node.data?.action as string) ?? null,
		configJson: node.data?.config ? JSON.stringify(node.data.config) : '{}',
		positionX: (node.data?.positionX as number) ?? 0,
		positionY: (node.data?.positionY as number) ?? 0,
		dependsOn: JSON.stringify(getDependencies(dag, node.id)),
		timeoutMs: (node.data?.timeoutMs as number) ?? 30000,
		retryCount: (node.data?.retryCount as number) ?? 0,
		retryDelayMs: (node.data?.retryDelayMs as number) ?? 1000,
		conditionJson: node.data?.condition ? JSON.stringify(node.data.condition) : null
	}));

	if (steps.length > 0) {
		await createWorkflowSteps(db, steps);
	}

	return updateWorkflow(db, workflowId, { dagJson: JSON.stringify(dag) });
}

/**
 * Start a workflow run — creates run record and step run records.
 * Does NOT execute steps (that's done by executeWorkflowRun).
 */
export async function startWorkflowRun(
	db: DbClient,
	workflowId: string,
	input: Record<string, unknown> = {},
	triggerType: string = 'manual'
): Promise<string> {
	const workflow = await getWorkflowById(db, workflowId);
	if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
	if (workflow.status !== 'active')
		throw new Error(`Workflow ${workflowId} is not active (status: ${workflow.status})`);

	const runId = nanoid();
	const now = Math.floor(Date.now() / 1000);

	await repoCreateRun(db, {
		id: runId,
		workflowId,
		status: 'pending',
		triggerType,
		inputJson: JSON.stringify(input),
		startedAt: now
	});

	// Create step run records for each step
	const steps = await getWorkflowSteps(db, workflowId);
	for (const step of steps) {
		await createWorkflowStepRun(db, {
			id: nanoid(),
			runId,
			stepId: step.id,
			status: 'pending'
		});
	}

	log.info('startWorkflowRun', `Workflow run started: ${runId} for workflow ${workflowId}`);
	return runId;
}

/**
 * Execute a workflow run — processes steps in topological order.
 * Each step is executed via a pluggable step executor.
 */
export async function executeWorkflowRun(
	db: DbClient,
	runId: string,
	stepExecutor: StepExecutor
): Promise<WorkflowRunResult> {
	const run = await getWorkflowRunById(db, runId);
	if (!run) throw new Error(`Run ${runId} not found`);

	const workflow = await getWorkflowById(db, run.workflowId);
	if (!workflow) throw new Error(`Workflow ${run.workflowId} not found`);

	const dag = parseDagJson(workflow.dagJson);
	if (!dag) throw new Error('Invalid DAG JSON in workflow');

	const validation = validateDag(dag);
	if (!validation.valid) throw new Error(`DAG validation failed: ${validation.errors.join('; ')}`);

	// Guard: if the run was cancelled while still pending, do not resurrect it
	if (run.status === 'cancelled') {
		log.info('executeWorkflowRun', `Run ${runId} already cancelled — skipping execution`);
		return { runId, status: 'cancelled', stepResults: [] };
	}

	// Mark run as running
	await updateWorkflowRun(db, runId, { status: 'running' });

	const steps = await getWorkflowSteps(db, run.workflowId);
	const stepRuns = await getStepRunsForRun(db, runId);
	// Step IDs in DB use composite keys (workflowId:nodeId);
	// map from raw DAG nodeId → DB record for execution order lookup
	const stepMap = new Map(steps.map((s) => [s.id, s]));
	const stepRunMap = new Map(stepRuns.map((sr) => [sr.stepId, sr]));
	const completedOutputs = new Map<string, string>();

	let failed = false;
	let failError = '';

	// Execute in topological order — executionOrder contains raw DAG node IDs,
	// but DB step IDs use composite keys (workflowId:nodeId)
	let cancelled = false;

	for (const nodeId of validation.executionOrder) {
		if (failed) break;

		// Re-check run status before each step to respect external cancellation.
		// Without this, the cancel route can set status='cancelled' but the engine
		// would overwrite it with 'completed'/'failed' at finalization.
		const currentRun = await getWorkflowRunById(db, runId);
		if (currentRun?.status === 'cancelled') {
			cancelled = true;
			log.info('executeWorkflowRun', `Run ${runId} was cancelled externally — aborting`);
			break;
		}

		const compositeStepId = `${run.workflowId}:${nodeId}`;
		const step = stepMap.get(compositeStepId);
		const stepRun = stepRunMap.get(compositeStepId);
		if (!step || !stepRun) continue;

		const now = Math.floor(Date.now() / 1000);
		await updateWorkflowStepRun(db, stepRun.id, { status: 'running', startedAt: now });

		try {
			const startMs = Date.now();
			const result = await stepExecutor.execute(step, run.inputJson ?? '{}', completedOutputs);
			const durationMs = Date.now() - startMs;
			const completedAt = Math.floor(Date.now() / 1000);

			const outputStr = typeof result === 'string' ? result : JSON.stringify(result);
			completedOutputs.set(nodeId, outputStr);

			await updateWorkflowStepRun(db, stepRun.id, {
				status: 'completed',
				outputJson: outputStr,
				completedAt,
				durationMs
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			const completedAt = Math.floor(Date.now() / 1000);

			await updateWorkflowStepRun(db, stepRun.id, {
				status: 'failed',
				errorMessage: errorMsg,
				completedAt
			});

			failed = true;
			failError = `Step ${nodeId} failed: ${errorMsg}`;
			log.error('executeWorkflowRun', `Step ${nodeId} failed in run ${runId}: ${errorMsg}`);
		}
	}

	// Finalize run — but skip if already cancelled externally to avoid resurrecting the status
	const completedAt = Math.floor(Date.now() / 1000);
	const lastOutput = [...completedOutputs.values()].pop();

	if (!cancelled) {
		// Re-check the persisted run status immediately before writing the final
		// state.  A concurrent cancel request may have set status='cancelled'
		// between the last per-step check and this point.
		const freshRun = await getWorkflowRunById(db, runId);
		if (freshRun?.status === 'cancelled') {
			cancelled = true;
			log.info(
				'executeWorkflowRun',
				`Run ${runId} cancelled before finalization — skipping update`
			);
		} else {
			const finalStatus = failed ? 'failed' : 'completed';
			await updateWorkflowRun(db, runId, {
				status: finalStatus,
				outputJson: lastOutput ?? null,
				errorMessage: failed ? failError : null,
				completedAt
			});
		}
	}

	// Gather step results
	const finalStepRuns = await getStepRunsForRun(db, runId);
	const stepResults = finalStepRuns.map((sr) => ({
		stepId: sr.stepId,
		status: sr.status,
		output: sr.outputJson,
		error: sr.errorMessage,
		durationMs: sr.durationMs
	}));

	const resultStatus = cancelled ? 'cancelled' : failed ? 'failed' : 'completed';
	log.info('executeWorkflowRun', `Workflow run ${runId} ${resultStatus}`);
	return { runId, status: resultStatus, stepResults };
}

/**
 * Step executor interface — pluggable execution strategy.
 */
export interface StepExecutor {
	execute(
		step: WorkflowStepRecord,
		runInput: string,
		previousOutputs: Map<string, string>
	): Promise<unknown>;
}
