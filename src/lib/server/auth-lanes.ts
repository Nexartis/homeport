/**
 * Auth Lanes — unified authorization helpers for /api/** endpoints.
 *
 * Every request handler builds a single `AuthActor` via `getActor(locals)`
 * and then applies one of five lane guards:
 *
 *   A. Admin          — requireAdminRole, requireSiteOwner, rejectApiKeyAuth
 *   B. Developer      — requireDeveloperSession, requireSelfOrAdmin
 *   C. Agent / M2M    — requireAuthenticated, requireApiKeyOrAdmin,
 *                       requireResourceOwner
 *   D. Internal/cron  — requireCronAuth (unchanged; see auth-guards.ts)
 *   E. Public         — markPublic (documentation-only; no enforcement)
 *
 * All failure paths throw `error(401|403, 'snake_case_reason')` from
 * `@sveltejs/kit` — never `json({}, { status })`. Callers that pass a
 * `diagnostics` object receive a structured `warn` log on denial.
 */
import { error } from '@sveltejs/kit';
import type { UserLocals } from '@nexartis/sentinel-sdk/core';
import { isAdmin, requireOwnerWithEnvFallback } from '$lib/server/roles';
import type { Logger } from '$lib/utils/logger';

export type AuthActor =
	| { kind: 'anonymous' }
	| { kind: 'session'; user: UserLocals; roles: readonly string[] }
	| {
			kind: 'apikey';
			keyId: string;
			ownerId: string;
			ownerEmail: string;
			tier: string;
			scopes: readonly string[];
	  };

type Diagnostics = { log: Logger; fn: string };

/**
 * Build an AuthActor from the current request locals.
 *
 * Resolution order matches `hooks.server.ts`: an API key wins even when the
 * caller also carries a Sentinel session cookie, because the key identifies a
 * bot / integration rather than a human operator.
 */
export function getActor(locals: App.Locals): AuthActor {
	if (locals.apiKey) {
		return {
			kind: 'apikey',
			keyId: locals.apiKey.id,
			ownerId: locals.user?.id ?? '',
			ownerEmail: locals.user?.email ?? '',
			tier: locals.apiKey.tier,
			scopes: locals.apiKey.scopes ?? []
		};
	}
	if (locals.user?.isAuthenticated) {
		return {
			kind: 'session',
			user: locals.user,
			roles: locals.user.roles ?? []
		};
	}
	return { kind: 'anonymous' };
}

function warn(diag: Diagnostics | undefined, reason: string, actor: AuthActor): void {
	if (!diag) return;
	const meta: Record<string, unknown> = { reason, actorKind: actor.kind };
	if (actor.kind === 'session') meta.userEmail = actor.user.email ?? null;
	if (actor.kind === 'apikey') meta.keyId = actor.keyId;
	diag.log.warn(diag.fn, 'denied', meta);
}

// ── Lane A ────────────────────────────────────────────────────────────────
export function requireAdminRole(
	actor: AuthActor,
	diagnostics?: Diagnostics
): asserts actor is Extract<AuthActor, { kind: 'session' }> {
	if (actor.kind !== 'session') {
		warn(diagnostics, 'admin_requires_session', actor);
		throw error(actor.kind === 'anonymous' ? 401 : 403, 'admin_access_required');
	}
	if (!isAdmin(actor.user)) {
		warn(diagnostics, 'admin_role_missing', actor);
		throw error(403, 'admin_access_required');
	}
}

export function requireSiteOwner(
	actor: AuthActor,
	settingsOwner: string | null | undefined,
	envOwner: string | null | undefined,
	diagnostics: Diagnostics
): asserts actor is Extract<AuthActor, { kind: 'session' }> {
	if (actor.kind !== 'session') {
		warn(diagnostics, 'owner_requires_session', actor);
		throw error(actor.kind === 'anonymous' ? 401 : 403, 'owner_access_required');
	}
	requireOwnerWithEnvFallback(actor.user, settingsOwner, envOwner, diagnostics);
}

export function rejectApiKeyAuth(actor: AuthActor, diagnostics?: Diagnostics): void {
	if (actor.kind === 'apikey') {
		warn(diagnostics, 'api_key_forbidden', actor);
		throw error(403, 'api_key_forbidden_on_admin_endpoint');
	}
}

// ── Lane B ────────────────────────────────────────────────────────────────
export function requireDeveloperSession(
	actor: AuthActor,
	diagnostics?: Diagnostics
): asserts actor is Extract<AuthActor, { kind: 'session' }> {
	if (actor.kind === 'apikey') {
		warn(diagnostics, 'developer_session_required', actor);
		throw error(403, 'session_required');
	}
	if (actor.kind !== 'session') {
		warn(diagnostics, 'developer_session_required', actor);
		throw error(401, 'unauthenticated');
	}
}

export function requireSelfOrAdmin(
	actor: Extract<AuthActor, { kind: 'session' }>,
	targetUserId: string,
	diagnostics?: Diagnostics
): void {
	if (actor.user.id === targetUserId) return;
	if (isAdmin(actor.user)) return;
	warn(diagnostics, 'self_or_admin_required', actor);
	throw error(403, 'forbidden');
}

// ── Lane C ────────────────────────────────────────────────────────────────
export function requireAuthenticated(
	actor: AuthActor,
	diagnostics?: Diagnostics
): asserts actor is Exclude<AuthActor, { kind: 'anonymous' }> {
	if (actor.kind === 'anonymous') {
		warn(diagnostics, 'unauthenticated', actor);
		throw error(401, 'unauthenticated');
	}
}

export function requireApiKeyOrAdmin(actor: AuthActor, diagnostics?: Diagnostics): void {
	if (actor.kind === 'apikey') return;
	if (actor.kind === 'session' && isAdmin(actor.user)) return;
	warn(diagnostics, 'api_key_or_admin_required', actor);
	throw error(actor.kind === 'anonymous' ? 401 : 403, 'forbidden');
}

export function requireResourceOwner(
	actor: Exclude<AuthActor, { kind: 'anonymous' }>,
	resourceOwnerId: string,
	diagnostics?: Diagnostics
): void {
	if (actor.kind === 'session' && isAdmin(actor.user)) return;
	const callerId = actor.kind === 'apikey' ? actor.ownerId : actor.user.id;
	if (callerId && callerId === resourceOwnerId) return;
	if (diagnostics) {
		diagnostics.log.warn(diagnostics.fn, 'denied', {
			reason: 'resource_ownership_mismatch',
			actorKind: actor.kind,
			callerId: callerId || null,
			resourceOwnerId
		});
	}
	throw error(403, 'forbidden');
}

// ── Lane E ────────────────────────────────────────────────────────────────
/**
 * Documentation-only marker for intentionally-public endpoints. No-op at
 * runtime; exists so grep / CodeQL can inventory the public surface and so
 * reviewers can see the author's stated reason for leaving a handler open.
 *
 * Always sits *alongside* the existing rate-limit / CSRF / signature logic —
 * it does not replace them.
 */
export function markPublic(_metadata: {
	reason: string;
	rateLimit?: string;
	csrf?: boolean;
}): void {
	// intentional no-op
}
