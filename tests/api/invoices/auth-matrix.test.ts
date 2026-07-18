/**
 * Auth matrix — Lane C /api/invoices + /api/invoices/[id] (GAMMA).
 *
 * §5.GAMMA matrix:
 *   - Anonymous                           → 401
 *   - API key, owner's keyId              → 200
 *   - API key, wrong owner's keyId        → 403 (requireResourceOwner via devKey.ownerId)
 *   - Key not found on list               → 404
 *   - Admin session, any keyId            → 200 (bypass)
 *   - GET [id] invoice owned by other key → 403
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { GET, POST } from '../../../src/routes/api/invoices/+server';
import { GET as GET_ID, PATCH as PATCH_ID } from '../../../src/routes/api/invoices/[id]/+server';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const TABLES = [
	`CREATE TABLE IF NOT EXISTS invoices (
		id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE,
		period_id TEXT, key_id TEXT NOT NULL, subscription_id TEXT,
		line_items TEXT NOT NULL, subtotal_np INTEGER NOT NULL DEFAULT 0,
		total_np INTEGER NOT NULL DEFAULT 0, total_usd_equivalent REAL,
		currency TEXT NOT NULL DEFAULT 'NP', status TEXT NOT NULL DEFAULT 'draft',
		issued_at INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS invoice_sequence (
		year INTEGER PRIMARY KEY, next_number INTEGER NOT NULL DEFAULT 1)`,
	`CREATE TABLE IF NOT EXISTS developer_keys (
		id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL,
		name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT,
		status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'free',
		rate_limit_monthly INTEGER NOT NULL DEFAULT 1000, scopes TEXT,
		last_used_at INTEGER, usage_count_monthly INTEGER NOT NULL DEFAULT 0,
		usage_reset_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
		revoked_at INTEGER, expires_at INTEGER)`
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
function evt(locals: Locals, method: string, query = '', body?: unknown, id?: string): any {
	const url = 'https://fake.host/api/invoices' + (id ? '/' + id : '') + query;
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

async function seedKey(id: string, ownerId: string) {
	await env.DB.prepare(
		`INSERT INTO developer_keys (id, key_hash, key_prefix, name, owner_id, status, tier, rate_limit_monthly)
		 VALUES (?, ?, ?, ?, ?, 'active', 'pro', 10000)`
	)
		.bind(id, 'hash_' + id, id.slice(0, 8), 'Key ' + id, ownerId)
		.run();
}

async function seedInvoice(id: string, keyId: string, status = 'draft') {
	await env.DB.prepare(
		`INSERT INTO invoices (id, invoice_number, key_id, line_items, subtotal_np, total_np, currency, status)
		 VALUES (?, ?, ?, '[]', 0, 0, 'NP', ?)`
	)
		.bind(id, 'INV-' + id, keyId, status)
		.run();
}

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM invoices'),
		env.DB.prepare('DELETE FROM invoice_sequence'),
		env.DB.prepare('DELETE FROM developer_keys')
	]);
	await seedKey('key-owner-A', 'owner-A');
	await seedKey('key-owner-B', 'owner-B');
	await seedInvoice('inv-a', 'key-owner-A');
	await seedInvoice('inv-b', 'key-owner-B');
});

describe('GET /api/invoices — listing by keyId', () => {
	it('anonymous → 401', async () => {
		await expect(GET(evt(anon(), 'GET', '?keyId=key-owner-A'))).rejects.toMatchObject({
			status: 401
		});
	});
	it('missing keyId → 400', async () => {
		const res = await GET(evt(apikey('owner-A'), 'GET'));
		expect(res.status).toBe(400);
	});
	it('unknown keyId → 404', async () => {
		const res = await GET(evt(apikey('owner-A'), 'GET', '?keyId=missing'));
		expect(res.status).toBe(404);
	});
	it('owner apikey → 200', async () => {
		const res = await GET(evt(apikey('owner-A'), 'GET', '?keyId=key-owner-A'));
		expect(res.status).toBe(200);
	});
	it('wrong-owner apikey → 403', async () => {
		await expect(GET(evt(apikey('owner-B'), 'GET', '?keyId=key-owner-A'))).rejects.toMatchObject({
			status: 403
		});
	});
	it('admin session → 200 across owners', async () => {
		const res = await GET(
			evt(session('root', 'root@ex.com', ['admin']), 'GET', '?keyId=key-owner-B')
		);
		expect(res.status).toBe(200);
	});
});

describe('GET /api/invoices/[id] — ownership via keyId→ownerId', () => {
	it('anonymous → 401', async () => {
		await expect(GET_ID(evt(anon(), 'GET', '', undefined, 'inv-a'))).rejects.toMatchObject({
			status: 401
		});
	});
	it('owner apikey → 200', async () => {
		const res = await GET_ID(evt(apikey('owner-A'), 'GET', '', undefined, 'inv-a'));
		expect(res.status).toBe(200);
	});
	it('wrong-owner apikey → 403', async () => {
		await expect(
			GET_ID(evt(apikey('owner-B'), 'GET', '', undefined, 'inv-a'))
		).rejects.toMatchObject({ status: 403 });
	});
	it('non-existent invoice → 404', async () => {
		const res = await GET_ID(evt(apikey('owner-A'), 'GET', '', undefined, 'inv-missing'));
		expect(res.status).toBe(404);
	});
});

describe('PATCH /api/invoices/[id] — void action', () => {
	it('wrong-owner apikey → 403', async () => {
		await expect(
			PATCH_ID(evt(apikey('owner-B'), 'PATCH', '', { action: 'void' }, 'inv-a'))
		).rejects.toMatchObject({ status: 403 });
	});
	it('invalid action → 400', async () => {
		const res = await PATCH_ID(evt(apikey('owner-A'), 'PATCH', '', { action: 'bogus' }, 'inv-a'));
		expect(res.status).toBe(400);
	});
	it('owner apikey void → 200', async () => {
		const res = await PATCH_ID(evt(apikey('owner-A'), 'PATCH', '', { action: 'void' }, 'inv-a'));
		expect(res.status).toBe(200);
	});
});

describe('POST /api/invoices — generate', () => {
	it('anonymous → 401', async () => {
		await expect(POST(evt(anon(), 'POST', '', { key_id: 'key-owner-A' }))).rejects.toMatchObject({
			status: 401
		});
	});
	it('missing key_id → 400', async () => {
		const res = await POST(evt(apikey('owner-A'), 'POST', '', {}));
		expect(res.status).toBe(400);
	});
	it('wrong-owner apikey → 403', async () => {
		await expect(
			POST(evt(apikey('owner-B'), 'POST', '', { key_id: 'key-owner-A' }))
		).rejects.toMatchObject({ status: 403 });
	});
});
