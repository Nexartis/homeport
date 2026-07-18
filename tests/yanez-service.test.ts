/**
 * Yanez sign-and-return service — flow + attack matrix.
 *
 * Runs in miniflare (@cloudflare/vitest-pool-workers). Uses a real BLS
 * keypair to produce valid/invalid callbacks and drives the service layer
 * directly against D1.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { bls12_381 } from '@noble/curves/bls12-381';
import { createDbClient } from '../src/lib/db/client';
import type { Env } from '../src/lib/types';
import { markVerified } from '../src/lib/db/repositories/yanez-challenges';
import {
	mintChallenge,
	verifyCallback,
	getStatus,
	isYanezEnabled
} from '../src/lib/services/yanez';
import { BLS_DST } from '../src/lib/crypto/yanez-bls';
import { bytesToHex, b64urlDecode } from '../src/lib/crypto/yanez-encoding';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		KYM_NANDA_HMAC_SECRET: string;
		VITE_BASE_URL: string;
	}
}

const DDL = `CREATE TABLE IF NOT EXISTS yanez_challenges (
	id TEXT PRIMARY KEY NOT NULL,
	kind TEXT NOT NULL DEFAULT 'session',
	status TEXT NOT NULL DEFAULT 'pending',
	subject TEXT,
	message_b64 TEXT NOT NULL,
	callback_url TEXT NOT NULL,
	deep_link TEXT NOT NULL,
	verify_ok INTEGER NOT NULL DEFAULT 0,
	yid TEXT,
	group_public_key TEXT,
	eth_address TEXT,
	signature TEXT,
	payload_json TEXT,
	reason TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	expires_at INTEGER NOT NULL
)`;

// node_settings singleton drives the Yanez enable toggle (isYanezEnabled).
const SETTINGS_DDL = `CREATE TABLE IF NOT EXISTS node_settings (
	id TEXT PRIMARY KEY DEFAULT 'default',
	auth_mode TEXT NOT NULL DEFAULT 'solo',
	waitlist_enabled INTEGER NOT NULL DEFAULT 0,
	default_role TEXT NOT NULL DEFAULT 'developer',
	yanez_enabled INTEGER NOT NULL DEFAULT 0,
	owner_email TEXT, node_name TEXT, support_email TEXT,
	welcome_headline TEXT, welcome_body TEXT, brand_logo_url TEXT, brand_primary_color TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)`;

async function setYanezEnabled(enabled: boolean): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO node_settings (id, yanez_enabled) VALUES ('default', ?1)
		 ON CONFLICT(id) DO UPDATE SET yanez_enabled = ?1`
	)
		.bind(enabled ? 1 : 0)
		.run();
}

const testEnv = () => env as unknown as Env;

/** Extract the `cap` query param from a callback URL. */
function capOf(callbackUrl: string): string {
	return new URL(callbackUrl).searchParams.get('cap') ?? '';
}

/** Build a valid flat callback body for a minted challenge. */
function signedBody(messageB64: string, id: string) {
	const priv = bls12_381.utils.randomPrivateKey();
	const pub = bls12_381.getPublicKey(priv);
	const messageBytes = b64urlDecode(messageB64);
	const sig = bls12_381.sign(messageBytes, priv, { DST: BLS_DST });
	return {
		signature: bytesToHex(sig),
		group_public_key: bytesToHex(pub),
		message: messageB64,
		request_id: id,
		yid: 'a'.repeat(32)
	};
}

beforeAll(async () => {
	await env.DB.prepare(DDL).run();
	await env.DB.prepare(SETTINGS_DDL).run();
	await setYanezEnabled(true);
});

beforeEach(async () => {
	await env.DB.prepare('DELETE FROM yanez_challenges').run();
	await setYanezEnabled(true);
});

describe('yanez service — gating', () => {
	it('isYanezEnabled reflects the node_settings toggle', async () => {
		const db = createDbClient(env.DB);
		await setYanezEnabled(true);
		expect(await isYanezEnabled(db)).toBe(true);
		await setYanezEnabled(false);
		expect(await isYanezEnabled(db)).toBe(false);
		await setYanezEnabled(true); // restore for other tests
	});

	it('mintChallenge fails loud when VITE_BASE_URL is not an https URL', async () => {
		const db = createDbClient(env.DB);
		const badEnv = { ...testEnv(), VITE_BASE_URL: '' } as unknown as Env;
		await expect(mintChallenge(db, badEnv)).rejects.toThrow(/VITE_BASE_URL not configured/);
	});
});

describe('yanez service — happy path', () => {
	it('mints a challenge with a deep link, QR, and callback', async () => {
		const db = createDbClient(env.DB);
		const r = await mintChallenge(db, testEnv(), { subject: 'demo' });
		expect(r.challengeId).toBeTruthy();
		expect(r.deepLink.startsWith('yanezbio://sign?message=')).toBe(true);
		expect(r.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
		expect(r.callbackUrl).toContain(`/api/yanez/callback/${r.challengeId}`);
		expect(r.callbackUrl).toContain('cap=');
		expect(r.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});

	it('verifies a valid signed callback and marks verified', async () => {
		const db = createDbClient(env.DB);
		const r = await mintChallenge(db, testEnv());
		const row = await db.query.yanezChallenges.findFirst();
		const body = signedBody(row!.messageB64, r.challengeId);
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(outcome).toEqual({ ok: true, status: 'verified' });

		const status = await getStatus(db, testEnv(), r.challengeId, r.statusToken);
		expect(status).toMatchObject({ status: 'verified', verifyOk: true });
	});
});

describe('yanez service — attack matrix', () => {
	async function mintRow() {
		const db = createDbClient(env.DB);
		const r = await mintChallenge(db, testEnv());
		const row = await db.query.yanezChallenges.findFirst();
		return { db, r, messageB64: row!.messageB64 };
	}

	it('rejects a wrong callback capability (403)', async () => {
		const { db, r } = await mintRow();
		const body = signedBody(
			r ? (await db.query.yanezChallenges.findFirst())!.messageB64 : '',
			r.challengeId
		);
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, 'deadbeef', body);
		expect(outcome).toMatchObject({ ok: false, httpStatus: 403 });
	});

	it('rejects an unknown challenge id (404)', async () => {
		const db = createDbClient(env.DB);
		const outcome = await verifyCallback(db, testEnv(), 'nope', 'x', {});
		expect(outcome).toMatchObject({ ok: false, httpStatus: 404 });
	});

	it('invalidates a tampered message', async () => {
		const { db, r } = await mintRow();
		const good = signedBody(
			(await db.query.yanezChallenges.findFirst())!.messageB64,
			r.challengeId
		);
		good.message = Buffer.from('different').toString('base64url');
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), good);
		expect(outcome).toMatchObject({ ok: false, httpStatus: 400 });
	});

	it('invalidates a bad BLS signature', async () => {
		const { db, r, messageB64 } = await mintRow();
		const body = signedBody(messageB64, r.challengeId);
		// Corrupt the signature (valid hex, wrong bytes).
		body.signature = '00' + body.signature.slice(2);
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(outcome).toMatchObject({ ok: false, httpStatus: 400 });
	});

	it('invalidates a request_id mismatch', async () => {
		const { db, r, messageB64 } = await mintRow();
		const body = signedBody(messageB64, 'some-other-id');
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(outcome).toMatchObject({ ok: false, httpStatus: 400 });
	});

	it('is single-use: a second callback after verified is 409', async () => {
		const { db, r, messageB64 } = await mintRow();
		const body = signedBody(messageB64, r.challengeId);
		const first = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(first.ok).toBe(true);
		const second = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(second).toMatchObject({ ok: false, httpStatus: 409 });
	});

	it('CAS: markVerified only transitions a pending row (repo-level guard)', async () => {
		const { db, r, messageB64 } = await mintRow();
		const body = signedBody(messageB64, r.challengeId);
		await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		// Row is now terminal; a direct re-mark must return null (lost race), not
		// overwrite the terminal state.
		const again = await markVerified(db, r.challengeId, {
			groupPublicKey: 'x',
			ethAddress: '0x' + '00'.repeat(20),
			signature: 'y',
			payloadJson: '{}'
		});
		expect(again).toBeNull();
	});

	it('expires a past-TTL challenge (410) and does not verify', async () => {
		const db = createDbClient(env.DB);
		const r = await mintChallenge(db, testEnv(), { ttlSec: 30 });
		// Force expiry in the DB.
		await env.DB.prepare('UPDATE yanez_challenges SET expires_at = ? WHERE id = ?')
			.bind(Math.floor(Date.now() / 1000) - 1, r.challengeId)
			.run();
		const body = signedBody(
			(await db.query.yanezChallenges.findFirst())!.messageB64,
			r.challengeId
		);
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(outcome).toMatchObject({ ok: false, httpStatus: 410 });
	});

	it('server re-derives the address (client-claimed spoof ignored)', async () => {
		const { db, r, messageB64 } = await mintRow();
		const body = signedBody(messageB64, r.challengeId) as Record<string, unknown>;
		body.eth_address = '0x' + '11'.repeat(20); // spoofed
		const outcome = await verifyCallback(db, testEnv(), r.challengeId, capOf(r.callbackUrl), body);
		expect(outcome).toEqual({ ok: true, status: 'verified' });
		const row = await db.query.yanezChallenges.findFirst();
		// Stored address is the server-derived one, not the spoof.
		expect(row!.ethAddress).not.toBe('0x' + '11'.repeat(20));
	});

	it('status requires a valid status_token (403 otherwise)', async () => {
		const db = createDbClient(env.DB);
		const r = await mintChallenge(db, testEnv());
		const bad = await getStatus(db, testEnv(), r.challengeId, 'wrong');
		expect(bad).toMatchObject({ httpStatus: 403 });
	});
});
