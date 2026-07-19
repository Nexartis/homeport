/**
 * Delegation & Routing Repository — typed CRUD for delegation tasks and routing decisions.
 * Phase 6 — Sprint 14: A2A Routing + Sub-agent Delegation
 */

import { eq, sql, desc } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	delegationTasks,
	routingDecisions,
	type NewDelegationTaskRecord,
	type NewRoutingDecisionRecord
} from '../schema';

// ===================================================================
// Delegation Tasks
// ===================================================================

/** Create a delegation task */
export async function createDelegationTask(db: DbClient, data: NewDelegationTaskRecord) {
	const result = await db.insert(delegationTasks).values(data).returning();
	return result[0];
}

/** Get a delegation task by ID */
export async function getDelegationTaskById(db: DbClient, id: string) {
	return (await db.query.delegationTasks.findFirst({ where: eq(delegationTasks.id, id) })) ?? null;
}

/** List delegation tasks by delegator */
export async function listDelegationsByDelegator(db: DbClient, delegatorId: string) {
	return db.query.delegationTasks.findMany({
		where: eq(delegationTasks.delegatorId, delegatorId),
		orderBy: [desc(delegationTasks.createdAt)]
	});
}

/** List delegation tasks by delegate (agent receiving the task) */
export async function listDelegationsByDelegate(db: DbClient, delegateId: string) {
	return db.query.delegationTasks.findMany({
		where: eq(delegationTasks.delegateId, delegateId),
		orderBy: [desc(delegationTasks.createdAt)]
	});
}

/** List delegation tasks by workflow */
export async function listDelegationsByWorkflow(db: DbClient, workflowId: string) {
	return db.query.delegationTasks.findMany({
		where: eq(delegationTasks.parentWorkflowId, workflowId),
		orderBy: [desc(delegationTasks.createdAt)]
	});
}

/** List delegation tasks by status */
export async function listDelegationsByStatus(db: DbClient, status: string) {
	return db.query.delegationTasks.findMany({
		where: eq(delegationTasks.status, status),
		orderBy: [desc(delegationTasks.createdAt)]
	});
}

/** Update a delegation task */
export async function updateDelegationTask(
	db: DbClient,
	id: string,
	data: Partial<
		Pick<
			NewDelegationTaskRecord,
			'status' | 'outputJson' | 'errorMessage' | 'retryCount' | 'startedAt' | 'completedAt'
		>
	>
) {
	const result = await db
		.update(delegationTasks)
		.set({ ...data, updatedAt: sql`(unixepoch())` })
		.where(eq(delegationTasks.id, id))
		.returning();
	return result[0] ?? null;
}

/** Delete a delegation task */
export async function deleteDelegationTask(db: DbClient, id: string) {
	return db.delete(delegationTasks).where(eq(delegationTasks.id, id));
}

// ===================================================================
// Routing Decisions
// ===================================================================

/** Create a routing decision */
export async function createRoutingDecision(db: DbClient, data: NewRoutingDecisionRecord) {
	const result = await db.insert(routingDecisions).values(data).returning();
	return result[0];
}

/** Get a routing decision by ID */
export async function getRoutingDecisionById(db: DbClient, id: string) {
	return (
		(await db.query.routingDecisions.findFirst({ where: eq(routingDecisions.id, id) })) ?? null
	);
}

/** List routing decisions for a source agent */
export async function listRoutingDecisionsBySource(
	db: DbClient,
	sourceAgentId: string,
	limit = 50
) {
	return db.query.routingDecisions.findMany({
		where: eq(routingDecisions.sourceAgentId, sourceAgentId),
		orderBy: [desc(routingDecisions.createdAt)],
		limit
	});
}

/** List routing decisions for an action */
export async function listRoutingDecisionsByAction(db: DbClient, action: string, limit = 50) {
	return db.query.routingDecisions.findMany({
		where: eq(routingDecisions.action, action),
		orderBy: [desc(routingDecisions.createdAt)],
		limit
	});
}

/** Mark a routing decision as successful or failed */
export async function updateRoutingDecisionOutcome(
	db: DbClient,
	id: string,
	success: boolean,
	latencyMs?: number
) {
	const result = await db
		.update(routingDecisions)
		.set({ success: success ? 1 : 0, latencyMs: latencyMs ?? null })
		.where(eq(routingDecisions.id, id))
		.returning();
	return result[0] ?? null;
}
