/**
 * Webhook Delivery — Phase 4 (Agent Beta)
 *
 * Processes WebhookJobMessage for inline webhook delivery.
 * Delivers signed webhook payloads to subscriber callback URLs
 * with retry logic and circuit breaker (10 failures → disabled).
 */

import type { DbClient } from '$lib/db/client';
import {
	getWebhookSubscription,
	incrementFailureCount,
	resetFailureCount,
	updateLastDelivered,
	disableSubscription
} from '$lib/db/repositories/webhooks';
import { signPayload, type WebhookJobMessage } from '$lib/services/webhooks/service';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'webhook-delivery');

/** Circuit breaker threshold — disable subscription after this many consecutive failures */
const MAX_FAILURE_COUNT = 10;

/** Delivery timeout in milliseconds */
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Process a single webhook delivery message.
 *
 * 1. Look up subscription by subscription_id
 * 2. If subscription not found or inactive → ack (discard)
 * 3. Build JSON payload with envelope: { event, payload, timestamp, idempotency_key }
 * 4. Sign with HMAC-SHA256 using subscription secret
 * 5. POST to callback_url with signature headers
 * 6. On success (2xx): reset failure count, update last_delivered_at
 * 7. On failure: increment failure count
 * 8. If failure_count >= 10: set status to disabled (circuit breaker)
 */
export async function processWebhookDelivery(
	db: DbClient,
	message: WebhookJobMessage
): Promise<{ delivered: boolean; discarded?: boolean; statusCode?: number }> {
	const { subscription_id, event_type, payload, idempotency_key } = message;

	// 1. Look up subscription
	const sub = await getWebhookSubscription(db, subscription_id);

	// 2. Discard if not found or inactive — these should be acknowledged (200), not retried
	if (!sub) {
		log.warn('processWebhookDelivery', `Subscription ${subscription_id} not found — discarding`);
		return { delivered: false, discarded: true };
	}

	if (sub.status !== 'active') {
		log.info(
			'processWebhookDelivery',
			`Subscription ${subscription_id} is ${sub.status} — discarding`
		);
		return { delivered: false, discarded: true };
	}

	// 3. Build envelope
	const envelope = {
		event: event_type,
		payload,
		timestamp: new Date().toISOString(),
		idempotency_key
	};
	const bodyStr = JSON.stringify(envelope);

	// 4. Sign with HMAC-SHA256
	const signature = signPayload(bodyStr, sub.secret);

	// 5. POST to callbackUrl with headers
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
	try {
		const response = await fetch(sub.callbackUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Webhook-Signature': signature,
				'X-Webhook-Event': event_type,
				'X-Idempotency-Key': idempotency_key
			},
			body: bodyStr,
			signal: controller.signal,
			redirect: 'manual' // Prevent redirect-following to avoid SSRF / signature leakage
		});

		clearTimeout(timeoutId);

		// 6a. Handle redirects — with redirect: 'manual', runtimes may return
		// opaqueredirect (status 0) or a normal 3xx. Either way, the endpoint
		// tried to redirect, which we block for SSRF safety. Treat as a config
		// error (discarded) so we don't trip the circuit breaker on every delivery.
		const isRedirect =
			response.type === 'opaqueredirect' ||
			response.status === 0 ||
			(response.status >= 300 && response.status < 400);
		if (isRedirect) {
			log.warn('processWebhookDelivery', `Redirect blocked for ${sub.callbackUrl}`, {
				callbackUrl: sub.callbackUrl,
				event: event_type,
				responseType: response.type,
				statusCode: response.status
			});
			return { delivered: false, discarded: true, statusCode: response.status || 308 };
		}

		// 6. Success: reset failure count, update last_delivered_at
		if (response.ok) {
			await resetFailureCount(db, subscription_id);
			await updateLastDelivered(db, subscription_id);
			log.info('processWebhookDelivery', `Delivered to ${sub.callbackUrl}`, {
				statusCode: response.status,
				event: event_type
			});
			return { delivered: true, statusCode: response.status };
		}

		// 7. Failure: increment failure count
		log.warn('processWebhookDelivery', `Delivery failed: ${response.status}`, {
			callbackUrl: sub.callbackUrl,
			statusCode: response.status
		});
		await incrementFailureCount(db, subscription_id);

		// 8. Circuit breaker: disable if too many failures
		const updatedSub = await getWebhookSubscription(db, subscription_id);
		if (updatedSub && (updatedSub.failureCount ?? 0) >= MAX_FAILURE_COUNT) {
			await disableSubscription(db, subscription_id);
			log.error(
				'processWebhookDelivery',
				`Circuit breaker triggered — disabled subscription ${subscription_id}`,
				{
					failureCount: updatedSub.failureCount
				}
			);
		}

		return { delivered: false, statusCode: response.status };
	} catch (err) {
		clearTimeout(timeoutId);
		const errMsg = err instanceof Error ? err.message : String(err);
		log.error('processWebhookDelivery', `Delivery error for ${sub.callbackUrl}`, {
			error: errMsg
		});

		// Increment failure count on network errors too
		await incrementFailureCount(db, subscription_id);

		// Circuit breaker check
		const updatedSub = await getWebhookSubscription(db, subscription_id);
		if (updatedSub && (updatedSub.failureCount ?? 0) >= MAX_FAILURE_COUNT) {
			await disableSubscription(db, subscription_id);
			log.error(
				'processWebhookDelivery',
				`Circuit breaker triggered — disabled subscription ${subscription_id}`,
				{
					failureCount: updatedSub.failureCount
				}
			);
		}

		return { delivered: false };
	}
}
