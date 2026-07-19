/**
 * Usage Metering Service — Phase 5 (Agent Bravo)
 *
 * Tracks per-key API usage within billing periods, computes overages,
 * and returns metering results for the rate limiter to act on.
 *
 * Hot path: recordApiCall() is called on every metered API request.
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { BillingPeriodRecord } from '$lib/db/schema';
import {
	createBillingPeriod,
	getOpenPeriodForKey,
	incrementUsage,
	updateOverage
} from '$lib/db/repositories/billing';
import {
	type BillingTier,
	type MeteringResult,
	type OverageResult,
	type UsageSummary,
	TIER_CONFIGS
} from '$lib/types/billing';
import { createLogger } from '$lib/utils/logger';

const _log = createLogger(undefined, 'billing-metering');

// ===================================================================
// Overage Computation (pure function)
// ===================================================================

/**
 * Compute overage charges given total calls, included calls, and overage rate.
 * Pure math — no side effects.
 */
export function computeOverage(
	totalCalls: number,
	includedCalls: number,
	overageRateNp: number
): OverageResult {
	const overageCalls = Math.max(0, totalCalls - includedCalls);
	const chargeNp = Math.floor(overageCalls * overageRateNp);
	return { overageCalls, chargeNp };
}

// ===================================================================
// Billing Period Management
// ===================================================================

/**
 * Get the start/end of the current monthly billing period.
 * Periods run from 1st of month 00:00:00 UTC to 1st of next month 00:00:00 UTC.
 */
function getCurrentPeriodBounds(): { periodStart: number; periodEnd: number } {
	const now = new Date();
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
	return {
		periodStart: Math.floor(start.getTime() / 1000),
		periodEnd: Math.floor(end.getTime() / 1000)
	};
}

/**
 * Ensure an open billing period exists for the given key.
 * Creates one if none exists for the current month.
 */
export async function ensureOpenPeriod(
	db: DbClient,
	keyId: string,
	tier: BillingTier
): Promise<BillingPeriodRecord> {
	const existing = await getOpenPeriodForKey(db, keyId);
	const nowSec = Math.floor(Date.now() / 1000);
	// Only return existing period if it hasn't expired (periodEnd > now)
	if (existing && existing.periodEnd > nowSec) return existing;

	const config = TIER_CONFIGS[tier];
	const { periodStart, periodEnd } = getCurrentPeriodBounds();
	const id = nanoid();

	await createBillingPeriod(db, {
		id,
		keyId,
		tier,
		periodStart,
		periodEnd,
		totalCalls: 0,
		includedCalls: config.includedCalls,
		overageCalls: 0,
		overageChargeNp: 0,
		status: 'open'
	});

	// Return the freshly created period
	return {
		id,
		keyId,
		tier,
		periodStart,
		periodEnd,
		totalCalls: 0,
		includedCalls: config.includedCalls,
		overageCalls: 0,
		overageChargeNp: 0,
		status: 'open',
		createdAt: Math.floor(Date.now() / 1000),
		closedAt: null
	};
}

// ===================================================================
// Usage Summary
// ===================================================================

/**
 * Get current usage summary for a key.
 */
export async function getUsageSummary(db: DbClient, keyId: string): Promise<UsageSummary | null> {
	const period = await getOpenPeriodForKey(db, keyId);
	if (!period) return null;

	return {
		keyId: period.keyId,
		tier: period.tier as BillingTier,
		periodStart: period.periodStart,
		periodEnd: period.periodEnd,
		totalCalls: period.totalCalls,
		includedCalls: period.includedCalls,
		overageCalls: period.overageCalls,
		overageChargeNp: period.overageChargeNp,
		status: period.status as 'open' | 'closed' | 'invoiced'
	};
}

// ===================================================================
// Core Metering
// ===================================================================

/**
 * Record an API call for a key. This is the hot-path function.
 *
 * 1. Find or create the current billing period for the key
 * 2. Increment total_calls
 * 3. If total_calls > included_calls, compute overage and NP charge
 * 4. For free tier: block at limit (no overage allowed)
 *
 * Returns { allowed, overage, chargeNp, totalCalls, includedCalls }
 */
export async function recordApiCall(
	db: DbClient,
	keyId: string,
	tier: BillingTier
): Promise<MeteringResult> {
	const period = await ensureOpenPeriod(db, keyId, tier);
	const config = TIER_CONFIGS[tier];

	// Free tier: check limit before incrementing (avoid counting blocked calls)
	if (tier === 'free' && period.totalCalls + 1 > config.includedCalls) {
		return {
			allowed: false,
			overage: false,
			chargeNp: 0,
			totalCalls: period.totalCalls,
			includedCalls: config.includedCalls
		};
	}

	// Increment usage atomically and get the authoritative new total from DB
	const newTotal = await incrementUsage(db, period.id, 1);

	// Compute total overage using the authoritative total from DB (no race condition)
	const { overageCalls, chargeNp: totalChargeNp } = computeOverage(
		newTotal,
		config.includedCalls,
		config.overageRateNp
	);

	// Compute the incremental charge for THIS call only (handles fractional rates like 0.5 NP)
	const prevCharge = computeOverage(
		newTotal - 1,
		config.includedCalls,
		config.overageRateNp
	).chargeNp;
	const incrementalChargeNp = totalChargeNp - prevCharge;

	// Update overage counters if we're in overage territory
	if (overageCalls > 0) {
		await updateOverage(db, period.id, overageCalls, totalChargeNp);
	}

	return {
		allowed: true,
		overage: overageCalls > 0,
		chargeNp: incrementalChargeNp,
		totalCalls: newTotal,
		includedCalls: config.includedCalls
	};
}
