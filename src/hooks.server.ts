/**
 * SvelteKit Server Hooks — CORS + Rate Limiting + API Key Auth + Sentinel Auth + Protected Routes
 *
 * Middleware pipeline:
 *  1. CORS preflight
 *  2. Rate limiting (KV-based per-route)
 *  3. Runtime URL detection (for Workers for Platforms compatibility)
 *  4. Initialize auth state
 *  5. Bearer token authentication (nanda_ API keys for developer program)
 *  6. Cookie-based Sentinel JWT authentication with auto-refresh
 *  7. Protected routes guard (/admin, /api/admin)
 *  8. Resolve + CORS
 *  9. Security headers
 */
import type { Handle } from '@sveltejs/kit';
import { checkRateLimit, rateLimitResponse } from '$lib/middleware/rate-limit';
import { validateSessionFromCookies, COOKIE_NAMES, clearAuthCookies } from '$lib/auth/hooks';
import { createLogger } from '$lib/utils/logger';
import { createDbClient } from '$lib/db/client';
import { validateDevApiKey, incrementDevKeyUsage } from '$lib/db/repositories';
import { areKeysInitialized } from '$lib/services/key-management';
import { isLoginAllowed } from '$lib/services/node-settings';

const log = createLogger(undefined, 'hooks');

// =============================================================================
// CORS HEADERS (P3-1: env-based origin allowlist for production)
// =============================================================================
//
// Production CORS resolution (first match wins):
//   1. env.CORS_ALLOWED_ORIGINS   — explicit comma-separated allowlist
//   2. env.NANDA_PROD_ORIGINS     — Nexartis-hosted fallback allowlist
//   3. env.VITE_BASE_URL          — tenant's own base URL (single-origin fallback)
//
// If none are present in a production build we log an error and OMIT the
// Access-Control-Allow-Origin header entirely (browsers then block cross-origin
// requests) rather than shipping a hardcoded `nanda.nexartis.com` origin into
// every tenant deployment. Non-production keeps the wildcard behaviour.

/**
 * Build CORS headers for the current request.
 * dev/test → wildcard `*`
 * production → reflect request Origin if it's in the allowlist, else first allowlist entry.
 * If no allowed origin can be resolved in production, the
 * `Access-Control-Allow-Origin` header is omitted (cross-origin requests are
 * blocked by the browser).
 */
function buildCorsHeaders(
	request: Request,
	env?: {
		ENVIRONMENT?: string;
		CORS_ALLOWED_ORIGINS?: string;
		NANDA_PROD_ORIGINS?: string;
		VITE_BASE_URL?: string;
	}
): Record<string, string> {
	const environment = env?.ENVIRONMENT ?? 'development';
	const baseHeaders: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers':
			'Content-Type, Authorization, Accept, X-PAYMENT-AGENT, X-PAYMENT-TX-ID, X-PAYMENT-AMOUNT, X-PAYMENT-SIG'
	};
	let origin: string | null = '*';
	if (environment === 'production') {
		const allowedStr = env?.CORS_ALLOWED_ORIGINS || env?.NANDA_PROD_ORIGINS || env?.VITE_BASE_URL;
		const allowed = allowedStr
			? allowedStr
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: [];
		if (allowed.length === 0) {
			// Missing every possible source of a production origin. Refuse to
			// silently fall back to a Nexartis-hardcoded value. Omitting the
			// Access-Control-Allow-Origin header (rather than setting the
			// 'null' anti-pattern value, which sandboxed iframes would match)
			// makes browsers block cross-origin requests.
			log.error(
				'buildCorsHeaders',
				'No production CORS origin configured (CORS_ALLOWED_ORIGINS / NANDA_PROD_ORIGINS / VITE_BASE_URL all empty)'
			);
			origin = null;
		} else {
			const requestOrigin = request.headers.get('Origin');
			origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
		}
	}
	if (origin === null) {
		return baseHeaders;
	}
	return {
		'Access-Control-Allow-Origin': origin,
		...baseHeaders
	};
}

/** Pathname patterns that are rate-limited API routes (preserved exactly from original) */
function isApiRoute(pathname: string): boolean {
	return (
		pathname === '/register' ||
		pathname.startsWith('/lookup/') ||
		pathname === '/list' ||
		pathname === '/search' ||
		pathname.startsWith('/agentfacts/') ||
		pathname.startsWith('/agents/') ||
		pathname === '/stats' ||
		pathname === '/health' ||
		pathname === '/a2a' ||
		pathname.startsWith('/federation/') ||
		pathname.startsWith('/.well-known/keys/') ||
		pathname.startsWith('/credentials/status/') ||
		pathname === '/reputation' ||
		pathname === '/mcp' ||
		pathname === '/trust/badges'
	);
}

/** Wrap a Response with CORS headers */
function addCors(response: Response, corsHeaders: Record<string, string>): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders)) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

// Token refresh is now handled by validateSessionFromCookies() from $lib/auth/hooks

// =============================================================================
// PROTECTED ROUTES — only /admin and /api/admin in NANDA
// =============================================================================
const PROTECTED_ROUTES = ['/admin', '/api/admin'];

export const handle: Handle = async ({ event, resolve }) => {
	// =========================================================================
	// 1. RUNTIME URL DETECTION (must run BEFORE CORS so the CORS fallback
	//    chain can see the freshly-detected VITE_BASE_URL for Workers for
	//    Platforms tenants that rely on it as their only origin source)
	// =========================================================================
	if (event.platform?.env) {
		const url = new URL(event.request.url);
		const detectedBaseUrl = `${url.protocol}//${url.host}`;
		event.platform.env.VITE_BASE_URL = detectedBaseUrl;
	}

	// =========================================================================
	// 2. CORS PREFLIGHT
	// =========================================================================
	const corsHeaders = buildCorsHeaders(event.request, event.platform?.env);
	if (event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	// =========================================================================
	// 3. RATE LIMITING (preserved exactly from original)
	// =========================================================================
	const { pathname } = event.url;
	if (isApiRoute(pathname) && event.platform?.env?.NANDA_NODE_CACHE) {
		const rl = await checkRateLimit(event.platform.env.NANDA_NODE_CACHE, event.request);
		if (!rl.allowed) {
			return addCors(rateLimitResponse(rl), corsHeaders);
		}
	}

	// =========================================================================
	// 4. INITIALIZE AUTH STATE
	// =========================================================================
	event.locals.user = null;
	event.locals.apiKey = null;

	// =========================================================================
	// 5. BEARER TOKEN AUTH (API Key for developer program — nanda_ prefix)
	// =========================================================================
	const authHeader = event.request.headers.get('Authorization');
	if (authHeader && /^Bearer /i.test(authHeader) && event.platform?.env?.DB) {
		const rawKey = authHeader.slice(7).trim();
		if (rawKey.startsWith('nanda_')) {
			try {
				const db = createDbClient(event.platform.env.DB);
				let result = await validateDevApiKey(db, rawKey);

				// Rate-limited key → 429 on API routes; ignore on non-API pages
				if (result && 'rateLimited' in result) {
					if (isApiRoute(pathname)) {
						const retryAfterSec = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
						return addCors(
							new Response(
								JSON.stringify({
									error: 'Too Many Requests',
									limit: result.limit,
									retry_after_seconds: retryAfterSec
								}),
								{
									status: 429,
									headers: {
										'Content-Type': 'application/json',
										'Retry-After': String(retryAfterSec),
										'X-RateLimit-Limit': String(result.limit),
										'X-RateLimit-Remaining': '0'
									}
								}
							),
							corsHeaders
						);
					}
					// Non-API route with rate-limited key: treat as unauthenticated
					result = null;
				}

				if (result) {
					event.locals.user = {
						isAuthenticated: true,
						id: result.ownerId,
						email: result.ownerEmail || '',
						roles: [] // API key users have no admin roles
					};
					// Defensively parse scopes — malformed DB data should not break auth
					let parsedScopes: string[] | null = null;
					if (result.scopes) {
						try {
							const parsed = JSON.parse(result.scopes);
							parsedScopes =
								Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === 'string')
									? (parsed as string[])
									: null;
						} catch {
							log.warn('handle', 'Malformed scopes JSON for API key', { keyId: result.id });
						}
					}
					event.locals.apiKey = {
						id: result.id,
						tier: result.tier,
						scopes: parsedScopes
					};
					// Increment usage counter in the background
					if (event.platform.context) {
						event.platform.context.waitUntil(incrementDevKeyUsage(db, result.id));
					} else {
						await incrementDevKeyUsage(db, result.id);
					}
				}
			} catch (err) {
				log.error('handle', 'API key validation error', {
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}

	// =========================================================================
	// 6. COOKIE-BASED SENTINEL JWT AUTH (skip if already authenticated via Bearer)
	// Uses @nexartis/sentinel-sdk for local JWT decode + automatic token refresh.
	// =========================================================================
	if (!event.locals.apiKey) {
		try {
			const user = await validateSessionFromCookies(event.cookies, event.platform, event.fetch);
			if (user) {
				// ── Login-gate validation (Launch Roadmap §4.3) ───────────
				// Delegates to NodeSettingsService.isLoginAllowed which enforces
				// the configured auth mode (solo / invite / open) and the owner
				// email. Falls back to SITE_OWNER_EMAIL when D1 or settings are
				// unavailable (pre-migration / Pegasus bootstrap).
				const ownerEmail = event.platform?.env?.SITE_OWNER_EMAIL;
				let allowedRole: 'admin' | 'developer' | 'viewer' | null = null;
				let allowed = false;
				if (event.platform?.env?.DB && user.email) {
					try {
						const db = createDbClient(event.platform.env.DB);
						const gate = await isLoginAllowed(db, user.email, ownerEmail);
						allowed = gate.ok;
						allowedRole = gate.role ?? null;
					} catch (gateErr) {
						log.error('handle', 'isLoginAllowed failed — falling back to owner env', {
							error: gateErr instanceof Error ? gateErr.message : String(gateErr)
						});
						// Fall back to env-only owner check so bootstrap still works.
						if (ownerEmail && user.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase()) {
							allowed = true;
							allowedRole = 'admin';
						}
					}
				} else if (
					ownerEmail &&
					user.email?.trim().toLowerCase() === ownerEmail.trim().toLowerCase()
				) {
					// No DB binding — fall back to env-only owner check.
					allowed = true;
					allowedRole = 'admin';
				}

				if (!allowed) {
					log.warn('handle', 'JWT rejected by login gate', { email: user.email });
					clearAuthCookies(event.cookies);
					// Don't set event.locals.user — treat as unauthenticated
				} else {
					// Attach the role returned by the gate if the JWT doesn't
					// already carry it (Pegasus / fresh deployments).
					if (allowedRole && !user.roles?.includes(allowedRole)) {
						user.roles = [...(user.roles ?? []), allowedRole];
					}
					event.locals.user = user;
					// Invitation acceptance, owner-email bootstrap, and welcome_ack
					// issuance have moved to the SDK `onAfterClaim` hook in
					// `src/routes/api/auth/[...path]/+server.ts`. They run exactly
					// once per claim rather than on every authenticated request.
				}
			}
		} catch (error) {
			log.error('handle', 'Sentinel session validation error', {
				error: error instanceof Error ? error.message : String(error)
			});
			// Continue without user — don't block the request
		}
	}

	// =========================================================================
	// 7. PROTECTED ROUTES CHECK
	// =========================================================================
	const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

	if (isProtectedRoute && !event.locals.user) {
		// API routes return JSON 401, UI routes redirect to auth page
		if (pathname.startsWith('/api/')) {
			return addCors(
				new Response(JSON.stringify({ error: 'Authentication required' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				}),
				corsHeaders
			);
		}
		return new Response('Redirect', {
			status: 302,
			headers: { Location: `/auth?redirect=${encodeURIComponent(pathname)}` }
		});
	}

	// =========================================================================
	// 7.5. UNCONFIGURED STATE GUARD (Pegasus deployments)
	// If KV exists but node secrets are not yet initialized, public API
	// endpoints return 503 and admin pages redirect to /admin/keys.
	// Skips: /health, /admin/keys, /api/admin/keys, /auth, static assets.
	// =========================================================================
	const kv = event.platform?.env?.NANDA_NODE_CACHE;
	if (kv) {
		// Paths that must work even when keys aren't initialized:
		// - /admin/keys (+ API) → the setup page itself
		// - /auth → login flow
		// - /health → health checks
		// - /api/cron → scheduled handler must run to bootstrap
		// - static assets, federation gossip, public registry endpoints
		const skipGuardPaths = [
			'/health',
			'/admin/keys', // the setup page itself (NOT all of /admin)
			'/api/admin/keys', // the setup API (NOT all of /api/admin)
			'/auth',
			'/_app',
			'/favicon',
			'/.well-known',
			'/federation',
			'/list',
			'/lookup',
			'/search',
			'/register',
			'/resolve',
			'/reputation',
			'/stats',
			'/a2a',
			'/mcp',
			'/agentfacts',
			'/agents',
			'/api/cron',
			'/api/developers',
			'/api/auth',
			'/api/public'
		];
		const shouldCheckKeys = !skipGuardPaths.some((p) => pathname.startsWith(p));
		if (shouldCheckKeys) {
			try {
				const initialized = await areKeysInitialized(kv);
				if (!initialized) {
					if (pathname.startsWith('/api/')) {
						return addCors(
							new Response(JSON.stringify({ error: 'Node not configured', setup: '/admin/keys' }), {
								status: 503,
								headers: { 'Content-Type': 'application/json' }
							}),
							corsHeaders
						);
					}
					if (pathname.startsWith('/admin')) {
						return new Response('Redirect', {
							status: 302,
							headers: { Location: '/admin/keys' }
						});
					}
					// Public pages render normally even before key setup.
					// The admin sees the onboarding wizard after login at /admin.
				}
			} catch (err) {
				// If KV check fails, don't block — log and continue
				log.error('handle', 'Key initialization check failed', {
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}

	// =========================================================================
	// 8. RESOLVE + CORS (preserved from original, with security headers added)
	// =========================================================================
	const response = await resolve(event);
	const corsResponse = addCors(response, corsHeaders);

	// =========================================================================
	// 9. SECURITY HEADERS
	// =========================================================================
	corsResponse.headers.set('X-Frame-Options', 'DENY');
	corsResponse.headers.set('X-Content-Type-Options', 'nosniff');
	corsResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	corsResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	corsResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return corsResponse;
};
