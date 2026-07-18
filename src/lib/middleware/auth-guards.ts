/**
 * Centralised authentication guards for internal/admin routes.
 *
 * Each guard resolves the relevant secret, validates the request header,
 * and returns a `Response` on failure or `null` on success.
 *
 * Usage:
 *   const denied = await requireCronAuth(request, platform);
 *   if (denied) return denied;
 *
 * TD-2 — Standardize auth middleware
 */
import { json } from '@sveltejs/kit';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';

/** Constant-time string comparison to prevent timing attacks on secret comparison. */
function timingSafeEqual(a: string, b: string): boolean {
	const lengthMismatch = a.length !== b.length ? 1 : 0;
	// Compare against the longer string to avoid leaking length via timing,
	// but always return false when lengths differ.
	const compareLen = Math.max(a.length, b.length);
	let mismatch = lengthMismatch;
	for (let i = 0; i < compareLen; i++) {
		mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}
	return mismatch === 0;
}

/**
 * Require `X-Cron-Auth` header matching the `CRON_AUTH_TOKEN` secret.
 *
 * Returns a `Response` (500 or 401) on failure, or `null` if auth succeeds.
 */
export async function requireCronAuth(
	request: Request,
	platform: App.Platform | undefined
): Promise<Response | null> {
	const cronToken = await resolveSecret(
		platform?.env?.CRON_AUTH_TOKEN,
		kvFallback(platform?.env ?? {}, SECRET_KEYS.CRON_AUTH_TOKEN)
	);
	if (!cronToken) {
		return json({ error: 'CRON_AUTH_TOKEN not configured' }, { status: 500 });
	}

	const authHeader = request.headers.get('X-Cron-Auth') ?? '';
	if (!timingSafeEqual(authHeader, cronToken)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	return null;
}

/**
 * Require `Authorization: Bearer <key>` header matching `NANDA_FEDERATION_ADMIN_KEY`.
 *
 * Returns a `Response` (503 or 401) on failure, or `null` if auth succeeds.
 */
export async function requireFederationAdmin(
	request: Request,
	platform: App.Platform | undefined
): Promise<Response | null> {
	const adminKey = await resolveSecret(
		platform?.env?.NANDA_FEDERATION_ADMIN_KEY,
		kvFallback(platform?.env ?? {}, SECRET_KEYS.FEDERATION_ADMIN_KEY)
	);
	if (!adminKey) {
		return json({ error: 'Federation admin key not configured' }, { status: 503 });
	}

	const authHeader = request.headers.get('Authorization') ?? '';
	if (!timingSafeEqual(authHeader, `Bearer ${adminKey}`)) {
		return json({ error: 'Unauthorized — valid admin key required' }, { status: 401 });
	}

	return null;
}
