/**
 * Behavior Analytics Service — Agent Beta Phase 3
 *
 * Aggregates telemetry_events, probe_runs, reputation_snapshots, and
 * audit_intents into periodic behavior metrics for each agent.
 *
 * Exports:
 *   computeDailyMetrics(db, agentId, dayUnix)
 *   computeWeeklyMetrics(db, agentId, weekStartUnix)
 *   backfillMetrics(db, agentId, days)
 *   getAgentTrends(db, agentId, periodType, limit)
 */

import type { DbClient } from '$lib/db/client';
import { sql, eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { computeTrustBadge } from '$lib/services/observer/trust-badges';
import { agentBehaviorMetrics, type AgentBehaviorMetric } from '$lib/db/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Seconds in a day */
const DAY_SEC = 86400;

/** Seconds in a week */
const WEEK_SEC = 7 * DAY_SEC;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BehaviorMetrics {
	id: string;
	agent_id: string;
	period_start: number;
	period_end: number;
	period_type: 'daily' | 'weekly';
	uptime_pct: number | null;
	avg_response_ms: number | null;
	p95_response_ms: number | null;
	success_rate: number | null;
	total_requests: number;
	error_count: number;
	payment_reliability: number | null;
	reputation_score: number | null;
	badge_tier: string | null;
	computed_at: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Query aggregated telemetry for an agent in a time window */
async function aggregateTelemetryWindow(db: DbClient, agentId: string, start: number, end: number) {
	const row = await db.get<{
		total: number;
		success_count: number;
		error_count: number;
		avg_latency: number | null;
		p95_latency: number | null;
	}>(sql`SELECT
		COUNT(*) as total,
		SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
		SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count,
		AVG(latency_ms) as avg_latency,
		NULL as p95_latency
	FROM telemetry_events
	WHERE agent_id = ${agentId}
		AND created_at >= ${start}
		AND created_at < ${end}`);

	// Compute p95 from sorted latencies
	const latencies = await db.all<{ latency_ms: number }>(sql`
		SELECT latency_ms FROM telemetry_events
		WHERE agent_id = ${agentId}
			AND created_at >= ${start}
			AND created_at < ${end}
			AND latency_ms IS NOT NULL
		ORDER BY latency_ms ASC`);

	let p95: number | null = null;
	if (latencies.length > 0) {
		const idx = Math.floor(0.95 * latencies.length);
		p95 = latencies[Math.min(idx, latencies.length - 1)].latency_ms;
	}

	return {
		total: row?.total ?? 0,
		successCount: row?.success_count ?? 0,
		errorCount: row?.error_count ?? 0,
		avgLatency: row?.avg_latency ?? null,
		p95Latency: p95
	};
}

/** Query payment reliability from audit_intents settled vs total */
async function computePaymentReliability(
	db: DbClient,
	agentId: string,
	start: number,
	end: number
): Promise<number | null> {
	const row = await db.get<{ total: number; settled: number }>(sql`
		SELECT COUNT(*) as total,
			SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled
		FROM audit_intents
		WHERE (payer = ${agentId} OR payee = ${agentId})
			AND created_at >= ${start}
			AND created_at < ${end}`);
	if (!row || row.total === 0) return null;
	return row.settled / row.total;
}

/** Get latest reputation snapshot for an agent */
async function getLatestReputation(db: DbClient, agentId: string, before: number) {
	return await db.get<{
		reputation: number | null;
		availability: number | null;
		cert_score: number | null;
		fraud_rate: number | null;
	}>(sql`SELECT reputation, availability, cert_score, fraud_rate
		FROM reputation_snapshots
		WHERE agent_id = ${agentId} AND created_at < ${before}
		ORDER BY created_at DESC LIMIT 1`);
}

// ---------------------------------------------------------------------------
// Shared compute-and-store
// ---------------------------------------------------------------------------

/** Internal: compute metrics for a period and persist to DB */
async function computeAndStore(
	db: DbClient,
	agentId: string,
	periodStart: number,
	periodEnd: number,
	periodType: 'daily' | 'weekly'
): Promise<BehaviorMetrics> {
	const telem = await aggregateTelemetryWindow(db, agentId, periodStart, periodEnd);
	const paymentRel = await computePaymentReliability(db, agentId, periodStart, periodEnd);
	const rep = await getLatestReputation(db, agentId, periodEnd);

	const successRate = telem.total > 0 ? telem.successCount / telem.total : null;
	const uptimePct = successRate; // approximate uptime from success rate

	// Derive badge tier from latest reputation snapshot
	let badgeTier: string | null = null;
	if (rep) {
		const badge = computeTrustBadge({
			reputation: rep.reputation,
			availability: rep.availability,
			cert_score: rep.cert_score,
			fraud_rate: rep.fraud_rate
		});
		badgeTier = badge.tier;
	}

	const id = nanoid();
	const now = Math.floor(Date.now() / 1000);

	await db.insert(agentBehaviorMetrics).values({
		id,
		agentId,
		periodStart,
		periodEnd,
		periodType,
		uptimePct,
		avgResponseMs: telem.avgLatency,
		p95ResponseMs: telem.p95Latency ? Math.round(telem.p95Latency) : null,
		successRate,
		totalRequests: telem.total,
		errorCount: telem.errorCount,
		paymentReliability: paymentRel,
		reputationScore: rep?.reputation ?? null,
		badgeTier,
		computedAt: now
	});

	return {
		id,
		agent_id: agentId,
		period_start: periodStart,
		period_end: periodEnd,
		period_type: periodType,
		uptime_pct: uptimePct,
		avg_response_ms: telem.avgLatency,
		p95_response_ms: telem.p95Latency ? Math.round(telem.p95Latency) : null,
		success_rate: successRate,
		total_requests: telem.total,
		error_count: telem.errorCount,
		payment_reliability: paymentRel,
		reputation_score: rep?.reputation ?? null,
		badge_tier: badgeTier,
		computed_at: now
	};
}

// ---------------------------------------------------------------------------
// Exported Functions
// ---------------------------------------------------------------------------

/**
 * Compute and persist daily behavior metrics for a single agent.
 *
 * @param db - Drizzle D1 client.
 * @param agentId - Target agent identifier.
 * @param dayUnix - Unix timestamp for the start of the day (midnight UTC).
 */
export async function computeDailyMetrics(
	db: DbClient,
	agentId: string,
	dayUnix: number
): Promise<BehaviorMetrics> {
	return await computeAndStore(db, agentId, dayUnix, dayUnix + DAY_SEC, 'daily');
}

/**
 * Compute and persist weekly behavior metrics for a single agent.
 *
 * @param db - Drizzle D1 client.
 * @param agentId - Target agent identifier.
 * @param weekStartUnix - Unix timestamp for the start of the week (Monday midnight UTC).
 */
export async function computeWeeklyMetrics(
	db: DbClient,
	agentId: string,
	weekStartUnix: number
): Promise<BehaviorMetrics> {
	return await computeAndStore(db, agentId, weekStartUnix, weekStartUnix + WEEK_SEC, 'weekly');
}

/**
 * Backfill daily metrics for the last N days.
 *
 * @param db - Drizzle D1 client.
 * @param agentId - Target agent identifier.
 * @param days - Number of past days to backfill.
 */
export async function backfillMetrics(
	db: DbClient,
	agentId: string,
	days: number
): Promise<{ created: number }> {
	const now = Math.floor(Date.now() / 1000);
	const todayMidnight = now - (now % DAY_SEC);
	let created = 0;

	for (let i = days; i > 0; i--) {
		const dayStart = todayMidnight - i * DAY_SEC;
		await computeDailyMetrics(db, agentId, dayStart);
		created++;
	}

	return { created };
}

/**
 * Get stored behavior metrics for an agent, ordered by period_start DESC.
 *
 * @param db - Drizzle D1 client.
 * @param agentId - Target agent identifier.
 * @param periodType - 'daily' or 'weekly'.
 * @param limit - Max rows to return (default 30).
 */
export async function getAgentTrends(
	db: DbClient,
	agentId: string,
	periodType: 'daily' | 'weekly' = 'daily',
	limit: number = 30
): Promise<AgentBehaviorMetric[]> {
	return await db
		.select()
		.from(agentBehaviorMetrics)
		.where(
			and(
				eq(agentBehaviorMetrics.agentId, agentId),
				eq(agentBehaviorMetrics.periodType, periodType)
			)
		)
		.orderBy(desc(agentBehaviorMetrics.periodStart))
		.limit(limit);
}
