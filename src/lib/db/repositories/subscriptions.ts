/**
 * Subscription Repository — typed data access for subscriptions
 * and subscription_events tables.
 *
 * Phase 5 — Agent Charlie (D6)
 */

import { eq, and, sql, lte } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	subscriptions,
	subscriptionEvents,
	type NewSubscriptionRecord,
	type NewSubscriptionEventRecord
} from '../schema';

// ===================================================================
// Subscriptions
// ===================================================================

/** Insert a new subscription */
export async function createSubscription(db: DbClient, data: NewSubscriptionRecord) {
	await db.insert(subscriptions).values(data);
	return await db.query.subscriptions.findFirst({
		where: eq(subscriptions.id, data.id!)
	});
}

/** Get subscription by ID */
export async function getSubscriptionById(db: DbClient, id: string) {
	return (
		(await db.query.subscriptions.findFirst({
			where: eq(subscriptions.id, id)
		})) ?? null
	);
}

/** Get active subscription for a key */
export async function getActiveSubscription(db: DbClient, keyId: string) {
	return (
		(await db.query.subscriptions.findFirst({
			where: and(eq(subscriptions.keyId, keyId), eq(subscriptions.status, 'active'))
		})) ?? null
	);
}

/** Get subscriptions expiring before a given timestamp with auto_renew enabled */
export async function getExpiringSubscriptions(db: DbClient, threshold: number) {
	return await db
		.select()
		.from(subscriptions)
		.where(
			and(
				eq(subscriptions.status, 'active'),
				eq(subscriptions.autoRenew, 1),
				lte(subscriptions.periodEnd, threshold)
			)
		);
}

/** Update subscription fields */
export async function updateSubscription(
	db: DbClient,
	id: string,
	data: Partial<{
		plan: string;
		status: string;
		periodEnd: number;
		autoRenew: number;
		cancelledAt: number | null;
	}>
) {
	return await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

/** Update subscription status */
export async function updateSubscriptionStatus(db: DbClient, id: string, status: string) {
	return await db.update(subscriptions).set({ status }).where(eq(subscriptions.id, id));
}

// ===================================================================
// Subscription Events
// ===================================================================

/** Log a subscription event */
export async function logSubscriptionEvent(db: DbClient, event: NewSubscriptionEventRecord) {
	return await db.insert(subscriptionEvents).values(event);
}

/** Get events for a subscription */
export async function getSubscriptionEvents(db: DbClient, subscriptionId: string) {
	return await db
		.select()
		.from(subscriptionEvents)
		.where(eq(subscriptionEvents.subscriptionId, subscriptionId))
		.orderBy(sql`created_at DESC`);
}
