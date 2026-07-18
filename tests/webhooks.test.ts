/**
 * Webhook Infrastructure Tests — Phase 4 (Agent Beta)
 *
 * Covers:
 *   - Pure functions: signPayload, validateCallbackUrl
 *   - API routes: POST/GET /api/webhooks, GET/PATCH/DELETE /api/webhooks/:id
 *   - Queue consumer: POST /api/queue/webhook-deliver (auth + validation)
 *
 * Uses @cloudflare/vitest-pool-workers SELF.fetch() pattern.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { signPayload, validateCallbackUrl } from '$lib/services/webhooks/service';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
		CRON_AUTH_TOKEN?: string;
	}
}

// Test API key — inserted directly via DB
const TEST_API_KEY_RAW = 'nanda_test_webhook_api_key_abcdef1234';
let testKeyHash: string;

async function sha256(data: string): Promise<string> {
	const encoded = new TextEncoder().encode(data);
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

const TABLES = [
	`CREATE TABLE IF NOT EXISTS webhook_subscriptions (
		id TEXT PRIMARY KEY,
		callback_url TEXT NOT NULL,
		events TEXT NOT NULL,
		secret TEXT NOT NULL,
		owner_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'active',
		failure_count INTEGER NOT NULL DEFAULT 0,
		last_delivered_at INTEGER,
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_ws_owner ON webhook_subscriptions(owner_id)`,
	`CREATE INDEX IF NOT EXISTS idx_ws_status ON webhook_subscriptions(status)`,
	`CREATE TABLE IF NOT EXISTS developer_keys (
		id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL,
		name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT,
		status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'free',
		rate_limit_monthly INTEGER NOT NULL DEFAULT 1000, scopes TEXT,
		last_used_at INTEGER, usage_count_monthly INTEGER NOT NULL DEFAULT 0,
		usage_reset_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
		revoked_at INTEGER, expires_at INTEGER)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_keys_key_hash ON developer_keys(key_hash)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_owner ON developer_keys(owner_id)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_status ON developer_keys(status)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_prefix ON developer_keys(key_prefix)`
];

const AUTH_HEADERS = {
	Authorization: `Bearer ${TEST_API_KEY_RAW}`,
	'Content-Type': 'application/json',
	'CF-Connecting-IP': '10.0.99.1'
};

const QUEUE_HEADERS = {
	'X-Cron-Auth': 'test-cron-token',
	'Content-Type': 'application/json'
};

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));

	testKeyHash = await sha256(TEST_API_KEY_RAW);
	await env.DB.prepare(
		`INSERT OR IGNORE INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, status, tier, rate_limit_monthly, usage_count_monthly, usage_reset_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			'test-key-webhook-1',
			testKeyHash,
			TEST_API_KEY_RAW.slice(0, 12),
			'Webhook Test Key',
			'user-webhook-test',
			'webhook@test.com',
			'active',
			'free',
			1000,
			0,
			Math.floor(Date.now() / 1000) + 86400 * 30
		)
		.run();
});

beforeEach(async () => {
	await env.DB.prepare('DELETE FROM webhook_subscriptions').run();
});

// ---------------------------------------------------------------------------
// Pure function tests: signPayload
// ---------------------------------------------------------------------------

describe('signPayload', () => {
	it('produces deterministic HMAC-SHA256 signatures', () => {
		const sig1 = signPayload('hello world', 'secret123');
		const sig2 = signPayload('hello world', 'secret123');
		expect(sig1).toBe(sig2);
		expect(sig1).toMatch(/^sha256=[a-f0-9]{64}$/);
	});

	it('produces different signatures for different payloads', () => {
		const sig1 = signPayload('payload-a', 'secret');
		const sig2 = signPayload('payload-b', 'secret');
		expect(sig1).not.toBe(sig2);
	});

	it('produces different signatures for different secrets', () => {
		const sig1 = signPayload('same-payload', 'secret-a');
		const sig2 = signPayload('same-payload', 'secret-b');
		expect(sig1).not.toBe(sig2);
	});
});

// ---------------------------------------------------------------------------
// Pure function tests: validateCallbackUrl
// ---------------------------------------------------------------------------

describe('validateCallbackUrl', () => {
	it('accepts valid HTTPS URLs', () => {
		expect(validateCallbackUrl('https://hooks.example.com/webhook').valid).toBe(true);
	});

	it('rejects HTTP URLs', () => {
		const result = validateCallbackUrl('http://hooks.example.com/webhook');
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('HTTPS');
	});

	it('rejects localhost', () => {
		expect(validateCallbackUrl('https://localhost/hook').valid).toBe(false);
	});

	it('rejects 127.0.0.1', () => {
		expect(validateCallbackUrl('https://127.0.0.1/hook').valid).toBe(false);
	});

	it('rejects .internal domains', () => {
		expect(validateCallbackUrl('https://service.internal/hook').valid).toBe(false);
	});

	it('rejects invalid URL format', () => {
		const result = validateCallbackUrl('not-a-url');
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('Invalid URL');
	});
});

// ---------------------------------------------------------------------------
// POST /api/webhooks — Create subscription
// ---------------------------------------------------------------------------

describe('POST /api/webhooks', () => {
	it('returns 401 without API key', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.99.2' },
			body: JSON.stringify({ callback_url: 'https://example.com/hook', events: ['registered'] })
		});
		expect(res.status).toBe(401);
	});

	it('returns 400 when callback_url is missing', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ events: ['registered'] })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('callback_url');
	});

	it('returns 400 when events is empty', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ callback_url: 'https://example.com/hook', events: [] })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('events');
	});

	it('returns 400 for invalid event types', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ callback_url: 'https://example.com/hook', events: ['invalid_event'] })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('Invalid event');
	});

	it('returns 400 for HTTP callback URLs', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ callback_url: 'http://example.com/hook', events: ['registered'] })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('HTTPS');
	});

	it('creates subscription and returns secret on 201', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({
				callback_url: 'https://hooks.example.com/webhook',
				events: ['registered', 'deprecated']
			})
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			id: string;
			secret: string;
			callback_url: string;
			events: string[];
			status: string;
		};
		expect(body.id).toBeDefined();
		expect(body.secret).toBeDefined();
		expect(body.secret.length).toBeGreaterThan(0);
		expect(body.callback_url).toBe('https://hooks.example.com/webhook');
		expect(body.events).toEqual(['registered', 'deprecated']);
		expect(body.status).toBe('active');
	});
});

// ---------------------------------------------------------------------------
// GET /api/webhooks — List subscriptions
// ---------------------------------------------------------------------------

describe('GET /api/webhooks', () => {
	it('returns 401 without API key', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			headers: { 'CF-Connecting-IP': '10.0.99.3' }
		});
		expect(res.status).toBe(401);
	});

	it('returns empty list when no subscriptions exist', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			headers: AUTH_HEADERS
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { subscriptions: unknown[] };
		expect(body.subscriptions).toEqual([]);
	});

	it('returns subscriptions without secrets', async () => {
		// Create a subscription first
		await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({
				callback_url: 'https://hooks.example.com/list-test',
				events: ['registered']
			})
		});

		const res = await SELF.fetch('https://fake.host/api/webhooks', {
			headers: AUTH_HEADERS
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { subscriptions: Array<Record<string, unknown>> };
		expect(body.subscriptions.length).toBe(1);
		// Secret must NOT be in list response
		expect(body.subscriptions[0].secret).toBeUndefined();
		expect(body.subscriptions[0].callbackUrl).toBe('https://hooks.example.com/list-test');
	});
});

// ---------------------------------------------------------------------------
// GET/PATCH/DELETE /api/webhooks/:id — Subscription management
// ---------------------------------------------------------------------------

describe('GET /api/webhooks/:id', () => {
	it('returns 404 for non-existent subscription', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks/nonexistent', {
			headers: AUTH_HEADERS
		});
		expect(res.status).toBe(404);
	});

	it('returns subscription details without secret', async () => {
		// Create first
		const createRes = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({
				callback_url: 'https://hooks.example.com/get-test',
				events: ['registered']
			})
		});
		expect(createRes.status).toBe(201);
		const created = (await createRes.json()) as { id: string };
		expect(created.id).toBeDefined();

		const res = await SELF.fetch(`https://fake.host/api/webhooks/${created.id}`, {
			headers: AUTH_HEADERS
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { subscription: Record<string, unknown> };
		expect(body.subscription.id).toBe(created.id);
		expect(body.subscription.callbackUrl).toBe('https://hooks.example.com/get-test');
		expect(body.subscription.secret).toBeUndefined();
	});
});

describe('PATCH /api/webhooks/:id', () => {
	it('returns 400 for invalid action', async () => {
		const createRes = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({
				callback_url: 'https://hooks.example.com/patch-test',
				events: ['registered']
			})
		});
		const created = (await createRes.json()) as { id: string };

		const res = await SELF.fetch(`https://fake.host/api/webhooks/${created.id}`, {
			method: 'PATCH',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ action: 'invalid' })
		});
		expect(res.status).toBe(400);
	});

	it('pauses and resumes a subscription', async () => {
		const createRes = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({
				callback_url: 'https://hooks.example.com/pause-test',
				events: ['registered']
			})
		});
		const created = (await createRes.json()) as { id: string };

		// Pause
		const pauseRes = await SELF.fetch(`https://fake.host/api/webhooks/${created.id}`, {
			method: 'PATCH',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ action: 'pause' })
		});
		expect(pauseRes.status).toBe(200);
		const pauseBody = (await pauseRes.json()) as { ok: boolean; status: string };
		expect(pauseBody.status).toBe('paused');

		// Resume
		const resumeRes = await SELF.fetch(`https://fake.host/api/webhooks/${created.id}`, {
			method: 'PATCH',
			headers: AUTH_HEADERS,
			body: JSON.stringify({ action: 'resume' })
		});
		expect(resumeRes.status).toBe(200);
		const resumeBody = (await resumeRes.json()) as { ok: boolean; status: string };
		expect(resumeBody.status).toBe('active');
	});
});

describe('DELETE /api/webhooks/:id', () => {
	it('returns 404 for non-existent subscription', async () => {
		const res = await SELF.fetch('https://fake.host/api/webhooks/nonexistent', {
			method: 'DELETE',
			headers: AUTH_HEADERS
		});
		expect(res.status).toBe(404);
	});

	it('deletes an existing subscription', async () => {
		const createRes = await SELF.fetch('https://fake.host/api/webhooks', {
			method: 'POST',
			headers: AUTH_HEADERS,
			body: JSON.stringify({
				callback_url: 'https://hooks.example.com/delete-test',
				events: ['registered']
			})
		});
		const created = (await createRes.json()) as { id: string };

		const deleteRes = await SELF.fetch(`https://fake.host/api/webhooks/${created.id}`, {
			method: 'DELETE',
			headers: AUTH_HEADERS
		});
		expect(deleteRes.status).toBe(200);
		const body = (await deleteRes.json()) as { ok: boolean; deleted: string };
		expect(body.ok).toBe(true);
		expect(body.deleted).toBe(created.id);

		// Verify it's gone
		const getRes = await SELF.fetch(`https://fake.host/api/webhooks/${created.id}`, {
			headers: AUTH_HEADERS
		});
		expect(getRes.status).toBe(404);
	});
});

// ---------------------------------------------------------------------------
// POST /api/queue/webhook-deliver — Queue consumer auth + validation
// ---------------------------------------------------------------------------

const QUEUE_URL = 'https://test.local/api/queue/webhook-deliver';

describe('POST /api/queue/webhook-deliver — auth', () => {
	it('returns 401 when X-Cron-Auth header is missing', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription_id: 'sub-1',
				event_type: 'registered',
				payload: {},
				idempotency_key: 'key-1'
			})
		});
		expect(res.status).toBe(401);
	});

	it('returns 401 when X-Cron-Auth header is wrong', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: { 'X-Cron-Auth': 'wrong-token', 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subscription_id: 'sub-1',
				event_type: 'registered',
				payload: {},
				idempotency_key: 'key-1'
			})
		});
		expect(res.status).toBe(401);
	});
});

describe('POST /api/queue/webhook-deliver — validation', () => {
	it('returns 400 on invalid JSON body', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: QUEUE_HEADERS,
			body: 'not-json'
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when subscription_id is missing', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: QUEUE_HEADERS,
			body: JSON.stringify({
				event_type: 'registered',
				payload: {},
				idempotency_key: 'key-1'
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('subscription_id');
	});

	it('returns 400 when event_type is missing', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: QUEUE_HEADERS,
			body: JSON.stringify({
				subscription_id: 'sub-1',
				payload: {},
				idempotency_key: 'key-1'
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('event_type');
	});

	it('returns 400 when idempotency_key is missing', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: QUEUE_HEADERS,
			body: JSON.stringify({
				subscription_id: 'sub-1',
				event_type: 'registered',
				payload: {}
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain('idempotency_key');
	});

	it('returns 200 with delivered:false for non-existent subscription', async () => {
		const res = await SELF.fetch(QUEUE_URL, {
			method: 'POST',
			headers: QUEUE_HEADERS,
			body: JSON.stringify({
				subscription_id: 'does-not-exist',
				event_type: 'registered',
				payload: { agent_id: 'a1' },
				idempotency_key: 'key-1'
			})
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; delivered: boolean };
		expect(body.ok).toBe(true);
		expect(body.delivered).toBe(false);
	});
});
