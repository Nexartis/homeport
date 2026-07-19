/**
 * Node Settings Service — operator control surface (Launch Roadmap §4).
 *
 * Responsibilities:
 *  - Read/write the singleton `node_settings` row via the repository.
 *  - Decide whether an email is allowed to log in (isLoginAllowed).
 *  - Resolve post-login redirects based on role.
 *
 * This service is the single source of truth for `hooks.server.ts` — the
 * hook no longer reads SITE_OWNER_EMAIL directly; it delegates here.
 */

import type { DbClient } from '$lib/db/client';
import {
	getNodeSettings,
	ensureNodeSettings,
	updateNodeSettings,
	getInvitationByEmail,
	normalizeEmail,
	type UpdatableSettings
} from '$lib/db/repositories';
import type { NodeSettingsRecord } from '$lib/db/schema';
import { createLogger } from '$lib/utils/logger';
import type { AuthMode, LoginAllowedResult, UserRole } from './types';

const log = createLogger(undefined, 'node-settings');

/** Default fallback when the row is missing (first-boot, migration pending). */
const DEFAULT_SETTINGS: Pick<
	NodeSettingsRecord,
	'authMode' | 'defaultRole' | 'waitlistEnabled' | 'yanezEnabled'
> = {
	authMode: 'solo',
	defaultRole: 'developer',
	waitlistEnabled: false,
	yanezEnabled: false
};

/**
 * Read the settings. Ensures the singleton row exists (self-healing for
 * Pegasus deployments where the 0001 migration may have been skipped).
 */
export async function getSettings(db: DbClient): Promise<NodeSettingsRecord> {
	try {
		const existing = await getNodeSettings(db);
		if (existing) return existing;
		return await ensureNodeSettings(db);
	} catch (err) {
		log.error('getSettings', 'Falling back to defaults', {
			error: err instanceof Error ? err.message : String(err)
		});
		return {
			id: 'default',
			authMode: DEFAULT_SETTINGS.authMode,
			waitlistEnabled: DEFAULT_SETTINGS.waitlistEnabled,
			defaultRole: DEFAULT_SETTINGS.defaultRole,
			yanezEnabled: DEFAULT_SETTINGS.yanezEnabled,
			ownerEmail: null,
			nodeName: null,
			supportEmail: null,
			welcomeHeadline: null,
			welcomeBody: null,
			brandLogoUrl: null,
			brandPrimaryColor: null,
			createdAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000)
		};
	}
}

/** Update the settings. Thin wrapper around the repository. */
export async function updateSettings(
	db: DbClient,
	patch: UpdatableSettings
): Promise<NodeSettingsRecord | null> {
	await ensureNodeSettings(db);
	return updateNodeSettings(db, patch);
}

/**
 * Core login-gate. Called by hooks.server.ts onBeforeLogin equivalent.
 *
 * Decision order (per roadmap §4.3):
 *  1. Owner email always allowed (returns 'admin' role)
 *  2. 'open' mode → allowed with default role
 *  3. 'invite' mode → look up invitation; accept if 'invited' or 'accepted'
 *  4. 'solo' mode (default) → only owner
 */
export async function isLoginAllowed(
	db: DbClient,
	email: string,
	envOwnerEmail?: string | null
): Promise<LoginAllowedResult> {
	const normalized = normalizeEmail(email);
	if (!normalized) {
		return { ok: false, reason: 'error', message: 'Empty email' };
	}

	let settings: NodeSettingsRecord;
	try {
		settings = await getSettings(db);
	} catch {
		return { ok: false, reason: 'no_settings' };
	}

	// 1. Owner check — settings owner OR env fallback (until first login seeds it)
	const ownerEmail = (settings.ownerEmail ?? envOwnerEmail ?? '').trim().toLowerCase();
	if (ownerEmail && normalized === ownerEmail) {
		return { ok: true, role: 'admin', message: 'site_owner' };
	}

	const mode = settings.authMode as AuthMode;

	// 2. Open mode — anyone can sign in with the default role
	if (mode === 'open') {
		return {
			ok: true,
			role: (settings.defaultRole as UserRole) ?? 'developer',
			message: 'open_mode'
		};
	}

	// 3. Invite mode — allowlist lookup
	if (mode === 'invite') {
		const inv = await getInvitationByEmail(db, normalized);
		if (!inv) return { ok: false, reason: 'not_invited' };
		if (inv.status === 'revoked') return { ok: false, reason: 'revoked' };
		if (inv.status === 'waitlisted') return { ok: false, reason: 'waitlisted' };
		if (inv.status === 'expired') return { ok: false, reason: 'expired' };
		const now = Math.floor(Date.now() / 1000);
		if (inv.expiresAt && inv.expiresAt < now) return { ok: false, reason: 'expired' };
		if (inv.status === 'invited' || inv.status === 'accepted') {
			return { ok: true, role: (inv.role as UserRole) ?? 'developer' };
		}
		return { ok: false, reason: 'not_invited' };
	}

	// 4. Solo mode — owner only
	return { ok: false, reason: 'solo_mode' };
}

/**
 * Determine where a freshly-authenticated user should land.
 * Admins → /admin, developers → /admin (read-only sections),
 * viewers → /.
 */
export function resolvePostLoginRedirect(role: UserRole | undefined): string {
	if (role === 'admin' || role === 'developer') return '/admin';
	return '/';
}
