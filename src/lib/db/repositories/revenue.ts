/**
 * Revenue Repository — typed data access for revenue_splits, revenue_shares,
 * and revenue_settlements tables.
 * Phase 5 — Agent Bravo
 */

import { eq, sql, desc } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	revenueSplits,
	revenueShares,
	revenueSettlements,
	type NewRevenueSplitRecord,
	type NewRevenueShareRecord,
	type NewRevenueSettlementRecord
} from '../schema';

// ===================================================================
// Revenue Splits
// ===================================================================

/** Create a revenue split configuration */
export async function createRevenueSplit(
	db: DbClient,
	data: NewRevenueSplitRecord
): Promise<string> {
	await db.insert(revenueSplits).values(data);
	return data.id;
}

/** Get a revenue split by ID */
export async function getRevenueSplit(db: DbClient, id: string) {
	return (
		(await db.query.revenueSplits.findFirst({
			where: eq(revenueSplits.id, id)
		})) ?? null
	);
}

/** Get active splits for an agent */
export async function getActiveSplitsForAgent(db: DbClient, agentId: string) {
	return await db
		.select()
		.from(revenueSplits)
		.where(sql`${revenueSplits.agentId} = ${agentId} AND ${revenueSplits.status} = 'active'`);
}

/** Get active splits for a developer */
export async function getActiveSplitsForDeveloper(db: DbClient, developerId: string) {
	return await db
		.select()
		.from(revenueSplits)
		.where(
			sql`${revenueSplits.developerId} = ${developerId} AND ${revenueSplits.status} = 'active'`
		);
}

/** Deactivate a split */
export async function deactivateSplit(db: DbClient, id: string): Promise<void> {
	await db
		.update(revenueSplits)
		.set({ status: 'inactive', effectiveTo: Math.floor(Date.now() / 1000) })
		.where(eq(revenueSplits.id, id));
}

// ===================================================================
// Revenue Shares
// ===================================================================

/** Create a revenue share record */
export async function createRevenueShare(
	db: DbClient,
	data: NewRevenueShareRecord
): Promise<string> {
	await db.insert(revenueShares).values(data);
	return data.id;
}

/** Get revenue shares for a split */
export async function getSharesForSplit(db: DbClient, splitId: string) {
	return await db
		.select()
		.from(revenueShares)
		.where(eq(revenueShares.splitId, splitId))
		.orderBy(desc(revenueShares.createdAt));
}

/** Get pending revenue shares for a developer (across all splits) */
export async function getPendingSharesForDeveloper(db: DbClient, developerId: string) {
	return await db
		.select({
			share: revenueShares,
			split: revenueSplits
		})
		.from(revenueShares)
		.innerJoin(revenueSplits, eq(revenueShares.splitId, revenueSplits.id))
		.where(
			sql`${revenueSplits.developerId} = ${developerId} AND ${revenueShares.status} = 'pending'`
		);
}

/** Mark shares as settled */
export async function markSharesSettled(
	db: DbClient,
	shareIds: string[],
	settlementId: string
): Promise<void> {
	for (const id of shareIds) {
		await db
			.update(revenueShares)
			.set({ status: `settled:${settlementId}` })
			.where(eq(revenueShares.id, id));
	}
}

// ===================================================================
// Revenue Settlements
// ===================================================================

/** Create a settlement record */
export async function createSettlement(
	db: DbClient,
	data: NewRevenueSettlementRecord
): Promise<string> {
	await db.insert(revenueSettlements).values(data);
	return data.id;
}

/** Get settlements for a developer */
export async function getSettlementsForDeveloper(db: DbClient, developerId: string) {
	return await db
		.select()
		.from(revenueSettlements)
		.where(eq(revenueSettlements.developerId, developerId))
		.orderBy(desc(revenueSettlements.createdAt));
}

/** Mark a settlement as completed */
export async function completeSettlement(db: DbClient, id: string): Promise<void> {
	await db
		.update(revenueSettlements)
		.set({ status: 'completed', settledAt: Math.floor(Date.now() / 1000) })
		.where(eq(revenueSettlements.id, id));
}
