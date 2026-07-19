/**
 * Observer Repository — typed data access for telemetry_events,
 * probe_runs, and reputation_snapshots tables.
 */

import { eq, desc, sql, and, gte } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	telemetryEvents,
	probeRuns,
	reputationSnapshots,
	type NewTelemetryEvent,
	type NewProbeRun,
	type NewReputationSnapshot
} from '../schema';

// ===================================================================
// Telemetry Events
// ===================================================================

/** Insert a telemetry event */
export async function insertTelemetryEvent(db: DbClient, event: NewTelemetryEvent) {
	return await db.insert(telemetryEvents).values(event);
}

/** Aggregate health metrics for an agent within a time window */
export async function aggregateHealth(db: DbClient, agentId: string, cutoff: number) {
	const [result] = await db
		.select({
			total: sql<number>`COUNT(*)`,
			successCount: sql<number>`SUM(success)`,
			errorCount: sql<number>`SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)`,
			fraudCount: sql<number>`SUM(fraud_flag)`
		})
		.from(telemetryEvents)
		.where(and(eq(telemetryEvents.agentId, agentId), gte(telemetryEvents.createdAt, cutoff)));

	return {
		total: result?.total ?? 0,
		successCount: result?.successCount ?? 0,
		errorCount: result?.errorCount ?? 0,
		fraudCount: result?.fraudCount ?? 0
	};
}

/** Get recent latencies for p95 calculation */
export async function getRecentLatencies(db: DbClient, agentId: string, limit: number) {
	return await db
		.select({ latencyMs: telemetryEvents.latencyMs })
		.from(telemetryEvents)
		.where(and(eq(telemetryEvents.agentId, agentId), sql`${telemetryEvents.latencyMs} IS NOT NULL`))
		.orderBy(desc(telemetryEvents.createdAt))
		.limit(limit);
}

// ===================================================================
// Probe Runs
// ===================================================================

/** Insert a probe run record */
export async function insertProbeRun(db: DbClient, run: NewProbeRun) {
	return await db.insert(probeRuns).values(run);
}

/** Get latest probe run for an agent */
export async function getLatestProbeRun(db: DbClient, agentId: string) {
	return (
		(await db.query.probeRuns.findFirst({
			columns: { successCount: true, probesSent: true },
			where: eq(probeRuns.agentId, agentId),
			orderBy: [desc(probeRuns.createdAt)]
		})) ?? null
	);
}

/** Check for a recent probe run within the idempotency window */
export async function getRecentProbeRun(db: DbClient, agentId: string, cutoff: number) {
	return (
		(await db.query.probeRuns.findFirst({
			columns: { id: true },
			where: and(eq(probeRuns.agentId, agentId), gte(probeRuns.createdAt, cutoff))
		})) ?? null
	);
}

// ===================================================================
// Reputation Snapshots
// ===================================================================

/** Insert a reputation snapshot */
export async function insertReputationSnapshot(db: DbClient, snapshot: NewReputationSnapshot) {
	return await db.insert(reputationSnapshots).values(snapshot);
}

/** Check for a recent reputation snapshot within the idempotency window */
export async function getRecentReputationSnapshot(db: DbClient, agentId: string, cutoff: number) {
	return (
		(await db.query.reputationSnapshots.findFirst({
			columns: { id: true },
			where: and(
				eq(reputationSnapshots.agentId, agentId),
				gte(reputationSnapshots.createdAt, cutoff)
			)
		})) ?? null
	);
}

/** Get the latest reputation snapshot for each agent (bulk read-only) */
export interface ReputationRow {
	agent_id: string;
	availability: number | null;
	error_rate: number | null;
	fraud_rate: number | null;
	p95_latency_ms: number | null;
	probe_success: number | null;
	cert_score: number | null;
	reputation: number | null;
	actions: string | null;
	created_at: number | null;
}

export async function getLatestReputations(db: DbClient): Promise<ReputationRow[]> {
	// Correlated subquery: get latest snapshot per agent. Cannot be expressed
	// via Drizzle's relational builder, so we use a typed sql template.
	// Note: returns snake_case to match the JSON API contract consumed by
	// executors.ts and reputation/+server.ts. The API layer returns these
	// fields as-is to external consumers, so renaming would break the protocol.
	return await db.all<ReputationRow>(sql`SELECT rs.agent_id, rs.availability, rs.error_rate, rs.fraud_rate,
		rs.p95_latency_ms, rs.probe_success, rs.cert_score, rs.reputation,
		rs.actions, rs.created_at
		FROM reputation_snapshots rs
		WHERE rs.rowid = (
			SELECT rs2.rowid FROM reputation_snapshots rs2
			WHERE rs2.agent_id = rs.agent_id
			ORDER BY rs2.created_at DESC, rs2.rowid DESC
			LIMIT 1
		)
		ORDER BY rs.reputation DESC`);
}
