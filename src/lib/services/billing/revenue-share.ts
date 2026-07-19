/**
 * Revenue Sharing Service — Phase 5 (Agent Bravo)
 *
 * Computes developer revenue shares from closed billing periods.
 * Default split: 70% developer / 30% platform.
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import {
	createRevenueSplit,
	getActiveSplitsForAgent,
	getActiveSplitsForDeveloper,
	createRevenueShare,
	getPendingSharesForDeveloper
} from '$lib/db/repositories/revenue';
import { getBillingPeriod } from '$lib/db/repositories/billing';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'revenue-share');

/** Default developer split percentage */
export const DEFAULT_SPLIT_PCT = 70;

// ===================================================================
// Split Management
// ===================================================================

/**
 * Register a revenue split for an agent owned by a developer.
 * Defaults to 70/30 split (developer/platform).
 */
export async function registerSplit(
	db: DbClient,
	agentId: string,
	developerId: string,
	splitPct: number = DEFAULT_SPLIT_PCT
): Promise<string> {
	const id = nanoid();
	await createRevenueSplit(db, {
		id,
		agentId,
		developerId,
		splitPct,
		effectiveFrom: Math.floor(Date.now() / 1000),
		status: 'active'
	});

	log.info('registerSplit', 'Revenue split registered', {
		id,
		agentId,
		developerId,
		splitPct
	});

	return id;
}

// ===================================================================
// Revenue Computation
// ===================================================================

/**
 * Compute revenue shares for a closed billing period.
 *
 * For each active split on the agent that generated the billing period,
 * compute the developer share and platform share based on overage charges.
 */
export async function computeSharesForPeriod(
	db: DbClient,
	periodId: string,
	agentId: string
): Promise<{ shares: number; totalDeveloperNp: number; totalPlatformNp: number }> {
	const period = await getBillingPeriod(db, periodId);
	if (!period) {
		log.warn('computeSharesForPeriod', 'Period not found', { periodId });
		return { shares: 0, totalDeveloperNp: 0, totalPlatformNp: 0 };
	}

	if (period.status === 'open') {
		log.warn('computeSharesForPeriod', 'Period still open — skip', { periodId });
		return { shares: 0, totalDeveloperNp: 0, totalPlatformNp: 0 };
	}

	const splits = await getActiveSplitsForAgent(db, agentId);
	if (splits.length === 0) {
		log.info('computeSharesForPeriod', 'No active splits for agent', { agentId });
		return { shares: 0, totalDeveloperNp: 0, totalPlatformNp: 0 };
	}

	// Gross revenue = overage charge from the billing period
	const grossRevenue = period.overageChargeNp;
	if (grossRevenue <= 0) {
		return { shares: 0, totalDeveloperNp: 0, totalPlatformNp: 0 };
	}

	let totalDeveloperNp = 0;
	let totalPlatformNp = 0;

	for (const split of splits) {
		const developerShare = Math.floor((grossRevenue * split.splitPct) / 100);
		const platformShare = grossRevenue - developerShare;

		await createRevenueShare(db, {
			id: nanoid(),
			splitId: split.id,
			periodId,
			grossRevenueNp: grossRevenue,
			developerShareNp: developerShare,
			platformShareNp: platformShare,
			status: 'pending'
		});

		totalDeveloperNp += developerShare;
		totalPlatformNp += platformShare;
	}

	log.info('computeSharesForPeriod', 'Shares computed', {
		periodId,
		agentId,
		shares: splits.length,
		totalDeveloperNp,
		totalPlatformNp
	});

	return { shares: splits.length, totalDeveloperNp, totalPlatformNp };
}

/**
 * Get earnings summary for a developer — pending and historical.
 */
export async function getDeveloperEarnings(db: DbClient, developerId: string) {
	const pending = await getPendingSharesForDeveloper(db, developerId);
	const splits = await getActiveSplitsForDeveloper(db, developerId);

	const pendingTotal = pending.reduce((sum, p) => sum + p.share.developerShareNp, 0);

	return {
		developerId,
		activeSplits: splits.length,
		pendingShares: pending.length,
		pendingTotalNp: pendingTotal,
		shares: pending.map((p) => ({
			shareId: p.share.id,
			splitId: p.share.splitId,
			agentId: p.split.agentId,
			grossRevenueNp: p.share.grossRevenueNp,
			developerShareNp: p.share.developerShareNp,
			platformShareNp: p.share.platformShareNp,
			status: p.share.status
		}))
	};
}
