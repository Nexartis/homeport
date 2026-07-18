/**
 * Auth matrix — Lane C /api/webhooks + /api/webhooks/[id] (GAMMA).
 *
 * §5.GAMMA matrix:
 *   - Anonymous                           → 401
 *   - API key, owner match                → 200
 *   - API key, wrong owner on item        → 403 (requireResourceOwner)
 *   - Session, non-admin, other's owner   → 403
 *   - Admin session listing               → sees all subs, including others
 *   - Legacy null-ownerId row             → 404 for non-admins
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { GET, POST } from '../../../src/routes/api/webhooks/+server';
import {
	GET as GET_ID,
	PATCH as PATCH_ID,
	DELETE as DELETE_ID
} from '../../../src/routes/api/webhooks/[id]/+server';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

// Ensure owner_id is NULLABLE to exercise the legacy null-owner row path.
// Drops any prior NOT NULL variant defined by sibling tests in the shared D1.
const TABLES = [
	`DROP TABLE IF EXISTS webhook_subscriptions`,
	`CREATE TABLE webhook_subscriptions (
		id TEXT PRIMARY KEY, callback_url TEXT NOT NULL, events TEXT NOT NULL,
		secret TEXT NOT NULL, owner_id TEXT, status TEXT NOT NULL DEFAULT 'active',
		failure_count INTEGER NOT NULL DEFAULT 0, last_delivered_at INTEGER,
		created_at INTEGER DEFAULT (unixepoch()))`
];

type Locals = App.Locals;
const anon = (): Locals => ({ user: null, accessToken: null, apiKey: null }) as Locals;
const session = (id: string, email = id + '@ex.com', roles: string[] = []): Locals =>
	({
		user: { isAuthenticated: true, id, email, roles },
		accessToken: null,
		apiKey: null
	}) as Locals;
const apikey = (ownerId: string, keyId = 'key-' + ownerId): Locals =>
	({
		user: { isAuthenticated: true, id: ownerId, email: ownerId + '@ex.com', roles: [] },
		accessToken: null,
		apiKey: { id: keyId, tier: 'pro', scopes: null }
	}) as Locals;

/* eslint-disable @typescript-eslint/no-explicit-any */
function evt(locals: Locals, method: string, body?: unknown, id?: string): any {
	const url = 'https://fake.host/api/webhooks' + (id ? '/' + id : '');
	return {
		platform: { env, context: { waitUntil: () => {} } },
		locals,
		request: new Request(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL(url),
		params: id ? { id } : {}
	};
}

async function seed(id: string, ownerId: string | null) {
	await env.DB.prepare(
		`INSERT INTO webhook_subscriptions (id, callback_url, events, secret, owner_id, status)
		 VALUES (?, ?, ?, ?, ?, 'active')`
	)
		.bind(id, 'https://example.com/' + id, JSON.stringify(['registered']), 'sec_' + id, ownerId)
		.run();
}

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	await env.DB.prepare('DELETE FROM webhook_subscriptions').run();
	await seed('sub-a', 'owner-A');
	await seed('sub-b', 'owner-B');
	await seed('sub-legacy', null);
});

describe('GET /api/webhooks — listing', () => {
	it('anonymous → 401', async () => {
		await expect(GET(evt(anon(), 'GET'))).rejects.toMatchObject({ status: 401 });
	});
	it('apikey scoped to owner → only own subs', async () => {
		const res = await GET(evt(apikey('owner-A'), 'GET'));
		const body = (await res.json()) as { subscriptions: { id: string }[] };
		expect(body.subscriptions.map((s) => s.id).sort()).toEqual(['sub-a']);
	});
	it('admin session → sees every sub (incl. legacy null-owner)', async () => {
		const res = await GET(evt(session('root', 'root@ex.com', ['admin']), 'GET'));
		const body = (await res.json()) as { subscriptions: { id: string }[] };
		expect(body.subscriptions.map((s) => s.id).sort()).toEqual(['sub-a', 'sub-b', 'sub-legacy']);
	});
});

describe('GET /api/webhooks/[id] — ownership', () => {
	it('anonymous → 401', async () => {
		await expect(GET_ID(evt(anon(), 'GET', undefined, 'sub-a'))).rejects.toMatchObject({
			status: 401
		});
	});
	it('owner apikey → 200', async () => {
		const res = await GET_ID(evt(apikey('owner-A'), 'GET', undefined, 'sub-a'));
		expect(res.status).toBe(200);
	});
	it('wrong-owner apikey → 403', async () => {
		await expect(GET_ID(evt(apikey('owner-B'), 'GET', undefined, 'sub-a'))).rejects.toMatchObject({
			status: 403
		});
	});
	it('legacy null-owner → 404 for non-admin', async () => {
		const res = await GET_ID(evt(apikey('owner-A'), 'GET', undefined, 'sub-legacy'));
		expect(res.status).toBe(404);
	});
	it('admin session → 200 on any', async () => {
		const res = await GET_ID(
			evt(session('root', 'root@ex.com', ['admin']), 'GET', undefined, 'sub-b')
		);
		expect(res.status).toBe(200);
	});
});

describe('PATCH /api/webhooks/[id] — pause/resume', () => {
	it('wrong-owner apikey → 403', async () => {
		await expect(
			PATCH_ID(evt(apikey('owner-B'), 'PATCH', { action: 'pause' }, 'sub-a'))
		).rejects.toMatchObject({ status: 403 });
	});
	it('owner apikey → 200', async () => {
		const res = await PATCH_ID(evt(apikey('owner-A'), 'PATCH', { action: 'pause' }, 'sub-a'));
		expect(res.status).toBe(200);
	});
});

describe('DELETE /api/webhooks/[id] — ownership', () => {
	it('wrong-owner apikey → 403', async () => {
		await expect(
			DELETE_ID(evt(apikey('owner-B'), 'DELETE', undefined, 'sub-a'))
		).rejects.toMatchObject({ status: 403 });
	});
	it('admin session → 200', async () => {
		const res = await DELETE_ID(
			evt(session('root', 'root@ex.com', ['admin']), 'DELETE', undefined, 'sub-b')
		);
		expect(res.status).toBe(200);
	});
});
