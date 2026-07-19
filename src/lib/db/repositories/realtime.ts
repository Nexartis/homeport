/**
 * Real-time & Conflict Resolution Repository — Phase 6 Sprint 15
 * CRUD operations for workflow_events and conflict_resolutions tables.
 */

import { eq, and, desc, asc, lte } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import {
	workflowEvents,
	conflictResolutions,
	type NewWorkflowEventRecord,
	type NewConflictResolutionRecord
} from '$lib/db/schema';

// ── Workflow Events ──────────────────────────────────────────────────

export async function createWorkflowEvent(db: DbClient, data: NewWorkflowEventRecord) {
	const result = await db.insert(workflowEvents).values(data).returning();
	return result[0];
}

export async function getWorkflowEventById(db: DbClient, id: string) {
	return (await db.query.workflowEvents.findFirst({ where: eq(workflowEvents.id, id) })) ?? null;
}

export async function listEventsByRun(db: DbClient, runId: string, limit = 100) {
	return db.query.workflowEvents.findMany({
		where: eq(workflowEvents.runId, runId),
		orderBy: asc(workflowEvents.emittedAt),
		limit
	});
}

export async function listEventsByWorkflow(db: DbClient, workflowId: string, limit = 100) {
	return db.query.workflowEvents.findMany({
		where: eq(workflowEvents.workflowId, workflowId),
		orderBy: desc(workflowEvents.emittedAt),
		limit
	});
}

export async function listUnconsumedEvents(
	db: DbClient,
	runId: string,
	_afterTimestamp = 0,
	limit = 50
) {
	return db.query.workflowEvents.findMany({
		where: and(
			eq(workflowEvents.runId, runId),
			eq(workflowEvents.consumed, 0),
			lte(workflowEvents.emittedAt, Math.floor(Date.now() / 1000))
		),
		orderBy: asc(workflowEvents.emittedAt),
		limit
	});
}

export async function markEventsConsumed(db: DbClient, eventIds: string[]) {
	if (eventIds.length === 0) return;
	for (const id of eventIds) {
		await db.update(workflowEvents).set({ consumed: 1 }).where(eq(workflowEvents.id, id));
	}
}

// ── Conflict Resolutions ─────────────────────────────────────────────

export async function createConflictResolution(db: DbClient, data: NewConflictResolutionRecord) {
	const result = await db.insert(conflictResolutions).values(data).returning();
	return result[0];
}

export async function getConflictResolutionById(db: DbClient, id: string) {
	return (
		(await db.query.conflictResolutions.findFirst({
			where: eq(conflictResolutions.id, id)
		})) ?? null
	);
}

export async function listConflictsByRun(db: DbClient, runId: string) {
	return db.query.conflictResolutions.findMany({
		where: eq(conflictResolutions.runId, runId),
		orderBy: desc(conflictResolutions.createdAt)
	});
}

export async function listConflictsByWorkflow(db: DbClient, workflowId: string) {
	return db.query.conflictResolutions.findMany({
		where: eq(conflictResolutions.workflowId, workflowId),
		orderBy: desc(conflictResolutions.createdAt)
	});
}

export async function listUnresolvedConflicts(db: DbClient, workflowId: string) {
	return db.query.conflictResolutions.findMany({
		where: and(eq(conflictResolutions.workflowId, workflowId), eq(conflictResolutions.resolved, 0)),
		orderBy: asc(conflictResolutions.createdAt)
	});
}

export async function resolveConflict(
	db: DbClient,
	id: string,
	updates: {
		winnerAgentId: string;
		winnerResponse: string;
		resolutionScore?: number;
	}
) {
	const result = await db
		.update(conflictResolutions)
		.set({
			winnerAgentId: updates.winnerAgentId,
			winnerResponse: updates.winnerResponse,
			resolutionScore: updates.resolutionScore ?? null,
			resolved: 1,
			resolvedAt: Math.floor(Date.now() / 1000)
		})
		.where(eq(conflictResolutions.id, id))
		.returning();
	return result[0] ?? null;
}

export async function deleteConflictResolution(db: DbClient, id: string) {
	return db.delete(conflictResolutions).where(eq(conflictResolutions.id, id));
}
