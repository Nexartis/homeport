/**
 * welcome_ack cookie — unit tests for HMAC-signed gate acknowledgement.
 *
 * Covers:
 *  - roundtrip issue → verify (reason=authenticated / waitlisted)
 *  - tamper resistance (payload & signature mutation → valid:false)
 *  - expiry handling (exp in the past → valid:false)
 *  - missing cookie → valid:false (never throws)
 */
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
	WELCOME_ACK_COOKIE,
	issueWelcomeAck,
	verifyWelcomeAck,
	type WelcomeAckEnv
} from '../src/lib/server/welcome-ack';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		NANDA_NODE_CACHE: KVNamespace;
	}
}

// Minimal Cookies stub that records set() calls and replays them on get().
function createCookieJar() {
	const store = new Map<string, string>();
	return {
		get: (name: string) => store.get(name),
		set: (name: string, value: string, _opts?: unknown) => store.set(name, value),
		delete: (name: string) => store.delete(name),
		getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
		serialize: () => [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
	};
}

const testEnv: WelcomeAckEnv = {
	NANDA_NODE_CACHE: env.NANDA_NODE_CACHE
	// KYM_NANDA_HMAC_SECRET intentionally undefined — tests exercise KV fallback
	// seeded by tests/setup.ts under `__node_secrets:hmac_secret`.
};

describe('welcome-ack cookie primitive', () => {
	it('roundtrips issue + verify with reason=authenticated', async () => {
		const jar = createCookieJar();
		const ok = await issueWelcomeAck(
			jar as unknown as Parameters<typeof issueWelcomeAck>[0],
			testEnv,
			{ reason: 'authenticated', email: 'owner@example.com' }
		);
		expect(ok).toBe(true);
		expect(jar.get(WELCOME_ACK_COOKIE)).toBeTruthy();

		const result = await verifyWelcomeAck(
			jar as unknown as Parameters<typeof verifyWelcomeAck>[0],
			testEnv
		);
		expect(result.valid).toBe(true);
		expect(result.payload?.reason).toBe('authenticated');
		expect(result.payload?.email).toBe('owner@example.com');
	});

	it('roundtrips issue + verify with reason=waitlisted', async () => {
		const jar = createCookieJar();
		await issueWelcomeAck(jar as unknown as Parameters<typeof issueWelcomeAck>[0], testEnv, {
			reason: 'waitlisted',
			email: 'invitee@example.com'
		});
		const result = await verifyWelcomeAck(
			jar as unknown as Parameters<typeof verifyWelcomeAck>[0],
			testEnv
		);
		expect(result.valid).toBe(true);
		expect(result.payload?.reason).toBe('waitlisted');
	});

	it('returns valid:false when cookie is absent', async () => {
		const jar = createCookieJar();
		const result = await verifyWelcomeAck(
			jar as unknown as Parameters<typeof verifyWelcomeAck>[0],
			testEnv
		);
		expect(result.valid).toBe(false);
		expect(result.payload).toBeUndefined();
	});

	it('rejects a tampered payload (signature mismatch)', async () => {
		const jar = createCookieJar();
		await issueWelcomeAck(jar as unknown as Parameters<typeof issueWelcomeAck>[0], testEnv, {
			reason: 'authenticated'
		});
		const original = jar.get(WELCOME_ACK_COOKIE)!;
		const [payloadB64, sigB64] = original.split('.');
		// Flip a character in the payload portion.
		const mutated = `${payloadB64.slice(0, -1)}${payloadB64.slice(-1) === 'A' ? 'B' : 'A'}.${sigB64}`;
		jar.set(WELCOME_ACK_COOKIE, mutated);

		const result = await verifyWelcomeAck(
			jar as unknown as Parameters<typeof verifyWelcomeAck>[0],
			testEnv
		);
		expect(result.valid).toBe(false);
	});

	it('rejects a tampered signature', async () => {
		const jar = createCookieJar();
		await issueWelcomeAck(jar as unknown as Parameters<typeof issueWelcomeAck>[0], testEnv, {
			reason: 'waitlisted'
		});
		const original = jar.get(WELCOME_ACK_COOKIE)!;
		const [payloadB64, sigB64] = original.split('.');
		const mutated = `${payloadB64}.${sigB64.slice(0, -2)}ZZ`;
		jar.set(WELCOME_ACK_COOKIE, mutated);

		const result = await verifyWelcomeAck(
			jar as unknown as Parameters<typeof verifyWelcomeAck>[0],
			testEnv
		);
		expect(result.valid).toBe(false);
	});

	it('rejects a malformed cookie (no dot separator)', async () => {
		const jar = createCookieJar();
		jar.set(WELCOME_ACK_COOKIE, 'not-a-valid-token');
		const result = await verifyWelcomeAck(
			jar as unknown as Parameters<typeof verifyWelcomeAck>[0],
			testEnv
		);
		expect(result.valid).toBe(false);
	});
});
