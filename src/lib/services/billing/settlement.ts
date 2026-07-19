/**
 * Settlement Service — Phase 5 (Agent Bravo)
 *
 * Settles pending revenue shares into payable settlement records.
 * Aggregates all pending shares for a developer into a single settlement.
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import {
	getPendingSharesForDeveloper,
	markSharesSettled,
	createSettlement,
	getSettlementsForDeveloper,
	completeSettlement
} from '$lib/db/repositories/revenue';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'settlement');

// ===================================================================
// Settlement
// ===================================================================

/**
 * Create a settlement for all pending revenue shares for a developer.
 *
 * 1. Find all pending shares for the developer
 * 2. Sum the developer share amounts
 * 3. Create a settlement record
 * 4. Mark all shares as settled
 *
 * Returns null if no pending shares exist.
 */
export async function settleDeveloper(
	db: DbClient,
	developerId: string
): Promise<{ settlementId: string; totalNp: number; sharesCount: number } | null> {
	const pending = await getPendingSharesForDeveloper(db, developerId);

	if (pending.length === 0) {
		log.info('settleDeveloper', 'No pending shares to settle', { developerId });
		return null;
	}

	const totalNp = pending.reduce((sum, p) => sum + p.share.developerShareNp, 0);
	const shareIds = pending.map((p) => p.share.id);
	const settlementId = nanoid();

	// Create the settlement
	await createSettlement(db, {
		id: settlementId,
		developerId,
		totalNp,
		sharesCount: shareIds.length,
		status: 'pending'
	});

	// Mark all shares as settled
	await markSharesSettled(db, shareIds, settlementId);

	log.info('settleDeveloper', 'Settlement created', {
		settlementId,
		developerId,
		totalNp,
		sharesCount: shareIds.length
	});

	return { settlementId, totalNp, sharesCount: shareIds.length };
}

/**
 * Mark a settlement as paid/completed.
 */
export async function markSettlementComplete(db: DbClient, settlementId: string): Promise<void> {
	await completeSettlement(db, settlementId);
	log.info('markSettlementComplete', 'Settlement completed', { settlementId });
}

/**
 * Get settlement history for a developer.
 */
export async function getSettlementHistory(db: DbClient, developerId: string) {
	const settlements = await getSettlementsForDeveloper(db, developerId);
	const totalSettled = settlements
		.filter((s) => s.status === 'completed')
		.reduce((sum, s) => sum + s.totalNp, 0);
	const totalPending = settlements
		.filter((s) => s.status === 'pending')
		.reduce((sum, s) => sum + s.totalNp, 0);

	return {
		developerId,
		settlements,
		totalSettledNp: totalSettled,
		totalPendingNp: totalPending,
		count: settlements.length
	};
}
