/**
 * Auth Lanes — cross-cutting contract test.
 *
 * Enumerates every `+server.ts` under `src/routes/api/` at build time and
 * asserts the uniformity invariant set in `AUTH_LANES_AGENT_PLAN.md` §4:
 *
 *   1. Every handler file imports **either** `$lib/server/auth-lanes`
 *      (Lanes A/B/C/E) **or** `requireCronAuth` (Lane D). No exceptions.
 *
 *   2. Every handler file that does NOT import `markPublic` (i.e. is not
 *      intentionally public) must call at least one concrete lane guard
 *      (`requireAdminRole`, `requireDeveloperSession`, `requireAuthenticated`,
 *      `requireApiKeyOrAdmin`, `requireSiteOwner`, `requireSelfOrAdmin`, or
 *      `requireCronAuth`). `getActor` alone is not a guard.
 *
 *   3. Every route under a dynamic segment (`[id]`, `[runId]`, `[agentId]`,
 *      `[agent_id]`, `[...path]`) that exports a mutation handler
 *      (PATCH/PUT/DELETE/POST) must call an ownership-bearing guard
 *      (`requireResourceOwner`, `requireAdminRole`, `requireSelfOrAdmin`,
 *      `requireSiteOwner`, `requireApiKeyOrAdmin`, or `requireCronAuth`) —
 *      never just `requireAuthenticated`, which would authenticate without
 *      checking tenant.
 *
 * These are source-level structural assertions, not HTTP invocations.
 * Per-endpoint denial/ownership behavior is covered by the matrix suites
 * under `tests/api/{admin,developer,developers,invoices,webhooks}/`
 * and by the domain suites (`orchestration.test.ts`, etc.).
 *
 * Owner: FOXTROT (§5.FOXTROT).
 */

import { describe, it, expect } from 'vitest';

// Vite reads the file tree at build time and inlines each matching source
// as a raw string. Keys are repo-absolute paths (e.g.
// "/src/routes/api/admin/keys/+server.ts").
const HANDLER_SOURCES = import.meta.glob('/src/routes/api/**/+server.ts', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const HANDLER_PATHS = Object.keys(HANDLER_SOURCES).sort();

const LANE_GUARDS = [
	'requireAdminRole',
	'requireDeveloperSession',
	'requireAuthenticated',
	'requireApiKeyOrAdmin',
	'requireSiteOwner',
	'requireSelfOrAdmin',
	'requireCronAuth'
];

const OWNERSHIP_GUARDS = [
	'requireResourceOwner',
	'requireAdminRole',
	'requireSelfOrAdmin',
	'requireSiteOwner',
	'requireApiKeyOrAdmin',
	'requireCronAuth'
];

// Exceptions — dynamic-segment mutation endpoints whose "ownership" is not
// expressible through the row-level helpers. Justify each entry.
const DYNAMIC_MUTATION_EXEMPTIONS = new Set<string>([
	// Sentinel SDK catch-all — delegates to `@nexartis/sentinel-sdk` handlers;
	// the SDK performs its own token-class auth. Marked public (Lane E) because
	// the top-level handler wraps login/logout/poll flows which must accept
	// anonymous calls.
	'/src/routes/api/auth/[...path]/+server.ts',

	// Developer API key revoke — ownership is enforced by the repository
	// function `revokeDevApiKey(db, keyId, ownerId)` which is scoped to the
	// caller's user id via `actor.user.id`. No row is touched unless that
	// tuple matches, so a post-read `requireResourceOwner` would be
	// redundant (and would introduce a TOCTOU window). Guarded by
	// `requireDeveloperSession` for Lane B entry + scoped-query ownership.
	'/src/routes/api/developers/keys/[id]/+server.ts'
]);

// Exemptions for invariants 1 & 2 — platform-managed cube files that this repo
// does not own. These ship from a required cube's `sdkFiles` (see cube.jsonc
// `requiredCubes`) and are byte-synced/overwritten on every deploy, so a
// `markPublic`/lane-guard annotation added here would be reverted. Their auth
// is owned upstream by the cube. Justify each entry.
const PLATFORM_MANAGED_EXEMPTIONS = new Set<string>([
	// Sentinel SDK auth catch-all — carries a "CUBESTORE ROUTE FILE — DO NOT
	// MODIFY" banner, shipped by `cube-sentinel-v1`. `createAuthHandlers()`
	// performs the SDK's own token-class auth and legitimately accepts
	// anonymous login/poll/logout calls (Lane E). The annotation belongs in the
	// cube source, not this consuming repo.
	'/src/routes/api/auth/[...path]/+server.ts'
]);

function hasImport(source: string, symbol: string): boolean {
	// Match `import { ... symbol ... } from '...auth-lanes'` style imports.
	// Keep it permissive — also catches multi-line import blocks.
	return new RegExp(`\\b${symbol}\\b`).test(source);
}

function exportsMethod(source: string, method: string): boolean {
	return new RegExp(`export\\s+const\\s+${method}\\s*:`).test(source);
}

function isDynamicRoute(path: string): boolean {
	return /\/\[[^\]]+\]\//.test(path);
}

describe('auth-lanes contract', () => {
	it('discovers every api handler via the build glob', () => {
		// Sanity: the glob must find a non-trivial number of handlers. If
		// Vite ever stops resolving this glob, the rest of the suite would
		// silently pass with 0 iterations.
		expect(HANDLER_PATHS.length).toBeGreaterThan(40);
	});

	describe('invariant 1 — every handler imports a lane entry point', () => {
		for (const path of HANDLER_PATHS) {
			if (PLATFORM_MANAGED_EXEMPTIONS.has(path)) continue;
			it(path, () => {
				const src = HANDLER_SOURCES[path];
				const usesLanes = src.includes("'$lib/server/auth-lanes'");
				const usesCron =
					src.includes('requireCronAuth') && src.includes("'$lib/middleware/auth-guards'");
				expect(
					usesLanes || usesCron,
					`handler ${path} does not import auth-lanes or requireCronAuth`
				).toBe(true);
			});
		}
	});

	describe('invariant 2 — non-public handlers call a concrete lane guard', () => {
		for (const path of HANDLER_PATHS) {
			if (PLATFORM_MANAGED_EXEMPTIONS.has(path)) continue;
			it(path, () => {
				const src = HANDLER_SOURCES[path];
				const isPublic = hasImport(src, 'markPublic');
				if (isPublic) return;
				const hasGuard = LANE_GUARDS.some((g) => hasImport(src, g));
				expect(
					hasGuard,
					`handler ${path} is not public and does not call any lane guard ` +
						`(expected one of: ${LANE_GUARDS.join(', ')})`
				).toBe(true);
			});
		}
	});

	describe('invariant 3 — dynamic-segment mutations check ownership', () => {
		for (const path of HANDLER_PATHS) {
			if (!isDynamicRoute(path)) continue;
			if (DYNAMIC_MUTATION_EXEMPTIONS.has(path)) continue;
			const src = HANDLER_SOURCES[path];
			const mutations = ['PATCH', 'PUT', 'DELETE', 'POST'].filter((m) => exportsMethod(src, m));
			if (mutations.length === 0) continue;

			it(`${path} [${mutations.join(',')}]`, () => {
				// Public dynamic endpoints (e.g. adapter discovery by agent_id)
				// are allowed to skip ownership as long as they are explicitly
				// marked public. Rate-limit/CSRF belongs to the endpoint, not
				// this contract test.
				const isPublic = hasImport(src, 'markPublic');
				if (isPublic) return;

				const hasOwnershipGuard = OWNERSHIP_GUARDS.some((g) => hasImport(src, g));
				expect(
					hasOwnershipGuard,
					`${path} exports ${mutations.join('/')} on a dynamic segment ` +
						`but no ownership-bearing guard is called ` +
						`(expected one of: ${OWNERSHIP_GUARDS.join(', ')})`
				).toBe(true);
			});
		}
	});

	describe('invariant 4 — public endpoints invoke markPublic (not just import)', () => {
		for (const path of HANDLER_PATHS) {
			const src = HANDLER_SOURCES[path];
			if (!hasImport(src, 'markPublic')) continue;
			it(path, () => {
				// Match `markPublic({` to confirm the call-site exists, not
				// just a dead import. Static annotation is the whole point.
				expect(
					/markPublic\s*\(\s*\{/.test(src),
					`${path} imports markPublic but never invokes it`
				).toBe(true);
			});
		}
	});
});
