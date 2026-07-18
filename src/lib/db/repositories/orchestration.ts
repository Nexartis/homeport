/**
 * Orchestration Repository — typed CRUD for workflows, steps, runs, patterns.
 * Phase 6 — Sprint 13: Multi-Agent Orchestration
 */

import { eq, sql, desc, inArray } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	workflows,
	workflowSteps,
	workflowRuns,
	workflowStepRuns,
	workflowEvents,
	orchestratorPatterns,
	type NewWorkflowRecord,
	type NewWorkflowStepRecord,
	type NewWorkflowRunRecord,
	type NewWorkflowStepRunRecord,
	type NewOrchestratorPatternRecord
} from '../schema';

// ===================================================================
// Workflows
// ===================================================================

/** Create a new workflow */
export async function createWorkflow(db: DbClient, data: NewWorkflowRecord) {
	const result = await db.insert(workflows).values(data).returning();
	return result[0];
}

/** Get a workflow by ID */
export async function getWorkflowById(db: DbClient, id: string) {
	return (await db.query.workflows.findFirst({ where: eq(workflows.id, id) })) ?? null;
}

/** List workflows by owner */
export async function listWorkflowsByOwner(db: DbClient, ownerId: string) {
	return db.query.workflows.findMany({
		where: eq(workflows.ownerId, ownerId),
		orderBy: [desc(workflows.updatedAt)]
	});
}

/** List workflows by status */
export async function listWorkflowsByStatus(db: DbClient, status: string) {
	return db.query.workflows.findMany({
		where: eq(workflows.status, status),
		orderBy: [desc(workflows.updatedAt)]
	});
}

/** Update a workflow */
export async function updateWorkflow(
	db: DbClient,
	id: string,
	data: Partial<Pick<NewWorkflowRecord, 'name' | 'description' | 'dagJson' | 'status' | 'metadata'>>
) {
	const result = await db
		.update(workflows)
		.set({ ...data, updatedAt: sql`(unixepoch())` })
		.where(eq(workflows.id, id))
		.returning();
	return result[0] ?? null;
}

/** Delete a workflow */
export async function deleteWorkflow(db: DbClient, id: string) {
	return db.delete(workflows).where(eq(workflows.id, id));
}

/**
 * Delete a workflow and all child rows (steps, runs, step runs, events).
 * Deletes in FK-safe order: step_runs → events → steps → runs → workflow.
 */
export async function deleteWorkflowCascade(db: DbClient, id: string) {
	// 1. Get run IDs for this workflow
	const runs = await db.query.workflowRuns.findMany({
		where: eq(workflowRuns.workflowId, id),
		columns: { id: true }
	});
	const runIds = runs.map((r) => r.id);

	// 2. Delete step runs (FK → workflow_runs.id and workflow_steps.id)
	if (runIds.length > 0) {
		await db.delete(workflowStepRuns).where(inArray(workflowStepRuns.runId, runIds));
	}

	// 3. Delete workflow events (FK → workflows.id, workflow_runs.id)
	await db.delete(workflowEvents).where(eq(workflowEvents.workflowId, id));

	// 4. Delete steps (FK → workflows.id)
	await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, id));

	// 5. Delete runs (FK → workflows.id)
	await db.delete(workflowRuns).where(eq(workflowRuns.workflowId, id));

	// 6. Delete workflow
	return db.delete(workflows).where(eq(workflows.id, id));
}

// ===================================================================
// Workflow Steps
// ===================================================================

/** Insert a workflow step */
export async function createWorkflowStep(db: DbClient, data: NewWorkflowStepRecord) {
	const result = await db.insert(workflowSteps).values(data).returning();
	return result[0];
}

/** Batch insert workflow steps */
export async function createWorkflowSteps(db: DbClient, data: NewWorkflowStepRecord[]) {
	if (data.length === 0) return [];
	return db.insert(workflowSteps).values(data).returning();
}

/** Get steps for a workflow */
export async function getWorkflowSteps(db: DbClient, workflowId: string) {
	return db.query.workflowSteps.findMany({
		where: eq(workflowSteps.workflowId, workflowId)
	});
}

/** Delete all steps for a workflow */
export async function deleteWorkflowSteps(db: DbClient, workflowId: string) {
	return db.delete(workflowSteps).where(eq(workflowSteps.workflowId, workflowId));
}

// ===================================================================
// Workflow Runs
// ===================================================================

/** Create a workflow run */
export async function createWorkflowRun(db: DbClient, data: NewWorkflowRunRecord) {
	const result = await db.insert(workflowRuns).values(data).returning();
	return result[0];
}

/** Get a workflow run by ID */
export async function getWorkflowRunById(db: DbClient, id: string) {
	return (await db.query.workflowRuns.findFirst({ where: eq(workflowRuns.id, id) })) ?? null;
}

/** List runs for a workflow */
export async function listWorkflowRuns(db: DbClient, workflowId: string, limit = 20) {
	return db.query.workflowRuns.findMany({
		where: eq(workflowRuns.workflowId, workflowId),
		orderBy: [desc(workflowRuns.createdAt)],
		limit
	});
}

/** Update a workflow run status */
export async function updateWorkflowRun(
	db: DbClient,
	id: string,
	data: Partial<
		Pick<
			NewWorkflowRunRecord,
			'status' | 'outputJson' | 'errorMessage' | 'startedAt' | 'completedAt'
		>
	>
) {
	const result = await db.update(workflowRuns).set(data).where(eq(workflowRuns.id, id)).returning();
	return result[0] ?? null;
}

// ===================================================================
// Workflow Step Runs
// ===================================================================

/** Create a step run */
export async function createWorkflowStepRun(db: DbClient, data: NewWorkflowStepRunRecord) {
	const result = await db.insert(workflowStepRuns).values(data).returning();
	return result[0];
}

/** Get step runs for a workflow run */
export async function getStepRunsForRun(db: DbClient, runId: string) {
	return db.query.workflowStepRuns.findMany({
		where: eq(workflowStepRuns.runId, runId)
	});
}

/** Update a step run */
export async function updateWorkflowStepRun(
	db: DbClient,
	id: string,
	data: Partial<
		Pick<
			NewWorkflowStepRunRecord,
			| 'status'
			| 'outputJson'
			| 'errorMessage'
			| 'attempt'
			| 'startedAt'
			| 'completedAt'
			| 'durationMs'
			| 'delegatedTo'
		>
	>
) {
	const result = await db
		.update(workflowStepRuns)
		.set(data)
		.where(eq(workflowStepRuns.id, id))
		.returning();
	return result[0] ?? null;
}

// ===================================================================
// Orchestrator Patterns
// ===================================================================

/** Create a pattern */
export async function createPattern(db: DbClient, data: NewOrchestratorPatternRecord) {
	const result = await db.insert(orchestratorPatterns).values(data).returning();
	return result[0];
}

/** Get a pattern by ID */
export async function getPatternById(db: DbClient, id: string) {
	return (
		(await db.query.orchestratorPatterns.findFirst({
			where: eq(orchestratorPatterns.id, id)
		})) ?? null
	);
}

/** List patterns by category */
export async function listPatternsByCategory(db: DbClient, category: string) {
	return db.query.orchestratorPatterns.findMany({
		where: eq(orchestratorPatterns.category, category),
		orderBy: [desc(orchestratorPatterns.usageCount)]
	});
}

/** List all patterns */
export async function listAllPatterns(db: DbClient) {
	return db.query.orchestratorPatterns.findMany({
		orderBy: [desc(orchestratorPatterns.usageCount)]
	});
}

/** List builtin patterns */
export async function listBuiltinPatterns(db: DbClient) {
	return db.query.orchestratorPatterns.findMany({
		where: eq(orchestratorPatterns.isBuiltin, 1),
		orderBy: [desc(orchestratorPatterns.usageCount)]
	});
}

/** Increment pattern usage count */
export async function incrementPatternUsage(db: DbClient, id: string) {
	return db
		.update(orchestratorPatterns)
		.set({
			usageCount: sql`usage_count + 1`,
			updatedAt: sql`(unixepoch())`
		})
		.where(eq(orchestratorPatterns.id, id));
}

/** Delete a pattern */
export async function deletePattern(db: DbClient, id: string) {
	return db.delete(orchestratorPatterns).where(eq(orchestratorPatterns.id, id));
}
