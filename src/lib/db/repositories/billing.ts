/**
 * Billing Repository — typed data access for billing_periods and billing_line_items tables.
 * Phase 5 — Agent Bravo
 */

import { eq, sql, desc } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	billingPeriods,
	billingLineItems,
	type NewBillingPeriodRecord,
	type NewBillingLineItemRecord
} from '../schema';

// ===================================================================
// Billing Periods
// ===================================================================

/** Insert a new billing period */
export async function createBillingPeriod(
	db: DbClient,
	data: NewBillingPeriodRecord
): Promise<string> {
	await db.insert(billingPeriods).values(data);
	return data.id;
}

/** Get a billing period by ID */
export async function getBillingPeriod(db: DbClient, id: string) {
	return (
		(await db.query.billingPeriods.findFirst({
			where: eq(billingPeriods.id, id)
		})) ?? null
	);
}

/** Get the current open billing period for a key */
export async function getOpenPeriodForKey(db: DbClient, keyId: string) {
	return (
		(await db.query.billingPeriods.findFirst({
			where: sql`${billingPeriods.keyId} = ${keyId} AND ${billingPeriods.status} = 'open'`
		})) ?? null
	);
}

/** Close a billing period — set status to 'closed' and record timestamp */
export async function closeBillingPeriod(db: DbClient, id: string): Promise<void> {
	await db
		.update(billingPeriods)
		.set({
			status: 'closed',
			closedAt: Math.floor(Date.now() / 1000)
		})
		.where(eq(billingPeriods.id, id));
}

/** Increment usage counters on a billing period. Returns the new total_calls value. */
export async function incrementUsage(
	db: DbClient,
	periodId: string,
	calls: number
): Promise<number> {
	const result = await db
		.update(billingPeriods)
		.set({
			totalCalls: sql`total_calls + ${calls}`
		})
		.where(eq(billingPeriods.id, periodId))
		.returning({ totalCalls: billingPeriods.totalCalls });
	return result[0]?.totalCalls ?? 0;
}

/** Update overage counters on a billing period */
export async function updateOverage(
	db: DbClient,
	periodId: string,
	overageCalls: number,
	overageChargeNp: number
): Promise<void> {
	await db
		.update(billingPeriods)
		.set({
			overageCalls: sql`${overageCalls}`,
			overageChargeNp: sql`${overageChargeNp}`
		})
		.where(eq(billingPeriods.id, periodId));
}

/** List billing periods for a key, ordered by period_start descending */
export async function listPeriods(db: DbClient, keyId: string, limit: number = 10) {
	return await db
		.select()
		.from(billingPeriods)
		.where(eq(billingPeriods.keyId, keyId))
		.orderBy(desc(billingPeriods.periodStart))
		.limit(limit);
}

/** Get open periods that have passed their end date (for sweep) */
export async function getExpiredOpenPeriods(db: DbClient, now: number) {
	return await db
		.select()
		.from(billingPeriods)
		.where(sql`${billingPeriods.status} = 'open' AND ${billingPeriods.periodEnd} <= ${now}`);
}

// ===================================================================
// Billing Line Items
// ===================================================================

/** Add a line item to a billing period */
export async function addLineItem(db: DbClient, item: NewBillingLineItemRecord): Promise<string> {
	await db.insert(billingLineItems).values(item);
	return item.id;
}

/** Get all line items for a billing period */
export async function getLineItems(db: DbClient, periodId: string) {
	return await db.select().from(billingLineItems).where(eq(billingLineItems.periodId, periodId));
}
