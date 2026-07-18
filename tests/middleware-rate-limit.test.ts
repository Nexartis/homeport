/**
 * Rate Limiting Middleware Tests — checkRateLimit + rateLimitResponse
 *
 * Tests the KV-based fixed-window rate limiter directly (unit-level)
 * and via SELF.fetch() (integration-level) to verify hooks.server.ts wiring.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { checkRateLimit, rateLimitResponse } from '../src/lib/middleware/rate-limit';
import type { RateLimitResult } from '../src/lib/middleware/rate-limit';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

/** Flush all KV keys matching the rate-limit prefix */
async function clearRateLimitKeys() {
	const list = await env.NANDA_NODE_CACHE.list({ prefix: 'rl:' });
	for (const key of list.keys) {
		await env.NANDA_NODE_CACHE.delete(key.name);
	}
}

function buildRequest(path: string, method = 'GET', clientIp = '10.99.0.1'): Request {
	return new Request(`http://localhost${path}`, {
		method,
		headers: {
			'CF-Connecting-IP': clientIp,
			'Content-Type': 'application/json'
		}
	});
}

// ==================================================================
// Unit tests — checkRateLimit
// ==================================================================

describe('checkRateLimit — unit', () => {
	beforeEach(async () => {
		await clearRateLimitKeys();
	});

	it('allows first request and decrements remaining', async () => {
		const result = await checkRateLimit(env.NANDA_NODE_CACHE, buildRequest('/search'));
		expect(result.allowed).toBe(true);
		expect(result.limit).toBe(30); // list-search bucket
		expect(result.remaining).toBe(29);
	});

	it('matches POST /register bucket (limit 10)', async () => {
		const result = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/register', 'POST', '10.99.1.1')
		);
		expect(result.allowed).toBe(true);
		expect(result.limit).toBe(10);
		expect(result.remaining).toBe(9);
	});

	it('matches /agentfacts/ prefix bucket (limit 60)', async () => {
		const result = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/agentfacts/agent-1', 'GET', '10.99.1.2')
		);
		expect(result.limit).toBe(60);
		expect(result.remaining).toBe(59);
	});

	it('matches /health bucket (limit 120)', async () => {
		const result = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/health', 'GET', '10.99.1.3')
		);
		expect(result.limit).toBe(120);
	});

	it('matches POST /a2a bucket (limit 60)', async () => {
		const result = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/a2a', 'POST', '10.99.1.4')
		);
		expect(result.limit).toBe(60);
	});

	it('matches /federation/ prefix bucket (limit 10)', async () => {
		const result = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/federation/sync', 'GET', '10.99.1.5')
		);
		expect(result.limit).toBe(10);
	});

	it('falls back to global limit (300) for unknown routes', async () => {
		const result = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/some/random/path', 'GET', '10.99.1.6')
		);
		expect(result.limit).toBe(300);
		expect(result.remaining).toBe(299);
	});

	it('uses X-Forwarded-For when CF-Connecting-IP is absent', async () => {
		const req = new Request('http://localhost/search', {
			headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' }
		});
		const result = await checkRateLimit(env.NANDA_NODE_CACHE, req);
		expect(result.allowed).toBe(true);
		// Second call with same IP should decrement remaining
		const result2 = await checkRateLimit(env.NANDA_NODE_CACHE, req);
		expect(result2.remaining).toBe(result.remaining - 1);
	});

	it('blocks request when limit is exhausted', async () => {
		const ip = '10.99.2.1';
		// POST /register has limit 10 — exhaust it
		for (let i = 0; i < 10; i++) {
			const r = await checkRateLimit(env.NANDA_NODE_CACHE, buildRequest('/register', 'POST', ip));
			expect(r.allowed).toBe(true);
		}
		// 11th request should be blocked
		const blocked = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/register', 'POST', ip)
		);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
	});

	it('isolates rate limits per client IP', async () => {
		const ipA = '10.99.3.1';
		const ipB = '10.99.3.2';
		// Exhaust limit for IP A
		for (let i = 0; i < 10; i++) {
			await checkRateLimit(env.NANDA_NODE_CACHE, buildRequest('/register', 'POST', ipA));
		}
		// IP B should still be allowed
		const resultB = await checkRateLimit(
			env.NANDA_NODE_CACHE,
			buildRequest('/register', 'POST', ipB)
		);
		expect(resultB.allowed).toBe(true);
		expect(resultB.remaining).toBe(9);
	});

	it('isolates rate limits per route bucket', async () => {
		const ip = '10.99.4.1';
		// Exhaust /register (limit 10)
		for (let i = 0; i < 10; i++) {
			await checkRateLimit(env.NANDA_NODE_CACHE, buildRequest('/register', 'POST', ip));
		}
		// /search (different bucket) should still be allowed
		const result = await checkRateLimit(env.NANDA_NODE_CACHE, buildRequest('/search', 'GET', ip));
		expect(result.allowed).toBe(true);
		expect(result.limit).toBe(30);
	});
});

// ==================================================================
// rateLimitResponse helper
// ==================================================================

describe('rateLimitResponse', () => {
	it('builds a 429 response with correct headers and body', async () => {
		const result: RateLimitResult = { allowed: false, limit: 10, remaining: 0, retryAfterSec: 42 };
		const res = rateLimitResponse(result);
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('42');
		expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
		expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
		const body = (await res.json()) as {
			error: string;
			limit: number;
			retry_after_seconds: number;
		};
		expect(body.error).toBe('Too Many Requests');
		expect(body.limit).toBe(10);
		expect(body.retry_after_seconds).toBe(42);
	});

	it('defaults Retry-After to 60 when retryAfterSec is undefined', async () => {
		const result: RateLimitResult = { allowed: false, limit: 300, remaining: 0 };
		const res = rateLimitResponse(result);
		expect(res.headers.get('Retry-After')).toBe('60');
	});
});

// ==================================================================
// Integration — SELF.fetch() triggers hooks.server.ts rate limiter
// ==================================================================

describe('Rate limiting via hooks.server.ts (integration)', () => {
	beforeEach(async () => {
		await clearRateLimitKeys();
	});

	it('returns 429 after exhausting /register limit via SELF.fetch()', async () => {
		const ip = '10.99.10.1';
		// POST /register has limit 10
		for (let i = 0; i < 10; i++) {
			const res = await SELF.fetch('http://localhost/register', {
				method: 'POST',
				headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' },
				body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
			});
			// Might be 200 or 400 (validation) — but NOT 429 yet
			expect(res.status).not.toBe(429);
		}
		// 11th should be 429
		const blocked = await SELF.fetch('http://localhost/register', {
			method: 'POST',
			headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
		});
		expect(blocked.status).toBe(429);
		const body = (await blocked.json()) as { error: string };
		expect(body.error).toBe('Too Many Requests');
	});

	it('different client IPs are independently rate-limited', async () => {
		const ip1 = '10.99.11.1';
		const ip2 = '10.99.11.2';
		// Exhaust limit for ip1
		for (let i = 0; i < 10; i++) {
			await SELF.fetch('http://localhost/register', {
				method: 'POST',
				headers: { 'CF-Connecting-IP': ip1, 'Content-Type': 'application/json' },
				body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
			});
		}
		// ip1 blocked
		const blocked = await SELF.fetch('http://localhost/register', {
			method: 'POST',
			headers: { 'CF-Connecting-IP': ip1, 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
		});
		expect(blocked.status).toBe(429);

		// ip2 should still work
		const ok = await SELF.fetch('http://localhost/register', {
			method: 'POST',
			headers: { 'CF-Connecting-IP': ip2, 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
		});
		expect(ok.status).not.toBe(429);
	});

	it('429 response includes Retry-After header', async () => {
		const ip = '10.99.12.1';
		for (let i = 0; i < 10; i++) {
			await SELF.fetch('http://localhost/register', {
				method: 'POST',
				headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' },
				body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
			});
		}
		const blocked = await SELF.fetch('http://localhost/register', {
			method: 'POST',
			headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_url: 'https://example.com', capabilities: ['test'] })
		});
		expect(blocked.status).toBe(429);
		const retryAfter = blocked.headers.get('Retry-After');
		expect(retryAfter).toBeDefined();
		expect(parseInt(retryAfter!, 10)).toBeGreaterThanOrEqual(1);
	});
});
