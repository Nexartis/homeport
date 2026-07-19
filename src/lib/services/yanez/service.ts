/**
 * Yanez sign-and-return service.
 *
 * Flow: mint a challenge -> render a `yanezbio://sign` deep link + QR that
 * carries a callback URL back to this node -> the Yanez app POSTs a flat,
 * BLS-signed payload to the callback -> verify (single-use, byte-equal
 * message, BLS verify, address re-derivation) -> persist.
 *
 * Ported from the shipping `nexartis-yanez-client` (`yanez-do.ts`), with the
 * Durable Object store replaced by D1 and env by the node's secret helpers.
 */

import type { Env } from '$lib/types';
import type { DbClient } from '$lib/db/client';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { getSettings } from '$lib/services/node-settings';
import { createLogger } from '$lib/utils/logger';
import {
	createChallenge,
	getChallenge,
	markVerified,
	markInvalid,
	markExpired
} from '$lib/db/repositories';
import { verifyBls, verifyAddressBinding } from '$lib/crypto/yanez-bls';
import {
	buildDeepLink,
	callbackCapability,
	statusToken as buildStatusToken
} from '$lib/crypto/yanez-deeplink';
import { b64url, b64urlDecode, utf8Bytes, utf8String, randomHex } from '$lib/crypto/yanez-encoding';
import type {
	MintOptions,
	MintResult,
	StatusResult,
	VerifyOutcome,
	YanezCallbackBody,
	YanezKind
} from './types';

const log = createLogger(undefined, 'yanez-service');

const KIND: YanezKind = 'session';
const DEFAULT_TTL_SEC = 300;
const MIN_TTL_SEC = 30;
const MAX_TTL_SEC = 3600;

/**
 * Operator opt-in switch, read from the `node_settings.yanez_enabled` toggle
 * (owner-controlled in /admin/settings/auth). Off by default.
 */
export async function isYanezEnabled(db: DbClient): Promise<boolean> {
	const settings = await getSettings(db);
	return settings.yanezEnabled;
}

function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

function clampTtl(ttlSec?: number): number {
	if (typeof ttlSec !== 'number' || !Number.isFinite(ttlSec)) return DEFAULT_TTL_SEC;
	return Math.min(MAX_TTL_SEC, Math.max(MIN_TTL_SEC, Math.floor(ttlSec)));
}

async function hmacSecret(env: Env): Promise<string> {
	const secret = await resolveSecret(
		env.KYM_NANDA_HMAC_SECRET,
		kvFallback(env, SECRET_KEYS.HMAC_SECRET)
	);
	if (!secret) {
		throw new Error(
			'KYM_NANDA_HMAC_SECRET not configured (required for Yanez callback capability)'
		);
	}
	return secret;
}

function publicBase(env: Env): string {
	const base = env.VITE_BASE_URL;
	// Fail loud: an empty/relative base would mint an unreachable callback URL
	// and the whole sign-and-return flow would silently never complete.
	if (!base || !/^https:\/\//.test(base)) {
		throw new Error('VITE_BASE_URL not configured (required for Yanez deep-link callback URL)');
	}
	return base.replace(/\/$/, '');
}

/**
 * Mint a signing request. Returns the deep link, QR, callback URL, and a
 * status-poll token. Persists a `pending` challenge row.
 */
export async function mintChallenge(
	db: DbClient,
	env: Env,
	opts: MintOptions = {}
): Promise<MintResult> {
	const id = crypto.randomUUID();
	const message = opts.message ?? `nanda-yanez:${id}:${randomHex(16)}`;
	const messageB64 = b64url(utf8Bytes(message));
	const ttl = clampTtl(opts.ttlSec);
	const created = nowSec();
	const expiresAt = created + ttl;

	const secret = await hmacSecret(env);
	const cap = await callbackCapability(secret, KIND, id);
	const statusToken = await buildStatusToken(secret, KIND, id);
	const { callbackUrl, deepLink, qrDataUrl } = await buildDeepLink(
		publicBase(env),
		cap,
		id,
		messageB64
	);

	await createChallenge(db, {
		id,
		kind: KIND,
		status: 'pending',
		subject: opts.subject ?? null,
		messageB64,
		callbackUrl,
		deepLink,
		verifyOk: false,
		createdAt: created,
		updatedAt: created,
		expiresAt
	});

	return { challengeId: id, deepLink, qrDataUrl, callbackUrl, statusToken, expiresAt };
}

/**
 * Verify a flat sign-and-return callback. Single-use: only a `pending`,
 * unexpired challenge with a matching `cap` can transition. Ported verbatim
 * (semantics) from `yanez-do.ts:callback`.
 */
export async function verifyCallback(
	db: DbClient,
	env: Env,
	id: string,
	cap: string | null,
	body: YanezCallbackBody
): Promise<VerifyOutcome> {
	const record = await getChallenge(db, id);
	if (!record) return { ok: false, httpStatus: 404, error: 'unknown request' };

	const secret = await hmacSecret(env);
	const expectedCap = await callbackCapability(secret, record.kind, record.id);
	if (!cap || cap !== expectedCap) {
		return { ok: false, httpStatus: 403, error: 'invalid callback capability' };
	}

	// Single-use: a challenge leaves `pending` exactly once. This is the cheap
	// early check; the authoritative guard is the compare-and-swap in the
	// terminal mark* calls below (which return null if another callback won the
	// race between here and the write).
	if (record.status !== 'pending') {
		return { ok: false, httpStatus: 409, error: `challenge already ${record.status}` };
	}

	if (nowSec() > record.expiresAt) {
		const expired = await markExpired(db, id);
		// If the CAS returned null, another callback terminalized it first.
		return expired
			? { ok: false, httpStatus: 410, error: 'challenge expired' }
			: { ok: false, httpStatus: 409, error: 'challenge already consumed' };
	}

	const signature = typeof body.signature === 'string' ? body.signature : '';
	const groupPublicKey = typeof body.group_public_key === 'string' ? body.group_public_key : '';
	const echoedB64 = typeof body.message === 'string' ? body.message : '';
	const requestId = typeof body.request_id === 'string' ? body.request_id : '';
	const yid = typeof body.yid === 'string' ? body.yid : null;

	if (requestId && requestId !== record.id) {
		return invalidate(db, id, `request_id mismatch (got ${requestId})`);
	}
	if (!signature || !groupPublicKey || !echoedB64) {
		return invalidate(db, id, 'missing signature, group_public_key, or message');
	}

	// Byte-equal message check against the stored challenge.
	const expected = b64urlDecode(record.messageB64);
	let echoed: Uint8Array;
	try {
		echoed = b64urlDecode(echoedB64);
	} catch {
		return invalidate(db, id, 'echoed message is not valid base64url');
	}
	if (utf8String(echoed) !== utf8String(expected)) {
		return invalidate(db, id, 'echoed message does not match challenge');
	}

	// verifyBls returns false (never throws) on malformed input or bad signature.
	if (!verifyBls(signature, groupPublicKey, expected)) {
		return invalidate(db, id, 'BLS signature did not verify');
	}

	// Server-side address re-derivation is authoritative.
	const binding = verifyAddressBinding(body.eth_address, groupPublicKey);
	const payload = {
		yid,
		group_public_key: groupPublicKey,
		eth_address: binding.derived,
		eth_address_claimed: typeof body.eth_address === 'string' ? body.eth_address : null,
		eth_address_binding_ok: binding.ok,
		signature,
		message_b64: echoedB64
	};

	const verified = await markVerified(db, id, {
		yid,
		groupPublicKey,
		ethAddress: binding.derived,
		signature,
		payloadJson: JSON.stringify(payload)
	});
	// Compare-and-swap lost: a concurrent callback already consumed the
	// challenge. Do not report success twice.
	if (!verified) {
		return { ok: false, httpStatus: 409, error: 'challenge already consumed' };
	}

	log.info('verifyCallback', 'challenge verified', { id, addressBindingOk: binding.ok });
	return { ok: true, status: 'verified' };
}

async function invalidate(db: DbClient, id: string, reason: string): Promise<VerifyOutcome> {
	// CAS: only invalidates a still-pending row. If another callback won, we
	// still return the invalidation error to this caller (their input was bad
	// regardless of the race), but we never overwrite a terminal state.
	await markInvalid(db, id, reason);
	log.warn('verifyCallback', 'challenge invalidated', { id, reason });
	return { ok: false, httpStatus: 400, error: reason };
}

/**
 * Read challenge status. Requires the caller's `status_token` to match the
 * one minted for this challenge (so status is not world-readable).
 */
export async function getStatus(
	db: DbClient,
	env: Env,
	id: string,
	token: string | null
): Promise<StatusResult | { error: string; httpStatus: number }> {
	const record = await getChallenge(db, id);
	if (!record) return { error: 'unknown request', httpStatus: 404 };

	const secret = await hmacSecret(env);
	const expected = await buildStatusToken(secret, record.kind, record.id);
	if (!token || token !== expected) {
		return { error: 'invalid status token', httpStatus: 403 };
	}

	// Lazily reflect expiry for a still-pending challenge.
	if (record.status === 'pending' && nowSec() > record.expiresAt) {
		await markExpired(db, id);
		return { status: 'expired', verifyOk: false, yid: null, ethAddress: null };
	}

	return {
		status: record.status as StatusResult['status'],
		verifyOk: record.verifyOk,
		yid: record.yid,
		ethAddress: record.ethAddress
	};
}
