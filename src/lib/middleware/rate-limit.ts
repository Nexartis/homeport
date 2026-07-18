/**
 * Rate Limiting Middleware — KV-based per-route rate limiting
 *
 * Uses Cloudflare KV with TTL for fixed-window counters.
 * Rates from NANDA Infrastructure Architecture Appendix D:
 *   POST /register:        10/min
 *   GET /list, /search:    30/min
 *   GET /agentfacts:       60/min
 *   GET /health:          120/min
 *   POST /a2a:             60/min
 *   Federation:            10/min
 *   Global fallback:      300/min
 */

export interface RateLimitConfig {
	/** Maximum requests allowed in the window */
	limit: number;
	/** Window duration in seconds */
	windowSec: number;
}

/** Per-route rate limits (Appendix D) */
const ROUTE_LIMITS: Array<{
	match: (path: string, method: string) => boolean;
	config: RateLimitConfig;
	bucket: string;
}> = [
	{
		match: (p, m) => p === '/register' && m === 'POST',
		config: { limit: 10, windowSec: 60 },
		bucket: 'register'
	},
	{
		match: (p, m) => (p === '/list' || p === '/search') && m === 'GET',
		config: { limit: 30, windowSec: 60 },
		bucket: 'list-search'
	},
	{
		match: (p, _m) => p.startsWith('/agentfacts/'),
		config: { limit: 60, windowSec: 60 },
		bucket: 'agentfacts'
	},
	{
		match: (p, _m) => p === '/health',
		config: { limit: 120, windowSec: 60 },
		bucket: 'health'
	},
	{
		match: (p, m) => p === '/a2a' && m === 'POST',
		config: { limit: 60, windowSec: 60 },
		bucket: 'a2a'
	},
	{
		match: (p, _m) => p.startsWith('/federation/'),
		config: { limit: 10, windowSec: 60 },
		bucket: 'federation'
	}
];

/** Global fallback limit */
const GLOBAL_LIMIT: RateLimitConfig = { limit: 300, windowSec: 60 };

/**
 * Extract client identifier for rate limiting.
 * Uses CF-Connecting-IP header (Cloudflare provides this), falls back to X-Forwarded-For.
 */
function getClientId(request: Request): string {
	return (
		request.headers.get('CF-Connecting-IP') ??
		request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
		'unknown'
	);
}

/**
 * Build the KV key for a rate limit counter.
 * Format: rl:{bucket}:{clientId}:{windowSlot}
 */
function buildKey(
	bucket: string,
	clientId: string,
	windowSec: number
): { key: string; slot: number } {
	const slot = Math.floor(Date.now() / (windowSec * 1000));
	return { key: `rl:${bucket}:${clientId}:${slot}`, slot };
}

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	retryAfterSec?: number;
}

/**
 * Check rate limit for a request. Returns whether the request is allowed.
 * Increments the counter in KV if allowed.
 */
export async function checkRateLimit(kv: KVNamespace, request: Request): Promise<RateLimitResult> {
	const url = new URL(request.url);
	const clientId = getClientId(request);

	// Find matching route limit
	const routeMatch = ROUTE_LIMITS.find((r) => r.match(url.pathname, request.method));
	const config = routeMatch?.config ?? GLOBAL_LIMIT;
	const bucket = routeMatch?.bucket ?? 'global';

	const { key, slot } = buildKey(bucket, clientId, config.windowSec);

	// Read current count
	const current = await kv.get(key);
	const count = current ? parseInt(current, 10) : 0;

	if (count >= config.limit) {
		// Compute remaining time in the current fixed window
		const slotEndMs = (slot + 1) * config.windowSec * 1000;
		const retryAfterSec = Math.max(1, Math.ceil((slotEndMs - Date.now()) / 1000));
		return {
			allowed: false,
			limit: config.limit,
			remaining: 0,
			retryAfterSec
		};
	}

	// Increment — KV put with TTL for auto-expiry
	await kv.put(key, String(count + 1), { expirationTtl: config.windowSec * 2 });

	return {
		allowed: true,
		limit: config.limit,
		remaining: config.limit - count - 1
	};
}

// ===================================================================
// BILLING-AWARE RATE LIMITING (Phase 5 — Agent Bravo)
// ===================================================================

export interface BillingRateLimitResult extends RateLimitResult {
	/** Whether the request was metered (overage tracked instead of blocked) */
	metered: boolean;
	/** NP charge for this overage call (0 if within included or free tier) */
	overageNp: number;
}

/**
 * Check rate limit with billing awareness.
 * - Always enforces per-IP/per-minute DoS rate limiting for all tiers
 * - Always records monthly usage via metering on every allowed request
 * - Free tier: hard block when monthly cap exceeded
 * - Pro/Enterprise: overage billing when over included calls
 *
 * @param kv - KV namespace for rate limit counters
 * @param request - Incoming request
 * @param db - Database client for metering
 * @param keyId - Developer API key ID
 * @param tier - Billing tier of the key
 */
export async function checkRateLimitWithBilling(
	kv: KVNamespace,
	request: Request,
	db: import('$lib/db/client').DbClient,
	keyId: string,
	tier: import('$lib/types/billing').BillingTier
): Promise<BillingRateLimitResult> {
	// 1. Always enforce per-IP/per-minute DoS protection (never bypassed)
	const baseResult = await checkRateLimit(kv, request);
	if (!baseResult.allowed) {
		return { ...baseResult, metered: false, overageNp: 0 };
	}

	// 2. Record API call for monthly usage metering on every allowed request
	const { recordApiCall } = await import('$lib/services/billing/metering');
	const meteringResult = await recordApiCall(db, keyId, tier);

	// 3. If metering blocks (free tier monthly cap exceeded), block the request
	if (!meteringResult.allowed) {
		return {
			allowed: false,
			limit: baseResult.limit,
			remaining: 0,
			metered: true,
			overageNp: 0
		};
	}

	// 4. Request allowed — return with metering info
	return {
		...baseResult,
		metered: true,
		overageNp: meteringResult.chargeNp
	};
}

/**
 * Build a 429 Too Many Requests response with standard headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
	return new Response(
		JSON.stringify({
			error: 'Too Many Requests',
			limit: result.limit,
			retry_after_seconds: result.retryAfterSec
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(result.retryAfterSec ?? 60),
				'X-RateLimit-Limit': String(result.limit),
				'X-RateLimit-Remaining': '0'
			}
		}
	);
}
