/**
 * Billing Service — Phase 5 (Agent Bravo)
 *
 * Handles billing period lifecycle: closing periods, generating line items,
 * sweeping expired periods.
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { BillingPeriodRecord } from '$lib/db/schema';
import {
	getBillingPeriod,
	closeBillingPeriod,
	addLineItem,
	getExpiredOpenPeriods,
	listPeriods
} from '$lib/db/repositories/billing';
import { type BillingTier, TIER_CONFIGS } from '$lib/types/billing';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'billing-service');

// ===================================================================
// Line Item Generation
// ===================================================================

/**
 * Generate line items for a billing period based on usage.
 * Creates overage line items or a zero-cost included-usage line.
 */
export async function generateLineItems(db: DbClient, period: BillingPeriodRecord): Promise<void> {
	const tier = period.tier as BillingTier;
	const config = TIER_CONFIGS[tier];

	if (period.overageCalls > 0 && config.overageRateNp > 0) {
		// Overage line item
		await addLineItem(db, {
			id: nanoid(),
			periodId: period.id,
			description: `API overage: ${period.overageCalls} calls beyond ${config.includedCalls} included (${tier} tier)`,
			quantity: period.overageCalls,
			unitPriceNp: config.overageRateNp,
			totalNp: period.overageChargeNp,
			category: 'overage'
		});
	} else {
		// Within-limit line item (zero cost)
		await addLineItem(db, {
			id: nanoid(),
			periodId: period.id,
			description: `API usage: ${period.totalCalls} of ${config.includedCalls} included calls (${tier} tier)`,
			quantity: period.totalCalls,
			unitPriceNp: 0,
			totalNp: 0,
			category: 'base'
		});
	}
}

// ===================================================================
// Period Lifecycle
// ===================================================================

/**
 * Close a billing period: generate line items and mark as closed.
 * No-op if already closed.
 */
export async function closePeriod(db: DbClient, periodId: string): Promise<{ closed: boolean }> {
	const period = await getBillingPeriod(db, periodId);
	if (!period) {
		log.warn('closePeriod', 'Period not found', { periodId });
		return { closed: false };
	}

	if (period.status !== 'open') {
		log.info('closePeriod', 'Period already closed — skipping', {
			periodId,
			status: period.status
		});
		return { closed: false };
	}

	await generateLineItems(db, period);
	await closeBillingPeriod(db, periodId);

	log.info('closePeriod', 'Period closed', {
		periodId,
		totalCalls: period.totalCalls,
		overageCalls: period.overageCalls,
		overageChargeNp: period.overageChargeNp
	});

	return { closed: true };
}

/**
 * Sweep all open periods whose end date has passed.
 * Called by cron to auto-close expired billing periods.
 */
export async function closeExpiredPeriods(db: DbClient): Promise<{ closed: number }> {
	const now = Math.floor(Date.now() / 1000);
	const expired = await getExpiredOpenPeriods(db, now);

	let closed = 0;
	for (const period of expired) {
		const result = await closePeriod(db, period.id);
		if (result.closed) closed++;
	}

	if (closed > 0) {
		log.info('closeExpiredPeriods', `Closed ${closed} expired billing periods`, { closed });
	}

	return { closed };
}

/**
 * Get billing summary for a key — current period + history.
 */
export async function getBillingSummary(
	db: DbClient,
	keyId: string,
	includeHistory: boolean = false
) {
	const periods = await listPeriods(db, keyId, includeHistory ? 12 : 1);
	const current = periods.find((p) => p.status === 'open') ?? null;

	return {
		keyId,
		current,
		periods: includeHistory ? periods : undefined,
		totalPeriods: periods.length
	};
}
