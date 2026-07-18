/**
 * Webhook Service — Phase 4 (Agent Beta)
 *
 * Subscription management, HMAC-SHA256 signing, URL validation,
 * and inline webhook event dispatch (queue-free architecture).
 */

import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import {
	insertWebhookSubscription,
	getWebhookSubscription,
	listWebhookSubscriptions,
	listActiveSubscriptionsForEvent,
	updateWebhookSubscription,
	deleteWebhookSubscription,
	type WebhookSubscription
} from '$lib/db/repositories/webhooks';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'webhook-service');

// ===================================================================
// Types
// ===================================================================

/** Message shape for webhook delivery (processed inline) */
export interface WebhookJobMessage {
	subscription_id: string;
	event_type: string;
	payload: Record<string, unknown>;
	idempotency_key: string;
}

// ===================================================================
// HMAC-SHA256 Signing
// ===================================================================

/**
 * Generate an HMAC-SHA256 signature for a webhook payload.
 * Returns `sha256={hex_digest}` format per webhook best practices.
 */
export function signPayload(payload: string, secret: string): string {
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(payload);
	return `sha256=${hmac.digest('hex')}`;
}

// ===================================================================
// Callback URL Validation
// ===================================================================

/**
 * Validate a webhook callback URL.
 * Must be HTTPS and not targeting localhost/internal addresses.
 */
export function validateCallbackUrl(url: string): { valid: boolean; reason?: string } {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { valid: false, reason: 'Invalid URL format' };
	}

	if (parsed.protocol !== 'https:') {
		return { valid: false, reason: 'Callback URL must use HTTPS' };
	}

	const hostname = parsed.hostname.toLowerCase();
	const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254.169.254'];
	if (blocked.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
		return { valid: false, reason: 'Callback URL must not target internal addresses' };
	}

	// Block RFC1918 private IP ranges and link-local addresses (SSRF mitigation)
	if (isPrivateIp(hostname)) {
		return { valid: false, reason: 'Callback URL must not target private/internal IP addresses' };
	}

	return { valid: true };
}

/** Check if a hostname is a private/reserved IP address */
function isPrivateIp(hostname: string): boolean {
	// IPv4 private ranges
	const ipv4Match = hostname.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)$/);
	if (ipv4Match) {
		const [, a, b] = ipv4Match.map(Number);
		// 10.0.0.0/8
		if (a === 10) return true;
		// 172.16.0.0/12
		if (a === 172 && b >= 16 && b <= 31) return true;
		// 192.168.0.0/16
		if (a === 192 && b === 168) return true;
		// 127.0.0.0/8 (loopback)
		if (a === 127) return true;
		// 169.254.0.0/16 (link-local)
		if (a === 169 && b === 254) return true;
		// 0.0.0.0/8
		if (a === 0) return true;
	}

	// IPv6 private/link-local (bracketed form in URLs)
	const ipv6 = hostname.replace(/^\[|\]$/g, '');
	if (
		ipv6.startsWith('::1') ||
		ipv6.startsWith('fe80:') ||
		ipv6.startsWith('fc') ||
		ipv6.startsWith('fd')
	) {
		return true;
	}

	return false;
}

// ===================================================================
// Subscription Management
// ===================================================================

/**
 * Create a new webhook subscription.
 * Generates a cryptographic secret for HMAC signing and returns it to the caller.
 */
export async function createSubscription(
	db: DbClient,
	data: { callbackUrl: string; events: string[]; ownerId: string }
): Promise<{ id: string; secret: string }> {
	const urlCheck = validateCallbackUrl(data.callbackUrl);
	if (!urlCheck.valid) {
		throw new Error(`Invalid callback URL: ${urlCheck.reason}`);
	}

	const id = nanoid();
	const secret = crypto.randomBytes(32).toString('hex');

	await insertWebhookSubscription(db, {
		id,
		callbackUrl: data.callbackUrl,
		events: JSON.stringify(data.events),
		secret,
		ownerId: data.ownerId
	});

	return { id, secret };
}

/**
 * Remove a webhook subscription. Only the owner can delete.
 */
export async function removeSubscription(
	db: DbClient,
	id: string,
	ownerId: string
): Promise<boolean> {
	const sub = await getWebhookSubscription(db, id);
	if (!sub || sub.ownerId !== ownerId) return false;
	await deleteWebhookSubscription(db, id);
	return true;
}

/**
 * List all subscriptions for an owner.
 */
export async function listSubscriptions(
	db: DbClient,
	ownerId: string
): Promise<WebhookSubscription[]> {
	return listWebhookSubscriptions(db, ownerId);
}

/**
 * Pause a subscription (stops deliveries without deleting).
 */
export async function pauseSubscription(db: DbClient, id: string): Promise<void> {
	await updateWebhookSubscription(db, id, { status: 'paused' });
}

/**
 * Resume a paused subscription.
 */
export async function resumeSubscription(db: DbClient, id: string): Promise<void> {
	await updateWebhookSubscription(db, id, { status: 'active' });
}

// ===================================================================
// Event Dispatch
// ===================================================================

/**
 * Dispatch a webhook event to all active subscribers.
 * Delivers inline — no queue infrastructure required.
 */
export async function dispatchEvent(
	db: DbClient,
	eventType: string,
	payload: Record<string, unknown>
): Promise<{ dispatched: number }> {
	const subs = await listActiveSubscriptionsForEvent(db, eventType);

	if (subs.length === 0) {
		log.info('dispatchEvent', `No active subscriptions for event: ${eventType}`);
		return { dispatched: 0 };
	}

	// Lazy import to avoid circular dependency
	const { processWebhookDelivery } = await import('$lib/services/webhooks/delivery');

	let dispatched = 0;
	for (const sub of subs) {
		const message: WebhookJobMessage = {
			subscription_id: sub.id,
			event_type: eventType,
			payload,
			idempotency_key: nanoid()
		};

		try {
			const result = await processWebhookDelivery(db, message);
			if (result.delivered) {
				dispatched++;
			}
		} catch (err) {
			log.error('dispatchEvent', `Failed to deliver webhook for subscription ${sub.id}`, {
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	log.info('dispatchEvent', `Dispatched ${dispatched}/${subs.length} webhook deliveries`, {
		eventType,
		dispatched,
		total: subs.length
	});
	return { dispatched };
}
