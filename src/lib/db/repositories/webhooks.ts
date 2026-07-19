/**
 * Webhook Subscriptions Repository — Phase 4 (Agent Beta)
 *
 * CRUD operations for webhook subscriptions using Drizzle ORM.
 * Uses the webhookSubscriptions table from schema.ts.
 */

import { eq, desc, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	webhookSubscriptions,
	type WebhookSubscription,
	type NewWebhookSubscription
} from '../schema';

// Re-export schema types for consumers
export type { WebhookSubscription, NewWebhookSubscription };

// ===================================================================
// Insert / Get / List
// ===================================================================

export async function insertWebhookSubscription(
	db: DbClient,
	sub: NewWebhookSubscription
): Promise<void> {
	await db.insert(webhookSubscriptions).values(sub);
}

export async function getWebhookSubscription(
	db: DbClient,
	id: string
): Promise<WebhookSubscription | null> {
	const result = await db.query.webhookSubscriptions.findFirst({
		where: eq(webhookSubscriptions.id, id)
	});
	return result ?? null;
}

export async function listWebhookSubscriptions(
	db: DbClient,
	ownerId?: string
): Promise<WebhookSubscription[]> {
	if (ownerId) {
		return await db.query.webhookSubscriptions.findMany({
			where: eq(webhookSubscriptions.ownerId, ownerId),
			orderBy: [desc(webhookSubscriptions.createdAt)]
		});
	}
	return await db.query.webhookSubscriptions.findMany({
		orderBy: [desc(webhookSubscriptions.createdAt)]
	});
}

/**
 * List active subscriptions that match a given event type.
 * Uses json_each() to search the JSON array stored in the `events` column.
 * Note: This requires raw SQL because Drizzle ORM doesn't support json_each() natively.
 */
export async function listActiveSubscriptionsForEvent(
	db: DbClient,
	eventType: string
): Promise<WebhookSubscription[]> {
	return await db.all<WebhookSubscription>(
		sql`SELECT ws.* FROM webhook_subscriptions ws, json_each(ws.events) je
			WHERE ws.status = 'active' AND je.value = ${eventType}`
	);
}

// ===================================================================
// Update / Delete
// ===================================================================

export async function updateWebhookSubscription(
	db: DbClient,
	id: string,
	data: { status?: string; callbackUrl?: string; events?: string }
): Promise<void> {
	const updates: Partial<WebhookSubscription> = {};
	if (data.status !== undefined) updates.status = data.status;
	if (data.callbackUrl !== undefined) updates.callbackUrl = data.callbackUrl;
	if (data.events !== undefined) updates.events = data.events;

	if (Object.keys(updates).length > 0) {
		await db.update(webhookSubscriptions).set(updates).where(eq(webhookSubscriptions.id, id));
	}
}

export async function deleteWebhookSubscription(db: DbClient, id: string): Promise<void> {
	await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));
}

// ===================================================================
// Failure Tracking
// ===================================================================

export async function incrementFailureCount(db: DbClient, id: string): Promise<void> {
	await db
		.update(webhookSubscriptions)
		.set({ failureCount: sql`${webhookSubscriptions.failureCount} + 1` })
		.where(eq(webhookSubscriptions.id, id));
}

export async function resetFailureCount(db: DbClient, id: string): Promise<void> {
	await db
		.update(webhookSubscriptions)
		.set({ failureCount: 0 })
		.where(eq(webhookSubscriptions.id, id));
}

export async function updateLastDelivered(db: DbClient, id: string): Promise<void> {
	await db
		.update(webhookSubscriptions)
		.set({ lastDeliveredAt: sql`(unixepoch())` })
		.where(eq(webhookSubscriptions.id, id));
}

export async function disableSubscription(db: DbClient, id: string): Promise<void> {
	await db
		.update(webhookSubscriptions)
		.set({ status: 'disabled' })
		.where(eq(webhookSubscriptions.id, id));
}
