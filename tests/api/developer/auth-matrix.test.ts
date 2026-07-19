/**
 * Auth matrix — Lane B /api/developer/earnings (GAMMA).
 *
 * §5.GAMMA matrix:
 *   - Anonymous                   → 401
 *   - API key actor               → 403 (session-only lane)
 *   - Session, self id            → 200
 *   - Session, cross-tenant query → 403 (requireSelfOrAdmin)
 *   - Admin session + developerId → 200 (bypass)
 *   - POST register-split spoofed → 403 for non-owner developerId
 *
 * Handlers are invoked directly; DB tables are seeded empty — the auth gate
 * fires before any meaningful query, and for the 200 case the summary just
 * returns zeroes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { GET, POST } from '../../../src/routes/api/developer/earnings/+server';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const TABLES = [
	`CREATE TABLE IF NOT EXISTS revenue_splits (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, developer_id TEXT NOT NULL,
		split_pct INTEGER NOT NULL DEFAULT 70, effective_from INTEGER NOT NULL,
		effective_to INTEGER, status TEXT NOT NULL DEFAULT 'active',
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS revenue_shares (
		id TEXT PRIMARY KEY, split_id TEXT NOT NULL REFERENCES revenue_splits(id),
		period_id TEXT NOT NULL, gross_revenue_np INTEGER NOT NULL DEFAULT 0,
		developer_share_np INTEGER NOT NULL DEFAULT 0, platform_share_np INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS revenue_settlements (
		id TEXT PRIMARY KEY, developer_id TEXT NOT NULL,
		total_np INTEGER NOT NULL DEFAULT 0, shares_count INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'pending', settled_at INTEGER,
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
const apikey = (ownerId = 'owner-A', keyId = 'key-A'): Locals =>
	({
		user: { isAuthenticated: true, id: ownerId, email: ownerId + '@ex.com', roles: [] },
		accessToken: null,
		apiKey: { id: keyId, tier: 'pro', scopes: null }
	}) as Locals;

/* eslint-disable @typescript-eslint/no-explicit-any */
function event(locals: Locals, method: string, query = '', body?: unknown): any {
	const url = 'https://fake.host/api/developer/earnings' + query;
	return {
		platform: { env, context: { waitUntil: () => {} } },
		locals,
		request: new Request(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL(url),
		params: {}
	};
}

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

describe('GET /api/developer/earnings — Lane B', () => {
	it('anonymous → 401', async () => {
		await expect(GET(event(anon(), 'GET'))).rejects.toMatchObject({ status: 401 });
	});
	it('apikey → 403 (session-only)', async () => {
		await expect(GET(event(apikey(), 'GET'))).rejects.toMatchObject({ status: 403 });
	});
	it('session self (no developerId) → 200', async () => {
		const res = await GET(event(session('dev-1'), 'GET'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { developerId: string };
		expect(body.developerId).toBe('dev-1');
	});
	it('session cross-tenant (developerId=other) → 403', async () => {
		await expect(GET(event(session('dev-1'), 'GET', '?developerId=dev-2'))).rejects.toMatchObject({
			status: 403
		});
	});
	it('admin session can inspect any developer → 200', async () => {
		const res = await GET(
			event(session('root', 'root@ex.com', ['admin']), 'GET', '?developerId=dev-2')
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { developerId: string };
		expect(body.developerId).toBe('dev-2');
	});
});

describe('POST /api/developer/earnings — spoof protection', () => {
	it('anonymous → 401', async () => {
		await expect(POST(event(anon(), 'POST', '', { action: 'settle' }))).rejects.toMatchObject({
			status: 401
		});
	});
	it('apikey → 403', async () => {
		await expect(POST(event(apikey(), 'POST', '', { action: 'settle' }))).rejects.toMatchObject({
			status: 403
		});
	});
	it('register-split with spoofed developerId → 403', async () => {
		await expect(
			POST(
				event(session('dev-1'), 'POST', '', {
					action: 'register-split',
					agentId: 'agent-x',
					developerId: 'dev-2'
				})
			)
		).rejects.toMatchObject({ status: 403 });
	});
	it('settle for self → 200', async () => {
		const res = await POST(event(session('dev-1'), 'POST', '', { action: 'settle' }));
		expect(res.status).toBe(200);
	});
	it('settle for other developer by admin → 200', async () => {
		const res = await POST(
			event(session('root', 'root@ex.com', ['admin']), 'POST', '', {
				action: 'settle',
				developerId: 'dev-2'
			})
		);
		expect(res.status).toBe(200);
	});
	it('unknown action → 400', async () => {
		const res = await POST(event(session('dev-1'), 'POST', '', { action: 'bogus' }));
		expect(res.status).toBe(400);
	});
});
