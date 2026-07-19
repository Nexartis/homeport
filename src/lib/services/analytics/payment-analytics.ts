/**
 * Payment Analytics Aggregation Service — Agent Delta Phase 5
 *
 * Aggregates payment data from billing, revenue, subscription, and
 * audit tables into a unified dashboard response.
 *
 * Exports:
 *   aggregatePaymentAnalytics(db, range) — main aggregation entry point
 *   bucketTimeSeries(rows, bucketSize)   — time-series bucketing helper
 *   computePeriodComparison(current, previous) — percent change helper
 */

import type { DbClient } from '$lib/db/client';
import { sql } from 'drizzle-orm';
import { auditWallets, auditSettlements } from '$lib/db/schema';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'payment-analytics');

// ---------------------------------------------------------------------------
// Types (mirrors KYM's payment-analytics.ts types)
// ---------------------------------------------------------------------------

export interface TimeSeries {
	label: string;
	data: { timestamp: number; value: number }[];
}

export interface DashboardData {
	overview: {
		totalRevenueNp: number;
		totalRevenueUsd: number;
		activeSubscriptions: number;
		npInCirculation: number;
		usdcSettled: number;
		periodComparison: { revenueChange: number; subscriptionChange: number };
	};
	usage: {
		totalCalls: number;
		callsByTier: { tier: string; calls: number; overage: number }[];
		topConsumers: { keyIdMasked: string; calls: number; chargeNp: number }[];
		overageRevenue: number;
	};
	revenue: {
		totalDeveloperPayouts: number;
		totalPlatformTake: number;
		perAgentEarnings: { agentId: string; agentName: string; earningsNp: number; calls: number }[];
		recentPayouts: { agentId: string; amountNp: number; settledAt: number }[];
	};
	payments: {
		challengeSuccessRate: number;
		totalChallenges: number;
		verifiedChallenges: number;
		failedChallenges: number;
		paymentMethodBreakdown: { method: string; count: number; volumeUsd: number }[];
		recentPayments: { txHash: string; amountUsd: number; action: string; createdAt: number }[];
	};
	revenueSeries: TimeSeries;
	usageSeries: TimeSeries;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute percent change between two periods.
 * Returns 0 when both values are 0, 100 when previous is 0 but current > 0.
 */
export function computePeriodComparison(current: number, previous: number): number {
	if (previous === 0 && current === 0) return 0;
	if (previous === 0) return 100;
	return Math.round(((current - previous) / previous) * 100);
}

/**
 * Bucket raw time-series data into uniform intervals.
 */
export function bucketTimeSeries(
	rows: { timestamp: number; value: number }[],
	bucketSize: 'hour' | 'day' | 'week' | 'month'
): TimeSeries {
	if (rows.length === 0) {
		return { label: bucketSize, data: [] };
	}

	const bucketMs: Record<string, number> = {
		hour: 60 * 60 * 1000,
		day: 24 * 60 * 60 * 1000,
		week: 7 * 24 * 60 * 60 * 1000,
		month: 30 * 24 * 60 * 60 * 1000
	};

	const interval = bucketMs[bucketSize];
	const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
	const minTs = sorted[0].timestamp;
	const maxTs = sorted[sorted.length - 1].timestamp;

	const bucketStart = Math.floor(minTs / interval) * interval;
	const bucketEnd = Math.floor(maxTs / interval) * interval + interval;
	const buckets = new Map<number, number>();

	for (let ts = bucketStart; ts < bucketEnd; ts += interval) {
		buckets.set(ts, 0);
	}

	for (const row of sorted) {
		const key = Math.floor(row.timestamp / interval) * interval;
		buckets.set(key, (buckets.get(key) ?? 0) + row.value);
	}

	const data = Array.from(buckets.entries())
		.sort(([a], [b]) => a - b)
		.map(([timestamp, value]) => ({ timestamp, value }));

	return { label: bucketSize, data };
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate payment analytics data for the dashboard.
 * Queries existing audit tables and stubs billing/revenue data
 * until Bravo/Charlie tables are merged.
 */
export async function aggregatePaymentAnalytics(
	db: DbClient,
	range: string
): Promise<DashboardData> {
	const now = Date.now();
	const rangeMs: Record<string, number> = {
		'24h': 24 * 60 * 60 * 1000,
		'7d': 7 * 24 * 60 * 60 * 1000,
		'30d': 30 * 24 * 60 * 60 * 1000,
		'90d': 90 * 24 * 60 * 60 * 1000
	};
	const cutoff = rangeMs[range] ? now - rangeMs[range] : 0;
	const cutoffSec = Math.floor(cutoff / 1000);

	// Query existing audit tables for NP circulation and USDC settled
	let npInCirculation = 0;
	let usdcSettled = 0;

	try {
		const walletRows = await db
			.select({ balance: sql<number>`COALESCE(SUM(${auditWallets.balanceMinor}), 0)` })
			.from(auditWallets)
			.where(sql`${auditWallets.currency} = 'NP'`);
		npInCirculation = walletRows[0]?.balance ?? 0;

		const settlementRows = await db
			.select({ total: sql<number>`COALESCE(SUM(${auditSettlements.amount}), 0)` })
			.from(auditSettlements)
			.where(sql`${auditSettlements.ts} >= ${cutoffSec}`);
		usdcSettled = settlementRows[0]?.total ?? 0;
	} catch (err) {
		log.error('aggregatePaymentAnalytics', 'Failed to query audit tables for analytics', {
			error: err instanceof Error ? err.message : String(err)
		});
	}

	// Return dashboard data — billing/revenue/subscription fields are stubbed
	// until Bravo's (D2/D3) and Charlie's (D6/D7) tables are merged
	return {
		overview: {
			totalRevenueNp: 0,
			totalRevenueUsd: 0,
			activeSubscriptions: 0,
			npInCirculation,
			usdcSettled,
			periodComparison: { revenueChange: 0, subscriptionChange: 0 }
		},
		usage: {
			totalCalls: 0,
			callsByTier: [],
			topConsumers: [],
			overageRevenue: 0
		},
		revenue: {
			totalDeveloperPayouts: 0,
			totalPlatformTake: 0,
			perAgentEarnings: [],
			recentPayouts: []
		},
		payments: {
			challengeSuccessRate: 0,
			totalChallenges: 0,
			verifiedChallenges: 0,
			failedChallenges: 0,
			paymentMethodBreakdown: [],
			recentPayments: []
		},
		revenueSeries: { label: 'day', data: [] },
		usageSeries: { label: 'day', data: [] }
	};
}
