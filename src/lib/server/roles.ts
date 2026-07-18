/**
 * Role and Permission Helpers
 *
 * Authorization checks for Sentinel JWT roles across the application.
 * Roles come from Sentinel JWT tokens — no local storage required.
 *
 * - Admin: Full system access (entity management, registry management, sync operations)
 */

import { error } from '@sveltejs/kit';
import type { Logger } from '$lib/utils/logger';

export interface RoleAwareUser {
	roles?: string[] | null;
}

/**
 * Check if a user has a specific role
 * @param user - User object with roles array
 * @param role - Role string to check for
 * @returns true if user has the specified role
 */
export function hasRole(user: RoleAwareUser | null | undefined, role: string): boolean {
	return Array.isArray(user?.roles) && user.roles.includes(role);
}

/**
 * Check if a user has any of the specified roles
 * @param user - User object with roles array
 * @param roles - Array of role strings to check
 * @returns true if user has at least one of the specified roles
 */
export function hasAnyRole(user: RoleAwareUser | null | undefined, roles: string[]): boolean {
	if (!Array.isArray(user?.roles)) return false;
	return roles.some((role) => user.roles!.includes(role));
}

/**
 * Check if user has admin role
 *
 * Admin users have full system access including:
 * - Entity management (agents, models, orchestrators)
 * - Registry management
 * - Sync operations (seed agents, seed models)
 * - Orchestrator key management
 *
 * @param user - User object with roles array
 * @returns true if user has admin role
 */
export function isAdmin(user: RoleAwareUser | null | undefined): boolean {
	return hasRole(user, 'admin');
}

/**
 * Require admin role — throws 403 error if not admin
 *
 * Use this in API endpoints and server load functions to guard admin-only resources.
 * @param user - User object with roles array
 * @throws 403 error if user does not have admin role
 */
export function requireAdmin(user: RoleAwareUser | null | undefined): void {
	if (!isAdmin(user)) {
		throw error(403, 'Admin access required');
	}
}

/**
 * User shape that carries both roles and an email. Used by the owner
 * guard on mutations to the operator control surface.
 */
export interface EmailAwareUser extends RoleAwareUser {
	email?: string | null;
}

/**
 * Check if a user is the site owner — case-insensitive email match
 * against the owner email from node_settings (or SITE_OWNER_EMAIL fallback).
 *
 * Returns false when either side is null / empty.
 */
export function isOwner(
	user: EmailAwareUser | null | undefined,
	ownerEmail: string | null | undefined
): boolean {
	if (!user?.email || !ownerEmail) return false;
	const a = user.email.trim().toLowerCase();
	const b = ownerEmail.trim().toLowerCase();
	if (!a || !b) return false;
	return a === b;
}

/**
 * Require owner match — throws 403 error if the user is not the owner.
 * Use on PATCH/POST/DELETE handlers that mutate node settings or invitations.
 */
export function requireOwner(
	user: EmailAwareUser | null | undefined,
	ownerEmail: string | null | undefined
): void {
	if (!isOwner(user, ownerEmail)) {
		throw error(403, 'Owner access required');
	}
}

/**
 * Resolve the effective owner email used by mutation guards. Prefers the
 * persisted `node_settings.ownerEmail` and falls back to the `SITE_OWNER_EMAIL`
 * env var so the owner is not locked out if the bootstrap row was reset
 * (mirrors the fallback chain used by `isLoginAllowed`).
 */
export function resolveEffectiveOwnerEmail(
	settingsOwner: string | null | undefined,
	envOwner: string | null | undefined
): string | null {
	const s = settingsOwner?.trim();
	if (s) return s;
	const e = envOwner?.trim();
	return e ? e : null;
}

/**
 * Require owner match with `SITE_OWNER_EMAIL` env-var fallback.
 *
 * Use this on every mutation handler in `/api/admin/*` that must be restricted
 * to the site owner (settings, invitations). Emits a structured `warn` with
 * diagnostic fields (`userEmail`, `hasSettingsOwner`, `hasEnvOwner`) when the
 * check fails so 403s can be traced in Cloudflare logs.
 *
 * @throws 403 error with a descriptive message when the user is not the owner.
 */
export function requireOwnerWithEnvFallback(
	user: EmailAwareUser | null | undefined,
	settingsOwner: string | null | undefined,
	envOwner: string | null | undefined,
	diagnostics?: { log: Logger; fn: string }
): void {
	const effective = resolveEffectiveOwnerEmail(settingsOwner, envOwner);
	if (!isOwner(user, effective)) {
		diagnostics?.log.warn(diagnostics.fn, 'Owner access required', {
			userEmail: user?.email ?? null,
			hasSettingsOwner: Boolean(settingsOwner),
			hasEnvOwner: Boolean(envOwner)
		});
		throw error(403, 'Owner access required — only the site owner can perform this action');
	}
}
