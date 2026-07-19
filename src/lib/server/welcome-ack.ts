/**
 * welcome_ack cookie — HMAC-signed acknowledgement that the visitor has
 * passed the WelcomeGate (either by authenticating or joining the waitlist).
 *
 * Cookie shape: `<base64url(payload)>.<base64url(sig)>` where
 *   payload = JSON.stringify({ reason, email?, issuedAt, exp })
 *   sig     = HMAC-SHA256(KYM_NANDA_HMAC_SECRET, payload)
 *
 * Cookie name: `welcome_ack`
 * Attributes:  HttpOnly · Secure · SameSite=Lax · Path=/ · Max-Age=30d
 */

import type { Cookies } from '@sveltejs/kit';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback } from '$lib/utils/node-secrets';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'welcome-ack');

export const WELCOME_ACK_COOKIE = 'welcome_ack';
export const WELCOME_ACK_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const HMAC_ALGO = { name: 'HMAC', hash: 'SHA-256' } as const;

export type WelcomeAckReason = 'authenticated' | 'waitlisted';

export interface WelcomeAckPayload {
	reason: WelcomeAckReason;
	email?: string;
	issuedAt: number;
	exp: number;
}

export interface WelcomeAckEnv {
	KYM_NANDA_HMAC_SECRET?: string | { get: () => Promise<string> };
	NANDA_NODE_CACHE?: KVNamespace;
}

export interface WelcomeAckVerifyResult {
	valid: boolean;
	payload?: WelcomeAckPayload;
}

// --- base64url helpers (SSR-safe — no Buffer, no DOM) -------------------------
function base64urlEncode(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
	const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : '';
	const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
	const keyBytes = new TextEncoder().encode(secret);
	return crypto.subtle.importKey('raw', keyBytes, HMAC_ALGO, false, ['sign', 'verify']);
}

async function resolveHmacSecret(env: WelcomeAckEnv): Promise<string | undefined> {
	return resolveSecret(env.KYM_NANDA_HMAC_SECRET, kvFallback(env, 'hmac_secret'));
}

/**
 * Issue a signed welcome_ack cookie. Best-effort — never throws.
 * Returns true on success, false when the HMAC secret could not be resolved.
 */
export async function issueWelcomeAck(
	cookies: Cookies,
	env: WelcomeAckEnv,
	input: { reason: WelcomeAckReason; email?: string }
): Promise<boolean> {
	const secret = await resolveHmacSecret(env);
	if (!secret) {
		log.warn('issueWelcomeAck', 'HMAC secret unavailable — skipping cookie issuance');
		return false;
	}

	try {
		const nowSec = Math.floor(Date.now() / 1000);
		const payload: WelcomeAckPayload = {
			reason: input.reason,
			email: input.email?.trim().toLowerCase() || undefined,
			issuedAt: nowSec,
			exp: nowSec + WELCOME_ACK_MAX_AGE
		};
		const payloadJson = JSON.stringify(payload);
		const payloadBytes = new TextEncoder().encode(payloadJson);
		const key = await importKey(secret);
		const sig = await crypto.subtle.sign(HMAC_ALGO, key, payloadBytes);
		const token = `${base64urlEncode(payloadBytes)}.${base64urlEncode(new Uint8Array(sig))}`;

		cookies.set(WELCOME_ACK_COOKIE, token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: WELCOME_ACK_MAX_AGE
		});
		return true;
	} catch (err) {
		log.error('issueWelcomeAck', 'Failed to sign cookie', {
			error: err instanceof Error ? err.message : String(err)
		});
		return false;
	}
}

/** Constant-time comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

/**
 * Verify a welcome_ack cookie. Returns { valid: false } when missing,
 * malformed, tampered, or expired. Never throws.
 */
export async function verifyWelcomeAck(
	cookies: Cookies,
	env: WelcomeAckEnv
): Promise<WelcomeAckVerifyResult> {
	const raw = cookies.get(WELCOME_ACK_COOKIE);
	if (!raw) return { valid: false };

	const secret = await resolveHmacSecret(env);
	if (!secret) return { valid: false };

	const dot = raw.indexOf('.');
	if (dot <= 0 || dot === raw.length - 1) return { valid: false };
	const payloadB64 = raw.slice(0, dot);
	const sigB64 = raw.slice(dot + 1);

	try {
		const payloadBytes = base64urlDecode(payloadB64);
		const providedSig = base64urlDecode(sigB64);
		const key = await importKey(secret);
		const expected = new Uint8Array(
			await crypto.subtle.sign(HMAC_ALGO, key, payloadBytes as BufferSource)
		);
		if (!timingSafeEqual(expected, providedSig)) return { valid: false };

		const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as WelcomeAckPayload;
		const now = Math.floor(Date.now() / 1000);
		if (!payload.exp || payload.exp < now) return { valid: false };
		if (payload.reason !== 'authenticated' && payload.reason !== 'waitlisted') {
			return { valid: false };
		}
		return { valid: true, payload };
	} catch {
		return { valid: false };
	}
}
