/**
 * Auth matrix — Lane B /api/developers/keys (GAMMA).
 *
 * Asserts the denial shape set by AUTH_LANES_AGENT_PLAN.md §4.4 / §5.GAMMA:
 *   - Anonymous          → 401
 *   - API key actor      → 403 (session-only lane)
 *   - Non-admin tier req → 403 (paid tier gate)
 *   - Admin session      → 200/201 (bypass)
 *   - Cross-tenant del   → 404 (owner scoping from repository)
 *
 * Handlers are invoked directly (no SELF.fetch) so guard ordering is the
 * only thing under test; DB interactions are limited to the minimum needed
 * to prove happy-path calls passed the auth gate.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { GET as keysGET, POST as keysPOST } from '../../../src/routes/api/developers/keys/+server';
import { DELETE as keyDELETE } from '../../../src/routes/api/developers/keys/[id]/+server';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const DEV_KEYS_DDL = `CREATE TABLE IF NOT EXISTS developer_keys (
	id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL,
	name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT,
	status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'free',
	rate_limit_monthly INTEGER NOT NULL DEFAULT 1000, scopes TEXT,
	last_used_at INTEGER, usage_count_monthly INTEGER NOT NULL DEFAULT 0,
	usage_reset_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
	revoked_at INTEGER, expires_at INTEGER)`;

type Locals = App.Locals;
const anon = (): Locals => ({ user: null, accessToken: null, apiKey: null }) as Locals;
const session = (id: string, email: string, roles: string[] = []): Locals =>
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
function buildEvent(
	locals: Locals,
	method: string,
	body?: unknown,
	params: Record<string, string> = {}
): any {
	const url = 'https://fake.host/api/developers/keys';
	return {
		platform: { env, context: { waitUntil: () => {} } },
		locals,
		request: new Request(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL(url),
		params
	};
}

beforeAll(async () => {
	await env.DB.prepare(DEV_KEYS_DDL).run();
});

beforeEach(async () => {
	await env.DB.prepare('DELETE FROM developer_keys').run();
	// Seed a key owned by owner-A so cross-tenant DELETE has a target.
	await env.DB.prepare(
		`INSERT INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, tier)
		 VALUES ('key-A', 'h-A', 'nanda_aaaa', 'A', 'owner-A', 'a@ex.com', 'free')`
	).run();
});

describe('GET /api/developers/keys — Lane B (session-only)', () => {
	it('rejects anonymous → 401', async () => {
		await expect(keysGET(buildEvent(anon(), 'GET'))).rejects.toMatchObject({ status: 401 });
	});
	it('rejects apikey actor → 403', async () => {
		await expect(keysGET(buildEvent(apikey(), 'GET'))).rejects.toMatchObject({ status: 403 });
	});
	it('valid session (developer) → 200', async () => {
		const res = await keysGET(buildEvent(session('owner-A', 'a@ex.com'), 'GET'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { keys: unknown[] };
		expect(Array.isArray(body.keys)).toBe(true);
	});
});

describe('POST /api/developers/keys — tier gate', () => {
	it('rejects anonymous → 401', async () => {
		await expect(keysPOST(buildEvent(anon(), 'POST', { name: 'x' }))).rejects.toMatchObject({
			status: 401
		});
	});
	it('rejects apikey actor → 403', async () => {
		await expect(keysPOST(buildEvent(apikey(), 'POST', { name: 'x' }))).rejects.toMatchObject({
			status: 403
		});
	});
	it('non-admin requesting pro tier → 403 admin_required_for_paid_tier', async () => {
		await expect(
			keysPOST(buildEvent(session('u', 'u@ex.com'), 'POST', { name: 'x', tier: 'pro' }))
		).rejects.toMatchObject({ status: 403, body: { message: 'admin_required_for_paid_tier' } });
	});
	it('admin requesting pro tier → 201 (bypass)', async () => {
		const res = await keysPOST(
			buildEvent(session('admin-1', 'root@ex.com', ['admin']), 'POST', {
				name: 'pro-key',
				tier: 'pro'
			})
		);
		expect(res.status).toBe(201);
	});
	it('developer session requesting free tier → 201', async () => {
		const res = await keysPOST(
			buildEvent(session('u2', 'u2@ex.com'), 'POST', { name: 'free-key' })
		);
		expect(res.status).toBe(201);
	});
});

describe('DELETE /api/developers/keys/[id] — ownership', () => {
	it('rejects anonymous → 401', async () => {
		await expect(
			keyDELETE(buildEvent(anon(), 'DELETE', undefined, { id: 'key-A' }))
		).rejects.toMatchObject({ status: 401 });
	});
	it('rejects apikey → 403', async () => {
		await expect(
			keyDELETE(buildEvent(apikey(), 'DELETE', undefined, { id: 'key-A' }))
		).rejects.toMatchObject({ status: 403 });
	});
	it('cross-tenant delete → 404 (owner scoping at repository)', async () => {
		const res = await keyDELETE(
			buildEvent(session('owner-B', 'b@ex.com'), 'DELETE', undefined, { id: 'key-A' })
		);
		expect(res.status).toBe(404);
	});
	it('owner session delete → 200', async () => {
		const res = await keyDELETE(
			buildEvent(session('owner-A', 'a@ex.com'), 'DELETE', undefined, { id: 'key-A' })
		);
		expect(res.status).toBe(200);
	});
});
