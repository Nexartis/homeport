/**
 * Monitoring Alerts Tests — pure function tests for alert evaluation.
 * No DB needed — tests evaluateAlerts and evaluateAnomalies directly.
 */
import { describe, it, expect } from 'vitest';
import { evaluateAlerts, evaluateAnomalies } from '../src/lib/services/monitoring/alerts';

// ---------- evaluateAlerts ----------

describe('evaluateAlerts', () => {
	it('returns no alerts when all metrics are healthy', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.99,
			probeSuccess: 0.95,
			p95LatencyMs: 200,
			reputation: 0.85
		});
		expect(alerts).toHaveLength(0);
	});

	it('returns availability_low warning when below threshold', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.7,
			probeSuccess: 0.95,
			p95LatencyMs: 200,
			reputation: 0.85
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('availability_low');
		expect(alerts[0].severity).toBe('warning');
		expect(alerts[0].currentValue).toBe(0.7);
	});

	it('returns availability_low critical when below 50%', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.3,
			probeSuccess: 0.95,
			p95LatencyMs: 200,
			reputation: 0.85
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('availability_low');
		expect(alerts[0].severity).toBe('critical');
	});

	it('returns probe_failure when probe success is low', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.99,
			probeSuccess: 0.6,
			p95LatencyMs: 200,
			reputation: 0.85
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('probe_failure');
		expect(alerts[0].severity).toBe('warning');
	});

	it('returns latency_spike when p95 exceeds threshold', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.99,
			probeSuccess: 0.95,
			p95LatencyMs: 8000,
			reputation: 0.85
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('latency_spike');
		expect(alerts[0].severity).toBe('warning');
	});

	it('returns latency_spike critical when p95 is 2x threshold', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.99,
			probeSuccess: 0.95,
			p95LatencyMs: 15000,
			reputation: 0.85
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('latency_spike');
		expect(alerts[0].severity).toBe('critical');
	});

	it('returns reputation_drop when reputation is low', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.99,
			probeSuccess: 0.95,
			p95LatencyMs: 200,
			reputation: 0.4
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('reputation_drop');
		expect(alerts[0].severity).toBe('warning');
	});

	it('returns reputation_drop critical when below 0.3', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.99,
			probeSuccess: 0.95,
			p95LatencyMs: 200,
			reputation: 0.2
		});
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('reputation_drop');
		expect(alerts[0].severity).toBe('critical');
	});

	it('returns multiple alerts when multiple thresholds violated', () => {
		const alerts = evaluateAlerts('agent-1', {
			availability: 0.3,
			probeSuccess: 0.4,
			p95LatencyMs: 15000,
			reputation: 0.1
		});
		expect(alerts).toHaveLength(4);
		const types = alerts.map((a) => a.alertType);
		expect(types).toContain('availability_low');
		expect(types).toContain('probe_failure');
		expect(types).toContain('latency_spike');
		expect(types).toContain('reputation_drop');
		// All should be critical at these levels
		for (const a of alerts) {
			expect(a.severity).toBe('critical');
		}
	});

	it('respects custom thresholds', () => {
		const alerts = evaluateAlerts(
			'agent-1',
			{ availability: 0.96, probeSuccess: 0.95, p95LatencyMs: 200, reputation: 0.85 },
			{ availabilityMin: 0.99 }
		);
		expect(alerts).toHaveLength(1);
		expect(alerts[0].alertType).toBe('availability_low');
	});
});

// ---------- evaluateAnomalies ----------

describe('evaluateAnomalies', () => {
	it('returns no anomalies for stable values', () => {
		const values = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100];
		const anomalies = evaluateAnomalies('agent-1', values, 'latency');
		expect(anomalies).toHaveLength(0);
	});

	it('detects spike anomaly in otherwise stable series', () => {
		const values = [100, 100, 100, 100, 100, 100, 100, 100, 100, 500];
		const anomalies = evaluateAnomalies('agent-1', values, 'latency');
		expect(anomalies.length).toBeGreaterThan(0);
		expect(anomalies[0].alertType).toBe('anomaly_detected');
		expect(anomalies[0].message).toContain('latency');
	});

	it('returns empty for fewer than 3 data points', () => {
		const anomalies = evaluateAnomalies('agent-1', [100, 200], 'latency');
		expect(anomalies).toHaveLength(0);
	});
});
