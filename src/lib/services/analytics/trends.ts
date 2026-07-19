/**
 * Trends Computation — Agent Beta Phase 3
 *
 * Pure statistical utilities for analyzing behavior metric time series.
 * No DB access — operates only on in-memory number arrays.
 *
 * Exports:
 *   computeTrend(values)        — linear regression → slope + direction
 *   detectAnomalies(values)     — 2-sigma outlier detection
 *   movingAverage(values, win)  — simple moving average smoothing
 *   formatTrendSummary(trend)   — human-readable summary string
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = 'improving' | 'declining' | 'stable';

export interface TrendResult {
	/** Slope of the linear regression line (unit change per period). */
	slope: number;
	/** Direction category based on slope magnitude. */
	direction: TrendDirection;
	/** R² goodness-of-fit (0–1). */
	r_squared: number;
	/** Number of data points used. */
	n: number;
}

export interface AnomalyResult {
	/** Index of the anomalous value in the original array. */
	index: number;
	/** The anomalous value. */
	value: number;
	/** How many standard deviations from the mean. */
	z_score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum absolute slope to consider non-stable. */
const SLOPE_THRESHOLD = 0.005;

/** Z-score threshold for anomaly detection (2 sigma). */
const ANOMALY_Z = 2.0;

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Compute a linear regression trend over an ordered series of values.
 *
 * Values are assumed to be in chronological order (index 0 = oldest).
 * Returns null if fewer than 2 data points.
 */
export function computeTrend(values: number[]): TrendResult | null {
	const n = values.length;
	if (n < 2) return null;

	// Simple linear regression: y = a + b*x  where x = 0, 1, 2, ...
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;
	let sumY2 = 0;

	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += values[i];
		sumXY += i * values[i];
		sumX2 += i * i;
		sumY2 += values[i] * values[i];
	}

	const denom = n * sumX2 - sumX * sumX;
	if (denom === 0) return { slope: 0, direction: 'stable', r_squared: 0, n };

	const slope = (n * sumXY - sumX * sumY) / denom;

	// R² calculation
	const meanY = sumY / n;
	const ssTot = sumY2 - n * meanY * meanY;
	const ssRes = ssTot - (slope * slope * denom) / n;
	const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

	let direction: TrendDirection = 'stable';
	if (slope > SLOPE_THRESHOLD) direction = 'improving';
	else if (slope < -SLOPE_THRESHOLD) direction = 'declining';

	return {
		slope: Math.round(slope * 1e6) / 1e6,
		direction,
		r_squared: Math.round(rSquared * 1e4) / 1e4,
		n
	};
}

/**
 * Detect anomalous values using 2-sigma (z-score) method.
 *
 * Returns indices and values that deviate more than {@link ANOMALY_Z}
 * standard deviations from the mean. Returns empty array for < 3 points.
 */
export function detectAnomalies(values: number[]): AnomalyResult[] {
	if (values.length < 3) return [];

	const n = values.length;
	const mean = values.reduce((s, v) => s + v, 0) / n;
	const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
	const stdDev = Math.sqrt(variance);

	if (stdDev === 0) return [];

	const anomalies: AnomalyResult[] = [];
	for (let i = 0; i < n; i++) {
		const z = Math.abs(values[i] - mean) / stdDev;
		if (z > ANOMALY_Z) {
			anomalies.push({
				index: i,
				value: values[i],
				z_score: Math.round(z * 100) / 100
			});
		}
	}
	return anomalies;
}

/**
 * Compute a simple moving average over a window of values.
 *
 * Output length = input length. Leading values with insufficient
 * history use whatever data is available (partial window).
 */
export function movingAverage(values: number[], window: number): number[] {
	if (values.length === 0 || window < 1) return [];
	const w = Math.min(window, values.length);
	const result: number[] = [];
	let sum = 0;

	for (let i = 0; i < values.length; i++) {
		sum += values[i];
		if (i >= w) sum -= values[i - w];
		const count = Math.min(i + 1, w);
		result.push(Math.round((sum / count) * 1e4) / 1e4);
	}

	return result;
}

/**
 * Format a trend result into a human-readable summary string.
 */
export function formatTrendSummary(trend: TrendResult | null): string {
	if (!trend) return 'Insufficient data for trend analysis.';

	const dir =
		trend.direction === 'improving'
			? '📈 Improving'
			: trend.direction === 'declining'
				? '📉 Declining'
				: '➡️ Stable';

	const slopeAbs = Math.abs(trend.slope);
	const rate = slopeAbs < 0.01 ? 'slowly' : slopeAbs < 0.05 ? 'moderately' : 'rapidly';

	return `${dir} (${rate}) over ${trend.n} periods — slope ${trend.slope}, R² ${trend.r_squared}`;
}
