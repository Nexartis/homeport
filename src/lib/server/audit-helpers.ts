/**
 * Admin audit helpers — small utilities used by the /api/admin routes to
 * pull consistent actor + request metadata into every audit row.
 */

import type { RequestEvent } from '@sveltejs/kit';

export interface AuditContext {
	actorUserId: string | null;
	actorEmail: string | null;
	ip: string | null;
	userAgent: string | null;
}

/**
 * Extract the client IP from the request. Prefers Cloudflare's
 * `CF-Connecting-IP`, falls back to `X-Forwarded-For`, then null.
 */
export function extractClientIp(request: Request): string | null {
	const cf = request.headers.get('CF-Connecting-IP');
	if (cf) return cf.trim();
	const fwd = request.headers.get('X-Forwarded-For');
	if (fwd) return fwd.split(',')[0].trim();
	return null;
}

/** Build an AuditContext from a SvelteKit request event. */
export function auditContext(event: RequestEvent): AuditContext {
	const user = event.locals.user;
	return {
		actorUserId: user?.id ?? null,
		actorEmail: user?.email ?? null,
		ip: extractClientIp(event.request),
		userAgent: event.request.headers.get('User-Agent') ?? null
	};
}

/**
 * Resolve the absolute base URL used in invitation emails.
 * Priority: platform.env.VITE_BASE_URL → request origin.
 */
export function resolveBaseUrl(event: RequestEvent): string {
	const envBase = event.platform?.env?.VITE_BASE_URL;
	if (envBase && typeof envBase === 'string') return envBase.replace(/\/+$/, '');
	return new URL(event.request.url).origin;
}
