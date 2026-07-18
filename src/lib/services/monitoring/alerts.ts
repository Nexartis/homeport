/**
 * Monitoring Alerts Service — configurable alerting on probe degradation.
 *
 * Evaluates agent health against thresholds and generates alerts.
 * Leverages Phase 3's analytics/trends.ts for anomaly detection.
 */

import { detectAnomalies } from '../analytics/trends';
import type { DbClient } from '$lib/db/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertThresholds {
	availabilityMin: number; // Default: 0.9 (90%)
	probeSuccessMin: number; // Default: 0.8 (80%)
	p95LatencyMaxMs: number; // Default: 5000 (5 seconds)
	reputationMin: number; // Default: 0.5
	anomalyZScoreThreshold: number; // Default: 2.5
}

export interface Alert {
	agentId: string;
	alertType:
		| 'availability_low'
		| 'probe_failure'
		| 'latency_spike'
		| 'reputation_drop'
		| 'anomaly_detected';
	severity: 'warning' | 'critical';
	currentValue: number;
	threshold: number;
	message: string;
	detectedAt: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: AlertThresholds = {
	availabilityMin: 0.9,
	probeSuccessMin: 0.8,
	p95LatencyMaxMs: 5000,
	reputationMin: 0.5,
	anomalyZScoreThreshold: 2.5
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Evaluate agent health against thresholds — returns alerts if degraded.
 *
 * Severity rules:
 *   - Critical: availability < 50% or reputation < 0.3
 *   - Warning: anything below threshold but above critical
 */
export function evaluateAlerts(
	agentId: string,
	health: {
		availability: number;
		probeSuccess: number;
		p95LatencyMs: number;
		reputation: number;
	},
	thresholds?: Partial<AlertThresholds>
): Alert[] {
	const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
	const alerts: Alert[] = [];
	const now = Math.floor(Date.now() / 1000);

	// Availability check
	if (health.availability < t.availabilityMin) {
		alerts.push({
			agentId,
			alertType: 'availability_low',
			severity: health.availability < 0.5 ? 'critical' : 'warning',
			currentValue: health.availability,
			threshold: t.availabilityMin,
			message: `Availability ${(health.availability * 100).toFixed(1)}% is below ${(t.availabilityMin * 100).toFixed(0)}% threshold`,
			detectedAt: now
		});
	}

	// Probe success check
	if (health.probeSuccess < t.probeSuccessMin) {
		alerts.push({
			agentId,
			alertType: 'probe_failure',
			severity: health.probeSuccess < 0.5 ? 'critical' : 'warning',
			currentValue: health.probeSuccess,
			threshold: t.probeSuccessMin,
			message: `Probe success rate ${(health.probeSuccess * 100).toFixed(1)}% is below ${(t.probeSuccessMin * 100).toFixed(0)}% threshold`,
			detectedAt: now
		});
	}

	// Latency check
	if (health.p95LatencyMs > t.p95LatencyMaxMs) {
		alerts.push({
			agentId,
			alertType: 'latency_spike',
			severity: health.p95LatencyMs > t.p95LatencyMaxMs * 2 ? 'critical' : 'warning',
			currentValue: health.p95LatencyMs,
			threshold: t.p95LatencyMaxMs,
			message: `P95 latency ${health.p95LatencyMs}ms exceeds ${t.p95LatencyMaxMs}ms threshold`,
			detectedAt: now
		});
	}

	// Reputation check
	if (health.reputation < t.reputationMin) {
		alerts.push({
			agentId,
			alertType: 'reputation_drop',
			severity: health.reputation < 0.3 ? 'critical' : 'warning',
			currentValue: health.reputation,
			threshold: t.reputationMin,
			message: `Reputation ${health.reputation.toFixed(3)} is below ${t.reputationMin} threshold`,
			detectedAt: now
		});
	}

	return alerts;
}

/**
 * Evaluate time-series for anomalies using trends.ts z-score detection.
 *
 * Uses `anomalyZScoreThreshold` from thresholds (default 2.5) for severity:
 *   - Critical: z_score ≥ 2× threshold
 *   - Warning:  z_score ≥ threshold (but below critical)
 */
export function evaluateAnomalies(
	agentId: string,
	recentValues: number[],
	metricName: string,
	thresholds?: Partial<AlertThresholds>
): Alert[] {
	const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
	const anomalies = detectAnomalies(recentValues);
	const now = Math.floor(Date.now() / 1000);

	return anomalies.map((a) => ({
		agentId,
		alertType: 'anomaly_detected' as const,
		severity: (a.z_score >= t.anomalyZScoreThreshold * 2 ? 'critical' : 'warning') as
			| 'critical'
			| 'warning',
		currentValue: a.value,
		threshold: t.anomalyZScoreThreshold,
		message: `Anomaly in ${metricName}: value ${a.value} at index ${a.index} (z-score: ${a.z_score})`,
		detectedAt: now
	}));
}

/**
 * Dispatch alerts as webhook events via inline delivery.
 */
export async function dispatchAlerts(
	db: DbClient,
	alerts: Alert[]
): Promise<{ dispatched: number }> {
	let dispatched = 0;

	for (const alert of alerts) {
		try {
			const { dispatchEvent } = await import('$lib/services/webhooks/service');
			await dispatchEvent(db, 'degraded', {
				agent_id: alert.agentId,
				alert_type: alert.alertType,
				severity: alert.severity,
				current_value: alert.currentValue,
				threshold: alert.threshold
			});
			dispatched++;
		} catch {
			// Webhook dispatch failed for this alert — skip and continue with remaining alerts.
			// Transient failures shouldn't block other alerts from dispatching.
			continue;
		}
	}

	return { dispatched };
}
