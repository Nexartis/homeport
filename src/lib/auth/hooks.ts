/**
 * ⚠️  CUBESTORE SDK FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 * To extend functionality, create wrapper modules that import from this file.
 *
 * Sentinel Auth Hooks
 *
 * SvelteKit hooks integration for Sentinel authentication.
 * Handles session cookies, token validation, and auth state management.
 *
 * Provides two patterns:
 *   Simple:     export const handle = authHandle;  (or createAuthHandle({...}))
 *   Composable: import { validateSessionFromCookies } from '$lib/auth/hooks';
 *               (for complex multi-step middleware pipelines)
 */

import type { Handle } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import {
	createSentinelHandle,
	setSessionCookies,
	getSessionCookies,
	clearAuthCookies,
	COOKIE_NAMES,
	COOKIE_OPTIONS,
	type SentinelHandleOptions,
	type SentinelLocals,
	type AuthHandlerOptions
} from '@nexartis/sentinel-sdk/sveltekit';

import { decodeTokenLocally, isTokenExpired } from '@nexartis/sentinel-sdk/core';
import type { UserLocals } from '@nexartis/sentinel-sdk/core';

import { createSentinelFromPlatform } from './client';

// Re-export from SDK for convenience (used by both patterns)
export {
	createSentinelHandle,
	setSessionCookies,
	getSessionCookies,
	clearAuthCookies,
	COOKIE_NAMES,
	COOKIE_OPTIONS
};

export type { SentinelHandleOptions, SentinelLocals, AuthHandlerOptions };

// ─── Composable Pattern ──────────────────────────────────────────────
// Building blocks for complex multi-step middleware pipelines.
// Use these when your hooks.server.ts has CORS, rate limiting,
// bearer auth, or other middleware that runs before/after auth.

/**
 * Attempt a token refresh and set new cookies.
 *
 * IMPORTANT: On failure we NEVER clear cookies. Sentinel rotates refresh
 * tokens, so concurrent requests can race: request A refreshes R1→R2
 * successfully, but request B still carries R1 which is now invalid.
 * If B clears cookies, it destroys the fresh R2/A2 cookies set by A,
 * logging the user out. Instead, we leave the user as unauthenticated
 * for this single request — the next request will have the valid cookies
 * from A's response and succeed.
 */
async function tryRefreshToken(
	cookies: Cookies,
	refreshToken: string,
	platform: { env?: Record<string, unknown> } | undefined,
	fetchFn: typeof globalThis.fetch
): Promise<UserLocals | null> {
	try {
		const client = createSentinelFromPlatform(platform, undefined, fetchFn);
		const refreshResult = await client.refreshToken(refreshToken);

		if ((refreshResult.code === 0 || refreshResult.success) && refreshResult.access_token) {
			// Update access token cookie
			cookies.set(
				COOKIE_NAMES.ACCESS_TOKEN,
				refreshResult.access_token,
				COOKIE_OPTIONS.ACCESS_TOKEN
			);

			// Update refresh token if rotated — always use LONG (7 days).
			if (refreshResult.refresh_token) {
				cookies.set(COOKIE_NAMES.REFRESH_TOKEN, refreshResult.refresh_token, {
					...COOKIE_OPTIONS.REFRESH_TOKEN_LONG
				});
			}

			const decoded = decodeTokenLocally(refreshResult.access_token);
			if (decoded) {
				return {
					isAuthenticated: true,
					id: decoded.sub,
					email: decoded.email,
					roles: decoded.roles || []
				};
			}
		}
		// Refresh returned non-success — keep tokens, don't clear.
	} catch {
		// Network/transient error — do NOT clear tokens.
	}

	return null;
}

/**
 * Validate JWT from cookies and populate locals.user.
 * Composable building block for multi-step hooks.server.ts pipelines.
 *
 * Uses local JWT decode (no per-request API call) for performance.
 * Falls back to token refresh when expired.
 * Returns the user locals if valid, null otherwise.
 *
 * @example
 *   // In hooks.server.ts step N (cookie-based auth):
 *   const user = await validateSessionFromCookies(event.cookies, event.platform, event.fetch);
 *   if (user) event.locals.user = user;
 */
export async function validateSessionFromCookies(
	cookies: Cookies,
	platform: { env?: Record<string, unknown> } | undefined,
	fetchFn: typeof globalThis.fetch
): Promise<UserLocals | null> {
	const session = getSessionCookies(cookies);

	// Path 1: Valid access token — decode locally (no API call)
	if (session.accessToken && !isTokenExpired(session.accessToken)) {
		const decoded = decodeTokenLocally(session.accessToken);
		if (decoded) {
			return {
				isAuthenticated: true,
				id: decoded.sub,
				email: decoded.email,
				roles: decoded.roles || []
			};
		}
	}

	// Path 2: Access token expired or missing, but refresh token exists.
	if (session.refreshToken) {
		return tryRefreshToken(cookies, session.refreshToken, platform, fetchFn);
	}

	return null;
}

// ─── Simple Pattern ──────────────────────────────────────────────────
// Single-handle auth for basic sites. Use createAuthHandle() or authHandle.

/**
 * Create auth handle with runtime URL detection for Workers for Platforms.
 *
 * Workers deployed via Workers for Platforms don't know their URL at build time.
 * This wrapper detects the runtime URL from the incoming request and injects
 * it as VITE_BASE_URL in platform.env before auth processing.
 *
 * Usage in src/hooks.server.ts:
 * ```typescript
 * import { createAuthHandle } from '$lib/auth/hooks';
 * export const handle = createAuthHandle({
 *   protectedRoutes: ['/dashboard', '/settings'],
 *   loginRedirect: '/auth'
 * });
 * ```
 */
export function createAuthHandle(options?: SentinelHandleOptions): Handle {
	const innerHandle = createSentinelHandle(options);

	return async (input) => {
		// Runtime URL detection for Workers for Platforms
		// Note: In Cloudflare Workers, request.url is set by the CF edge routing
		// layer — it reflects the actual routed domain, not a raw client header,
		// so host/protocol spoofing is not a concern here. CF terminates TLS and
		// sets the URL based on the DNS/route configuration, not raw Host headers.
		if (input.event.platform?.env && input.event.request) {
			try {
				const url = new URL(input.event.request.url);
				// Loopback detection for local dev (SvelteKit dev server, Wrangler, etc.)
				const isLoopback =
					url.hostname === 'localhost' ||
					url.hostname === '127.0.0.1' ||
					url.hostname === '::1' ||
					url.hostname === '0.0.0.0';
				// For non-loopback: force HTTPS protocol. CF terminates TLS and
				// always serves over HTTPS, so http:// in request.url would indicate
				// a misconfigured route — we still want the correct host for auth redirects.
				let protocol = url.protocol;
				if (!isLoopback && protocol !== 'https:') {
					console.warn(
						'[sentinel] Forcing HTTPS for VITE_BASE_URL (request protocol was:',
						protocol + ')'
					);
					protocol = 'https:';
				}
				// Build URL with hostname (not host) to avoid carrying
				// default-for-original-scheme ports across a protocol switch
				// (e.g. http://:80 → https://:80). url.port is "" for default ports.
				// Re-add [] for IPv6 (url.hostname strips brackets, e.g. [::1] → ::1)
				const host = url.hostname.includes(':') ? `[${url.hostname}]` : url.hostname;
				const portSuffix = url.port ? `:${url.port}` : '';
				const baseUrl = `${protocol}//${host}${portSuffix}`;
				// Override if empty or set to a known placeholder / dev value
				const currentBase = input.event.platform.env.VITE_BASE_URL;
				const isPlaceholder =
					!currentBase ||
					currentBase.includes('placeholder') ||
					currentBase.includes('localhost') ||
					currentBase === 'https://';
				if (isPlaceholder) {
					input.event.platform.env.VITE_BASE_URL = baseUrl;
				}
			} catch (e) {
				// Env may be non-writable in some runtimes; proceed without override
				console.debug(
					'[sentinel] Runtime URL detection skipped:',
					e instanceof Error ? e.message : String(e)
				);
			}
		}

		return innerHandle(input);
	};
}

/**
 * Default auth handle with no protected routes
 *
 * Usage in src/hooks.server.ts:
 * ```typescript
 * import { authHandle } from '$lib/auth/hooks';
 * export const handle = authHandle;
 * ```
 */
export const authHandle = createAuthHandle();
