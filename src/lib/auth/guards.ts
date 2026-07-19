/**
 * ⚠️  CUBESTORE SDK FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 * To extend functionality, create wrapper modules that import from this file.
 *
 * Auth Guards
 *
 * Route protection utilities for SvelteKit.
 * Works with the UserLocals type from @nexartis/sentinel-sdk.
 */

import { redirect, error } from '@sveltejs/kit';
import type { UserLocals } from '@nexartis/sentinel-sdk/core';

/**
 * Require authentication - redirect to login if not authenticated
 *
 * @param user - User from event.locals.user
 * @param redirectTo - Path to redirect to if not authenticated
 */
export function requireAuth(
	user: UserLocals | null | undefined,
	redirectTo = '/auth'
): asserts user is UserLocals & { isAuthenticated: true } {
	if (!user || !user.isAuthenticated) {
		throw redirect(303, redirectTo);
	}
}

/**
 * Require specific role
 *
 * @param user - User from event.locals.user
 * @param role - Required role
 * @param options - Redirect paths for auth vs authorization failures
 */
export function requireRole(
	user: UserLocals | null | undefined,
	role: string,
	options: { loginRedirect?: string; unauthorizedRedirect?: string } = {}
): void {
	const { loginRedirect = '/auth', unauthorizedRedirect = '/unauthorized' } = options;

	// First check authentication - redirect to login if not authenticated
	requireAuth(user, loginRedirect);

	// Then check authorization - redirect to unauthorized if missing role
	if (!user.roles.includes(role)) {
		throw redirect(303, unauthorizedRedirect);
	}
}

/**
 * Require any of the specified roles
 *
 * @param user - User from event.locals.user
 * @param roles - Array of roles (any match passes)
 * @param options - Redirect paths for auth vs authorization failures
 */
export function requireAnyRole(
	user: UserLocals | null | undefined,
	roles: string[],
	options: { loginRedirect?: string; unauthorizedRedirect?: string } = {}
): void {
	const { loginRedirect = '/auth', unauthorizedRedirect = '/unauthorized' } = options;

	// First check authentication - redirect to login if not authenticated
	requireAuth(user, loginRedirect);

	// Then check authorization - redirect to unauthorized if missing roles
	if (!roles.some((role) => user.roles.includes(role))) {
		throw redirect(303, unauthorizedRedirect);
	}
}

/**
 * API guard - return 401 instead of redirect
 *
 * @param user - User from event.locals.user
 */
export function requireAuthApi(
	user: UserLocals | null | undefined
): asserts user is UserLocals & { isAuthenticated: true } {
	if (!user || !user.isAuthenticated) {
		throw error(401, 'Unauthorized');
	}
}

/**
 * API guard with role check
 *
 * @param user - User from event.locals.user
 * @param role - Required role
 */
export function requireRoleApi(user: UserLocals | null | undefined, role: string): void {
	requireAuthApi(user);
	if (!user.roles.includes(role)) {
		throw error(403, 'Forbidden');
	}
}

/**
 * API guard requiring any of the specified roles
 *
 * @param user - User from event.locals.user
 * @param roles - Array of roles (any match passes)
 */
export function requireAnyRoleApi(user: UserLocals | null | undefined, roles: string[]): void {
	requireAuthApi(user);
	if (!roles.some((role) => user.roles.includes(role))) {
		throw error(403, 'Forbidden');
	}
}
