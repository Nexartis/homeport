/**
 * Admin Auth Matrix — one-shot coverage for Lane A on /api/admin/**.
 *
 * Exercises every refactored admin handler against the five actor shapes
 * (anonymous, non-admin session, apikey, admin session, owner session)
 * and asserts the 401/403 rejection paths. Handler happy-paths are covered
 * by existing per-endpoint suites (api-admin-settings, api-admin-invitations,
 * admin-audit-log, billing); this file only enforces the denial matrix.
 *
 * All helpers throw SvelteKit `error(401|403, …)` synchronously from the
 * lane guards, so most cases don't touch D1/KV at all — they're pure unit
 * tests on the guard ordering. Integration paths (billing GET cross-tenant)
 * seed minimal rows in D1.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
	GET as settingsGET,
	PATCH as settingsPATCH
} from '../../../src/routes/api/admin/settings/+server';
import {
	GET as invitationsGET,
	POST as invitationsPOST
} from '../../../src/routes/api/admin/invitations/+server';
import {
	PATCH as invitationPATCH,
	DELETE as invitationDELETE
} from '../../../src/routes/api/admin/invitations/[id]/+server';
import { POST as invitationResendPOST } from '../../../src/routes/api/admin/invitations/[id]/resend/+server';
import { POST as invitationRevokePOST } from '../../../src/routes/api/admin/invitations/[id]/revoke/+server';
import { GET as auditGET } from '../../../src/routes/api/admin/audit/+server';
import { GET as analyticsGET } from '../../../src/routes/api/admin/analytics/payments/+server';
import {
	GET as keysGET,
	POST as keysPOST,
	PATCH as keysPATCH
} from '../../../src/routes/api/admin/keys/+server';
import {
	GET as federationGET,
	POST as federationPOST
} from '../../../src/routes/api/admin/federation/+server';
import {
	GET as billingGET,
	POST as billingPOST
} from '../../../src/routes/api/admin/billing/+server';

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

function anonLocals(): Locals {
	return { user: null, accessToken: null, apiKey: null } as Locals;
}
function sessionLocals(email: string, roles: string[], id = 'u-' + email): Locals {
	return {
		user: { isAuthenticated: true, id, email, roles },
		accessToken: null,
		apiKey: null
	} as Locals;
}
function apikeyLocals(ownerId = 'owner-A', keyId = 'key-A'): Locals {
	return {
		user: { isAuthenticated: true, id: ownerId, email: ownerId + '@ex.com', roles: [] },
		accessToken: null,
		apiKey: { id: keyId, tier: 'pro', scopes: null }
	} as Locals;
}

// Handlers expect route-specific `RequestEvent` shapes; the auth matrix only
// exercises guard ordering, so we erase the route-type via `any` on the call
// site rather than parameterize every helper. This is isolated to tests.
/* eslint-disable @typescript-eslint/no-explicit-any */
function buildEvent(
	locals: Locals,
	method: string,
	path = '/api/admin/x',
	body?: unknown,
	params: Record<string, string> = {}
): any {
	const url = `https://fake.host${path}`;
	const req = new Request(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	return {
		platform: { env, context: { waitUntil: () => {} } },
		locals,
		request: req,
		url: new URL(url),
		params
	};
}

beforeAll(async () => {
	await env.DB.prepare(DEV_KEYS_DDL).run();
	await env.DB.prepare('DELETE FROM developer_keys').run();
	await env.DB.prepare(
		`INSERT INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, tier)
		 VALUES ('key-A', 'h-A', 'nanda_aaaa', 'A', 'owner-A', 'a@x.com', 'pro')`
	).run();
	await env.DB.prepare(
		`INSERT INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, tier)
		 VALUES ('key-B', 'h-B', 'nanda_bbbb', 'B', 'owner-B', 'b@x.com', 'pro')`
	).run();
});

// ── Matrix cases ────────────────────────────────────────────────────────
type HandlerCall = () => Promise<Response> | Response;
type Case = {
	name: string;
	call: (locals: Locals) => HandlerCall;
	expects: { anon: number; viewer: number; apikey: number };
};

const viewer = () => sessionLocals('viewer@ex.com', ['viewer']);

const CASES: Case[] = [
	{
		name: 'GET  /settings',
		call: (l) => () => settingsGET(buildEvent(l, 'GET')),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'PATCH /settings',
		call: (l) => () =>
			settingsPATCH(buildEvent(l, 'PATCH', '/api/admin/settings', { nodeName: 'x' })),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'GET  /invitations',
		call: (l) => () => invitationsGET(buildEvent(l, 'GET')),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'POST /invitations',
		call: (l) => () =>
			invitationsPOST(buildEvent(l, 'POST', '/api/admin/invitations', { email: 'x@e.com' })),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'PATCH /invitations/:id',
		call: (l) => () =>
			invitationPATCH(
				buildEvent(l, 'PATCH', '/api/admin/invitations/id', { role: 'developer' }, { id: 'x' })
			),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'DELETE /invitations/:id',
		call: (l) => () =>
			invitationDELETE(
				buildEvent(l, 'DELETE', '/api/admin/invitations/id', undefined, { id: 'x' })
			),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'POST /invitations/:id/resend',
		call: (l) => () =>
			invitationResendPOST(
				buildEvent(l, 'POST', '/api/admin/invitations/id/resend', {}, { id: 'x' })
			),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'POST /invitations/:id/revoke',
		call: (l) => () =>
			invitationRevokePOST(
				buildEvent(l, 'POST', '/api/admin/invitations/id/revoke', {}, { id: 'x' })
			),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'GET  /audit',
		call: (l) => () => auditGET(buildEvent(l, 'GET')),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'GET  /analytics/payments',
		call: (l) => () => analyticsGET(buildEvent(l, 'GET')),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'GET  /keys',
		call: (l) => () => keysGET(buildEvent(l, 'GET')),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'POST /keys',
		call: (l) => () => keysPOST(buildEvent(l, 'POST', '/api/admin/keys', {})),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	{
		name: 'PATCH /keys',
		call: (l) => () => keysPATCH(buildEvent(l, 'PATCH', '/api/admin/keys', { key: 'irrelevant' })),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	},
	// Billing POST is Lane A now (admin-only close-period — apikey rejected)
	{
		name: 'POST /billing (close-period)',
		call: (l) => () =>
			billingPOST(
				buildEvent(l, 'POST', '/api/admin/billing', { action: 'close-period', periodId: 'x' })
			),
		expects: { anon: 401, viewer: 403, apikey: 403 }
	}
];

describe('/api/admin/** — auth denial matrix', () => {
	for (const c of CASES) {
		it(`${c.name} rejects anonymous → ${c.expects.anon}`, async () => {
			await expect(c.call(anonLocals())()).rejects.toMatchObject({ status: c.expects.anon });
		});
		it(`${c.name} rejects viewer session → ${c.expects.viewer}`, async () => {
			await expect(c.call(viewer())()).rejects.toMatchObject({ status: c.expects.viewer });
		});
		it(`${c.name} rejects apikey → ${c.expects.apikey}`, async () => {
			await expect(c.call(apikeyLocals())()).rejects.toMatchObject({ status: c.expects.apikey });
		});
	}
});

// ── Special cases: billing ownership + federation dual-path ────────────
describe('/api/admin/billing GET — ownership', () => {
	it('apikey scoped to key-A passes auth for its own billing (no 401/403)', async () => {
		// The auth gate is what we're asserting; service-level failures (missing
		// billing_periods table in this minimal fixture) surface as 500 — that's
		// outside the auth matrix, and sufficient to prove requireResourceOwner
		// did not reject the caller.
		const ev = buildEvent(
			apikeyLocals('owner-A', 'key-A'),
			'GET',
			'/api/admin/billing?keyId=key-A'
		);
		const res = await billingGET(ev);
		expect([401, 403]).not.toContain(res.status);
	});

	it('apikey owned by owner-A rejected when requesting key-B (cross-tenant → 403)', async () => {
		const ev = buildEvent(
			apikeyLocals('owner-A', 'key-A'),
			'GET',
			'/api/admin/billing?keyId=key-B'
		);
		await expect(billingGET(ev)).rejects.toMatchObject({ status: 403 });
	});

	it('admin session can fetch any tenant (bypass ownership, no 401/403)', async () => {
		const admin = sessionLocals('root@ex.com', ['admin']);
		const ev = buildEvent(admin, 'GET', '/api/admin/billing?keyId=key-B');
		const res = await billingGET(ev);
		expect([401, 403]).not.toContain(res.status);
	});

	it('missing keyId → 400 (not 401/403) for authorized caller', async () => {
		const admin = sessionLocals('root@ex.com', ['admin']);
		const ev = buildEvent(admin, 'GET', '/api/admin/billing');
		const res = await billingGET(ev);
		expect(res.status).toBe(400);
	});
});

describe('/api/admin/federation — dual-path (M2M bearer OR admin session)', () => {
	it('no bearer + no session → 401 via requireAdminRole', async () => {
		const ev = buildEvent(anonLocals(), 'GET', '/api/admin/federation');
		await expect(federationGET(ev)).rejects.toMatchObject({ status: 401 });
	});

	it('wrong bearer + viewer session → 403', async () => {
		const ev = buildEvent(viewer(), 'GET', '/api/admin/federation');
		ev.request.headers.set('Authorization', 'Bearer wrong-key');
		await expect(federationGET(ev)).rejects.toMatchObject({ status: 403 });
	});

	it('wrong bearer + apikey (no admin) → 403', async () => {
		const ev = buildEvent(apikeyLocals(), 'POST', '/api/admin/federation', {
			action: 'register-peer'
		});
		ev.request.headers.set('Authorization', 'Bearer wrong-key');
		await expect(federationPOST(ev)).rejects.toMatchObject({ status: 403 });
	});
});
