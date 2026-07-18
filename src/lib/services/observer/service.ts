/**
 * Observer / Evaluator Service — telemetry ingestion, health aggregation,
 * active health probes, weighted reputation scoring, and cron-driven
 * probe scheduling.
 *
 * Reference: nexartis-forks/nanda-infrastructure/agents/observer_evaluator/langchain_observer_evaluator.py
 */

import type { Env } from '$lib/types';
import type { DbClient } from '$lib/db/client';
import {
	insertTelemetryEvent,
	aggregateHealth,
	getRecentLatencies,
	insertProbeRun,
	getLatestProbeRun,
	getLatestCertScore,
	insertReputationSnapshot,
	getAliveAgents,
	insertCertJob,
	updateCertJobStatus
} from '$lib/db/repositories';
import { evaluateAlerts, dispatchAlerts } from '../monitoring/alerts';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'observer');

// ---------------------------------------------------------------------------
// Constants (defaults — overridable via env, see P1-11)
// ---------------------------------------------------------------------------

/** Default reputation weight for availability (success rate). Override: OBSERVER_W_AVAIL env var. */
const W_AVAIL = 0.4;

/** Default reputation weight for probe success rate. Override: OBSERVER_W_PROBE env var. */
const W_PROBE = 0.4;

/** Default reputation weight for last certification score. Override: OBSERVER_W_CERT env var. */
const W_CERT = 0.2;

/** Default reputation penalty weight for fraud rate (subtracted). Override: OBSERVER_W_FRAUD env var. */
const W_FLAGS = 0.1;

/** Rate-limit threshold: if reputation < this, add "rate_limit" action (P1-8, Python ref line 29/242). */
const RATE_LIMIT_THRESH = 0.5;

/** Minimum drop in probe_success below cert_score to trigger auto-recert. */
const RECERT_DELTA = 0.15;

/** Minimum total probes before a recert trigger is considered valid. */
const RECERT_MIN_N = 10;

/** Maximum number of telemetry events used for p95 calculation. */
const P95_WINDOW = 100;

/** Default health aggregation window in seconds (1 hour). */
const DEFAULT_HEALTH_WINDOW_SEC = 3600;

/** Reputation health aggregation window in seconds (24 hours). */
const REPUTATION_HEALTH_WINDOW_SEC = 86400;

/** Number of pings per probe run. */
const PROBES_PER_RUN = 3;

/** Probe HTTP timeout in milliseconds. */
const PROBE_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Aggregated health summary for an agent within a time window. */
export interface HealthSummary {
	agent_id: string;
	total_events: number;
	success_count: number;
	error_count: number;
	/** success_count / total_events (0 when no events). */
	availability: number;
	/** error_count / total_events (0 when no events). */
	error_rate: number;
	fraud_count: number;
	/** fraud_count / total_events (0 when no events). */
	fraud_rate: number;
	/** 95th-percentile latency from the last {@link P95_WINDOW} events. */
	p95_latency_ms: number | null;
}

/** Computed reputation snapshot with triggered actions. */
export interface ReputationResult {
	agent_id: string;
	availability: number;
	error_rate: number;
	fraud_rate: number;
	p95_latency_ms: number | null;
	probe_success: number;
	cert_score: number;
	/** Weighted reputation score clamped to [0.0, 1.0]. */
	reputation: number;
	/** Triggered actions, e.g. `["monitor", "rate_limit", "recert_requested"]`. */
	actions: string[];
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the p-th percentile of a numeric array.
 * Returns `null` for empty arrays.
 *
 * @param values - Numeric values (need not be sorted).
 * @returns The 95th-percentile value, or `null` if empty.
 */
function p95(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = Math.floor(0.95 * sorted.length);
	return sorted[Math.min(idx, sorted.length - 1)];
}

/** Clamp a number to the [0, 1] range. */
function clamp01(x: number): number {
	return Math.max(0.0, Math.min(1.0, x));
}

/**
 * Execute a `fetch` with an {@link AbortController}-based timeout.
 *
 * @param url - Target URL.
 * @param init - Standard `RequestInit` options.
 * @param timeoutMs - Timeout in milliseconds.
 * @returns The `Response` from the fetch call.
 */
async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

/** Safe division: returns 0 when `denominator` is 0. */
function safeDivide(numerator: number, denominator: number): number {
	return denominator === 0 ? 0 : numerator / denominator;
}

// ---------------------------------------------------------------------------
// Telemetry Ingestion
// ---------------------------------------------------------------------------

/**
 * Ingest a single telemetry event into the `telemetry_events` D1 table.
 *
 * @param db - Cloudflare D1 database binding.
 * @param event - Telemetry event payload.
 * @returns The generated event `id`.
 * @throws {Error} If `agent_id` is empty or missing.
 */
export async function ingestTelemetry(
	db: DbClient,
	event: {
		agent_id: string;
		latency_ms: number;
		success: boolean;
		status_code?: number;
		fraud_flag?: boolean;
		note?: string;
	}
): Promise<{ id: string }> {
	if (!event.agent_id || typeof event.agent_id !== 'string') {
		throw new Error('[ingestTelemetry] agent_id must be a non-empty string');
	}

	const id = crypto.randomUUID();

	await insertTelemetryEvent(db, {
		id,
		agentId: event.agent_id,
		latencyMs: event.latency_ms,
		success: event.success ? 1 : 0,
		statusCode: event.status_code ?? null,
		fraudFlag: event.fraud_flag ? 1 : 0,
		note: event.note ?? null
	});

	return { id };
}

// ---------------------------------------------------------------------------
// Health Aggregation
// ---------------------------------------------------------------------------

/**
 * Compute an aggregated health summary for `agentId` within a sliding time window.
 *
 * @param db - Cloudflare D1 database binding.
 * @param agentId - The agent to aggregate.
 * @param windowSec - Lookback window in seconds (default: 3600 = 1 hour).
 * @returns Aggregated {@link HealthSummary}.
 */
export async function healthForAgent(
	db: DbClient,
	agentId: string,
	windowSec: number = DEFAULT_HEALTH_WINDOW_SEC
): Promise<HealthSummary> {
	const cutoff = Math.floor(Date.now() / 1000) - windowSec;

	// Aggregate counts in a single query via repo
	const agg = await aggregateHealth(db, agentId, cutoff);

	const total = agg.total;
	const successCount = agg.successCount;
	const errorCount = agg.errorCount;
	const fraudCount = agg.fraudCount;

	// p95 from the last P95_WINDOW events (by created_at DESC)
	const latencyRows = await getRecentLatencies(db, agentId, P95_WINDOW);

	const latencies = latencyRows.map((r) => r.latencyMs).filter((v): v is number => v !== null);

	return {
		agent_id: agentId,
		total_events: total,
		success_count: successCount,
		error_count: errorCount,
		availability: safeDivide(successCount, total),
		error_rate: safeDivide(errorCount, total),
		fraud_count: fraudCount,
		fraud_rate: safeDivide(fraudCount, total),
		p95_latency_ms: p95(latencies)
	};
}

// ---------------------------------------------------------------------------
// Active Health Probe
// ---------------------------------------------------------------------------

/**
 * Execute an active health probe against an agent by sending lightweight
 * A2A JSON-RPC `ping` requests and recording latency / success.
 *
 * Each ping result is also ingested as a telemetry event for the agent.
 *
 * @param db - Cloudflare D1 database binding.
 * @param agentId - Target agent identifier.
 * @param agentUrl - Base URL of the agent (e.g. `https://agent.example.com`).
 * @param capability - Optional capability tag for the probe run.
 * @returns Probe run summary persisted to `probe_runs`.
 */
export async function runProbe(
	db: DbClient,
	agentId: string,
	agentUrl: string,
	capability?: string,
	env?: Env
): Promise<{ id: string; success_count: number; probes_sent: number; p95_latency_ms: number }> {
	const latencies: number[] = [];
	let successCount = 0;
	const probesSent = parseInt(env?.DEFAULT_PROBE_N ?? '', 10) || PROBES_PER_RUN;
	const endpoint = agentUrl.replace(/\/+$/, '') + '/a2a';

	for (let i = 0; i < probesSent; i++) {
		const start = Date.now();
		let ok = false;
		let statusCode = 0;

		try {
			const res = await fetchWithTimeout(
				endpoint,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						jsonrpc: '2.0',
						method: 'ping',
						params: {},
						id: crypto.randomUUID()
					})
				},
				PROBE_TIMEOUT_MS
			);
			statusCode = res.status;
			ok = res.ok;
		} catch {
			// Timeout or network error — treat as failure
			statusCode = 0;
			ok = false;
		}

		const elapsed = Date.now() - start;
		latencies.push(elapsed);
		if (ok) successCount++;

		// Ingest each probe ping as a telemetry event
		await ingestTelemetry(db, {
			agent_id: agentId,
			latency_ms: elapsed,
			success: ok,
			status_code: statusCode,
			note: `probe:${capability ?? 'health'}`
		});
	}

	const p95Latency = p95(latencies) ?? 0;
	const id = crypto.randomUUID();

	await insertProbeRun(db, {
		id,
		agentId,
		endpoint,
		capability: capability ?? null,
		probesSent,
		successCount,
		p95LatencyMs: p95Latency
	});

	return { id, success_count: successCount, probes_sent: probesSent, p95_latency_ms: p95Latency };
}

// ---------------------------------------------------------------------------
// Reputation Computation
// ---------------------------------------------------------------------------

/**
 * Compute a weighted reputation score for an agent and persist a snapshot.
 *
 * Formula: `reputation = W_AVAIL × availability + W_PROBE × probe_success + W_CERT × cert_score − W_FLAGS × fraud_rate`
 * Clamped to `[0.0, 1.0]`.
 *
 * Triggered actions (always includes `"monitor"`):
 * - `rate_limit` — reputation below {@link RATE_LIMIT_THRESH} (0.50).
 * - `recert_requested` — probe_success drops ≥ {@link RECERT_DELTA} below cert_score AND total probes ≥ {@link RECERT_MIN_N}.
 *   If `env` is provided, a recert trial is processed inline.
 *
 * @param db - Cloudflare D1 database binding.
 * @param agentId - Target agent identifier.
 * @param env - Optional Env for configurable weights (OBSERVER_W_AVAIL, OBSERVER_W_PROBE, OBSERVER_W_CERT, OBSERVER_W_FRAUD).
 * @returns Computed {@link ReputationResult} persisted to `reputation_snapshots`.
 */
export async function computeReputation(
	db: DbClient,
	agentId: string,
	env?: Env
): Promise<ReputationResult> {
	// Resolve configurable weights from env (P1-11, Python ref lines 23-26)
	const wAvail = parseFloat(env?.OBSERVER_W_AVAIL ?? '') || W_AVAIL;
	const wProbe = parseFloat(env?.OBSERVER_W_PROBE ?? '') || W_PROBE;
	const wCert = parseFloat(env?.OBSERVER_W_CERT ?? '') || W_CERT;
	const wFlags = parseFloat(env?.OBSERVER_W_FRAUD ?? '') || W_FLAGS;

	// 1. Health over 24-hour window
	const health = await healthForAgent(db, agentId, REPUTATION_HEALTH_WINDOW_SEC);

	// 2. Latest probe run
	const latestProbe = await getLatestProbeRun(db, agentId);

	const probeSuccess = latestProbe
		? safeDivide(latestProbe.successCount ?? 0, latestProbe.probesSent ?? 0)
		: 0;

	// 3. Latest cert score (READ-ONLY from certifier's table)
	const latestCert = await getLatestCertScore(db, agentId);

	const certScore = latestCert?.score ?? 0;

	// 4. Weighted reputation formula (configurable weights — P1-11)
	const rawReputation =
		wAvail * health.availability +
		wProbe * probeSuccess +
		wCert * certScore -
		wFlags * health.fraud_rate;

	const reputation = clamp01(rawReputation);

	// 5. Decide actions (pass reputation for rate_limit check — P1-8)
	const actions = decideActions(reputation, health, probeSuccess, certScore);

	// 6. Process auto-recert inline if action triggered (P1-10: recert_requested)
	//    Must create a cert_jobs row first so processSingleTrial can find the parent job
	//    for completion tracking and certificate issuance.
	if (actions.includes('recert_requested') && env) {
		const jobId = crypto.randomUUID();
		const numTrials = 1; // Single-trial auto-recert
		const parsed = parseFloat(env?.CERT_PASS_THRESHOLD as string);
		const passThreshold = Number.isFinite(parsed) ? clamp01(parsed) : 0.8;

		await insertCertJob(db, {
			jobId,
			agentId,
			capability: 'auto-recert',
			status: 'pending',
			numTrials,
			passThreshold
		});

		try {
			const { processSingleTrial } = await import('$lib/services/certifier/queue-handler');
			await processSingleTrial(
				{
					job_id: jobId,
					agent_id: agentId,
					capability: 'auto-recert',
					trial_num: 1,
					pass_threshold: passThreshold
				},
				env
			);
			await updateCertJobStatus(db, jobId, 'running', 'pending');
		} catch (trialErr) {
			// Trial processing failed — mark job as failed
			await updateCertJobStatus(db, jobId, 'failed');
			log.error('autoRecert', `Auto-recert failed for agent ${agentId}`, {
				error: trialErr instanceof Error ? trialErr.message : String(trialErr)
			});
		}
	}

	// 7. Persist snapshot
	const id = crypto.randomUUID();
	await insertReputationSnapshot(db, {
		id,
		agentId,
		availability: health.availability,
		errorRate: health.error_rate,
		fraudRate: health.fraud_rate,
		p95LatencyMs: health.p95_latency_ms,
		probeSuccess,
		certScore,
		reputation,
		actions: JSON.stringify(actions)
	});

	// 8. Evaluate alerts after reputation is computed (Phase 4 — Gamma)
	const alerts = evaluateAlerts(agentId, {
		availability: health.availability,
		probeSuccess,
		p95LatencyMs: health.p95_latency_ms ?? 0,
		reputation
	});

	if (alerts.length > 0) {
		try {
			await dispatchAlerts(db, alerts);
		} catch (alertErr) {
			// Non-critical — don't fail the reputation computation over alerting
			log.error('computeReputation', `Alert dispatch failed for agent ${agentId}`, {
				error: alertErr instanceof Error ? alertErr.message : String(alertErr)
			});
		}
	}

	return {
		agent_id: agentId,
		availability: health.availability,
		error_rate: health.error_rate,
		fraud_rate: health.fraud_rate,
		p95_latency_ms: health.p95_latency_ms,
		probe_success: probeSuccess,
		cert_score: certScore,
		reputation,
		actions
	};
}

/**
 * Determine which automated actions should be triggered for an agent.
 * Always includes "monitor" as the default action (P1-9, Python ref line 240).
 *
 * @param reputation - Computed reputation score (0–1).
 * @param health - Current health summary.
 * @param probeSuccess - Latest probe success rate (0–1).
 * @param certScore - Latest certification score (0–1).
 * @returns Array of action strings.
 */
function decideActions(
	reputation: number,
	health: HealthSummary,
	probeSuccess: number,
	certScore: number
): string[] {
	// P1-9: Always include "monitor" as default action (Python ref line 240)
	const actions: string[] = ['monitor'];

	// P1-8: Rate-limit when reputation below threshold (Python ref lines 242-243)
	if (reputation < RATE_LIMIT_THRESH) {
		actions.push('rate_limit');
	}

	// Auto-recert trigger: probe success has drifted below cert score
	// Only valid when we have enough probes to be statistically meaningful (Python ref lines 248-268)
	if (
		certScore > 0 &&
		health.total_events >= RECERT_MIN_N &&
		probeSuccess < certScore - RECERT_DELTA
	) {
		// P1-10: "recert_requested" not "recert" (Python ref line 266)
		actions.push('recert_requested');
	}

	return actions;
}

// ---------------------------------------------------------------------------
// Cron Handler: Run Scheduled Probes
// ---------------------------------------------------------------------------

/**
 * Run health probes for all `alive` agents inline.
 * Intended to be called by the hourly cron trigger (`0 * * * *`).
 * Processes each agent sequentially: probe → reputation computation.
 *
 * @param db - Cloudflare D1 database binding.
 * @param env - Worker environment bindings.
 * @returns The number of agents probed and any failures.
 */
export async function runScheduledProbes(
	db: DbClient,
	env: Env
): Promise<{ probed: number; failed: number }> {
	const agents = await getAliveAgents(db);

	let probed = 0;
	let failed = 0;
	for (const row of agents) {
		try {
			await runProbe(db, row.agentId, row.agentUrl ?? '', undefined, env);
			await computeReputation(db, row.agentId, env);
			probed++;
		} catch (err) {
			failed++;
			log.error('runScheduledProbes', `Scheduled probe failed for agent=${row.agentId}`, {
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	return { probed, failed };
}
