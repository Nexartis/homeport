/**
 * Auth Lanes — unit tests for every helper in $lib/server/auth-lanes.
 */
import { describe, it, expect } from 'vitest';
import {
	getActor,
	requireAdminRole,
	requireSiteOwner,
	rejectApiKeyAuth,
	requireDeveloperSession,
	requireSelfOrAdmin,
	requireAuthenticated,
	requireApiKeyOrAdmin,
	requireResourceOwner,
	markPublic,
	type AuthActor
} from '../src/lib/server/auth-lanes';

type Locals = {
	user: { isAuthenticated: boolean; id: string; email: string; roles: string[] } | null;
	apiKey: { id: string; tier: string; scopes: string[] | null } | null;
};

const mkLocals = (overrides: Partial<Locals> = {}): App.Locals =>
	({
		user: null,
		apiKey: null,
		accessToken: null,
		...overrides
	}) as unknown as App.Locals;

const sessionActor = (roles: string[], id = 'u1', email = 'u1@example.com'): AuthActor =>
	({
		kind: 'session',
		user: { isAuthenticated: true, id, email, roles },
		roles
	}) as AuthActor;

const apikeyActor = (ownerId = 'o1', keyId = 'k1'): AuthActor =>
	({
		kind: 'apikey',
		keyId,
		ownerId,
		ownerEmail: 'owner@example.com',
		tier: 'free',
		scopes: []
	}) as AuthActor;

describe('getActor', () => {
	it('returns anonymous when neither apiKey nor user is set', () => {
		const actor = getActor(mkLocals());
		expect(actor.kind).toBe('anonymous');
	});

	it('returns apikey when apiKey is set (apikey wins over session)', () => {
		const locals = mkLocals({
			user: { isAuthenticated: true, id: 'owner-1', email: 'o@e.com', roles: [] },
			apiKey: { id: 'key-1', tier: 'pro', scopes: ['read'] }
		});
		const actor = getActor(locals);
		expect(actor.kind).toBe('apikey');
		if (actor.kind === 'apikey') {
			expect(actor.keyId).toBe('key-1');
			expect(actor.ownerId).toBe('owner-1');
			expect(actor.tier).toBe('pro');
			expect(actor.scopes).toEqual(['read']);
		}
	});

	it('returns session when only user is set', () => {
		const locals = mkLocals({
			user: { isAuthenticated: true, id: 'u', email: 'u@e.com', roles: ['admin'] }
		});
		const actor = getActor(locals);
		expect(actor.kind).toBe('session');
		if (actor.kind === 'session') expect(actor.roles).toEqual(['admin']);
	});

	it('handles null scopes gracefully', () => {
		const locals = mkLocals({
			user: { isAuthenticated: true, id: 'o', email: 'o@e.com', roles: [] },
			apiKey: { id: 'k', tier: 'free', scopes: null }
		});
		const actor = getActor(locals);
		if (actor.kind === 'apikey') expect(actor.scopes).toEqual([]);
	});
});

describe('requireAdminRole', () => {
	it('passes for session with admin role', () => {
		expect(() => requireAdminRole(sessionActor(['admin']))).not.toThrow();
	});

	it('throws 403 for session without admin role', () => {
		expect(() => requireAdminRole(sessionActor(['viewer']))).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});

	it('throws 401 for anonymous', () => {
		expect(() => requireAdminRole({ kind: 'anonymous' })).toThrow(
			expect.objectContaining({ status: 401 })
		);
	});

	it('throws 403 for apikey', () => {
		expect(() => requireAdminRole(apikeyActor())).toThrow(expect.objectContaining({ status: 403 }));
	});
});

describe('requireSiteOwner', () => {
	const OWNER = 'owner@example.com';

	it('passes for session that matches the settings owner', () => {
		const diag = { log: { warn: () => {}, info: () => {}, debug: () => {}, error: () => {} } };
		expect(() =>
			requireSiteOwner(sessionActor(['admin'], 'u', OWNER), OWNER, null, {
				log: diag.log,
				fn: 'fn'
			})
		).not.toThrow();
	});

	it('falls back to env owner when settings owner is null', () => {
		const diag = { log: { warn: () => {}, info: () => {}, debug: () => {}, error: () => {} } };
		expect(() =>
			requireSiteOwner(sessionActor(['admin'], 'u', OWNER), null, OWNER, {
				log: diag.log,
				fn: 'fn'
			})
		).not.toThrow();
	});

	it('throws 403 when neither owner matches', () => {
		const diag = { log: { warn: () => {}, info: () => {}, debug: () => {}, error: () => {} } };
		expect(() =>
			requireSiteOwner(sessionActor(['admin']), OWNER, null, { log: diag.log, fn: 'fn' })
		).toThrow(expect.objectContaining({ status: 403 }));
	});

	it('throws 403 for apikey actor regardless of email', () => {
		const diag = { log: { warn: () => {}, info: () => {}, debug: () => {}, error: () => {} } };
		expect(() => requireSiteOwner(apikeyActor(), OWNER, null, { log: diag.log, fn: 'fn' })).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('rejectApiKeyAuth', () => {
	it('is a no-op for anonymous', () => {
		expect(() => rejectApiKeyAuth({ kind: 'anonymous' })).not.toThrow();
	});
	it('is a no-op for session', () => {
		expect(() => rejectApiKeyAuth(sessionActor(['admin']))).not.toThrow();
	});
	it('throws 403 for apikey', () => {
		expect(() => rejectApiKeyAuth(apikeyActor())).toThrow(expect.objectContaining({ status: 403 }));
	});
});

describe('requireDeveloperSession', () => {
	it('passes for any authenticated session', () => {
		expect(() => requireDeveloperSession(sessionActor([]))).not.toThrow();
		expect(() => requireDeveloperSession(sessionActor(['viewer']))).not.toThrow();
	});
	it('throws 403 for apikey', () => {
		expect(() => requireDeveloperSession(apikeyActor())).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
	it('throws 401 for anonymous', () => {
		expect(() => requireDeveloperSession({ kind: 'anonymous' })).toThrow(
			expect.objectContaining({ status: 401 })
		);
	});
});

describe('requireSelfOrAdmin', () => {
	it('passes when actor is the target', () => {
		const a = sessionActor([], 'u1') as Extract<AuthActor, { kind: 'session' }>;
		expect(() => requireSelfOrAdmin(a, 'u1')).not.toThrow();
	});
	it('passes for admin on any target', () => {
		const a = sessionActor(['admin'], 'u1') as Extract<AuthActor, { kind: 'session' }>;
		expect(() => requireSelfOrAdmin(a, 'different')).not.toThrow();
	});
	it('throws 403 for non-self non-admin', () => {
		const a = sessionActor(['viewer'], 'u1') as Extract<AuthActor, { kind: 'session' }>;
		expect(() => requireSelfOrAdmin(a, 'different')).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('requireAuthenticated', () => {
	it('passes for session and apikey', () => {
		expect(() => requireAuthenticated(sessionActor([]))).not.toThrow();
		expect(() => requireAuthenticated(apikeyActor())).not.toThrow();
	});
	it('throws 401 for anonymous', () => {
		expect(() => requireAuthenticated({ kind: 'anonymous' })).toThrow(
			expect.objectContaining({ status: 401 })
		);
	});
});

describe('requireApiKeyOrAdmin', () => {
	it('passes for apikey', () => {
		expect(() => requireApiKeyOrAdmin(apikeyActor())).not.toThrow();
	});
	it('passes for admin session', () => {
		expect(() => requireApiKeyOrAdmin(sessionActor(['admin']))).not.toThrow();
	});
	it('throws 403 for non-admin session', () => {
		expect(() => requireApiKeyOrAdmin(sessionActor(['viewer']))).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
	it('throws 401 for anonymous', () => {
		expect(() => requireApiKeyOrAdmin({ kind: 'anonymous' })).toThrow(
			expect.objectContaining({ status: 401 })
		);
	});
});

describe('requireResourceOwner', () => {
	it('passes when apikey.ownerId matches the resource', () => {
		const a = apikeyActor('owner-1') as Exclude<AuthActor, { kind: 'anonymous' }>;
		expect(() => requireResourceOwner(a, 'owner-1')).not.toThrow();
	});
	it('passes when session.user.id matches the resource', () => {
		const a = sessionActor([], 'u1') as Exclude<AuthActor, { kind: 'anonymous' }>;
		expect(() => requireResourceOwner(a, 'u1')).not.toThrow();
	});
	it('passes for admin session on any resource', () => {
		const a = sessionActor(['admin'], 'u1') as Exclude<AuthActor, { kind: 'anonymous' }>;
		expect(() => requireResourceOwner(a, 'other')).not.toThrow();
	});
	it('throws 403 when apikey owner does not match', () => {
		const a = apikeyActor('owner-1') as Exclude<AuthActor, { kind: 'anonymous' }>;
		expect(() => requireResourceOwner(a, 'owner-2')).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
	it('throws 403 when session non-admin does not own resource', () => {
		const a = sessionActor(['viewer'], 'u1') as Exclude<AuthActor, { kind: 'anonymous' }>;
		expect(() => requireResourceOwner(a, 'u2')).toThrow(expect.objectContaining({ status: 403 }));
	});
});

describe('markPublic', () => {
	it('is a no-op', () => {
		expect(() => markPublic({ reason: 'test' })).not.toThrow();
		expect(markPublic({ reason: 'test', rateLimit: '5/min', csrf: true })).toBeUndefined();
	});
});

// ── Lane E source-level sentinels ────────────────────────────────
//
// Every intentionally public API endpoint must (a) import `markPublic`
// from the auth-lanes module and (b) actually call it inside its
// handler with a non-empty `reason`. These checks fail loudly if a
// future refactor silently drops the marker, so CI notices that an
// endpoint no longer advertises its Lane E status.

import visitorsSrc from '../src/routes/api/visitors/+server.ts?raw';
import waitlistSrc from '../src/routes/api/public/waitlist/+server.ts?raw';
import ratesSrc from '../src/routes/api/payments/rates/+server.ts?raw';
import currenciesSrc from '../src/routes/api/payments/currencies/+server.ts?raw';
import convertSrc from '../src/routes/api/payments/convert/+server.ts?raw';
import verifyNpSrc from '../src/routes/api/payments/verify-np/+server.ts?raw';

// NOTE: /api/auth/[...path] is intentionally NOT in this list. It is a
// platform-managed cube file ("CUBESTORE ROUTE FILE — DO NOT MODIFY", shipped
// by cube-sentinel-v1 and overwritten on every deploy). It delegates to
// `@nexartis/sentinel-sdk` which owns its own token-class auth; a `markPublic`
// marker cannot live here because it would be reverted on the next deploy. The
// annotation belongs in the cube source, not this consuming repo.
const LANE_E_SOURCES: Array<[name: string, src: string]> = [
	['api/visitors', visitorsSrc],
	['api/public/waitlist', waitlistSrc],
	['api/payments/rates', ratesSrc],
	['api/payments/currencies', currenciesSrc],
	['api/payments/convert', convertSrc],
	['api/payments/verify-np', verifyNpSrc]
];

describe('Lane E markPublic sentinels', () => {
	for (const [name, src] of LANE_E_SOURCES) {
		it(`${name} imports markPublic from auth-lanes`, () => {
			expect(src).toMatch(/import[\s\S]*?markPublic[\s\S]*?from\s+['"][^'"]*auth-lanes['"]/);
		});

		it(`${name} calls markPublic with a non-empty reason`, () => {
			expect(src).toMatch(/markPublic\(\s*\{[\s\S]*?reason\s*:\s*['"][^'"]+['"][\s\S]*?\}/);
		});
	}
});
