/**
 * x402-NP Payment Middleware Tests — 402 responses, header validation,
 * and passthrough behavior when payment headers are present.
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { paymentMiddleware } from '../src/lib/middleware/payment';
import { signHMAC } from '../src/lib/services/auditor/service';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
		KYM_NANDA_RADIUS_SECRET: string;
	}
}

/** D1 table creation statements required for auditor (payment middleware depends on submitTransaction) */
const AUDIT_TABLES = [
	`CREATE TABLE IF NOT EXISTS audit_intents (
    intent_id TEXT PRIMARY KEY, payer TEXT NOT NULL, payee TEXT NOT NULL,
    amount INTEGER NOT NULL, memo TEXT, nonce TEXT,
    window_sec INTEGER DEFAULT 3600, status TEXT DEFAULT 'open',
    created_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_ai_payer ON audit_intents(payer, status)`,
	`CREATE TABLE IF NOT EXISTS audit_settlements (
    settlement_id TEXT PRIMARY KEY, tx_hash TEXT NOT NULL,
    frm TEXT NOT NULL, to_agent TEXT NOT NULL,
    amount INTEGER NOT NULL, ts INTEGER NOT NULL,
    sig TEXT, verified INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_reconciliations (
    recon_id TEXT PRIMARY KEY,
    intent_id TEXT REFERENCES audit_intents(intent_id),
    tx_hash TEXT, verdict TEXT NOT NULL,
    delta INTEGER, latency_ms INTEGER, balances TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_wallets (
    agent_name TEXT PRIMARY KEY, balance_minor INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'NP', scale INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()))`
];

/** Mock next() handler that returns 200 OK */
const mockNext = async (): Promise<Response> =>
	new Response(JSON.stringify({ ok: true }), { status: 200 });

beforeAll(async () => {
	await env.DB.batch(AUDIT_TABLES.map((sql) => env.DB.prepare(sql)));
});

/** Helper to build a request with specific payment headers */
function buildRequest(headers: Record<string, string>): Request {
	return new Request('https://test.local/api/protected', { headers });
}

describe('x402-NP Payment Middleware', () => {
	it('returns 402 when X-PAYMENT-AGENT is missing', async () => {
		const req = buildRequest({
			'X-PAYMENT-TX-ID': '0xabc',
			'X-PAYMENT-AMOUNT': '100'
		});
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
		const body = (await res.json()) as { error: string; protocol: string };
		expect(body.error).toBe('Payment Required');
		expect(body.protocol).toBe('x402-np');
	});

	it('returns 402 when X-PAYMENT-TX-ID is missing', async () => {
		const req = buildRequest({
			'X-PAYMENT-AGENT': 'agent://payer',
			'X-PAYMENT-AMOUNT': '100'
		});
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
	});

	it('returns 402 when X-PAYMENT-AMOUNT is missing', async () => {
		const req = buildRequest({
			'X-PAYMENT-AGENT': 'agent://payer',
			'X-PAYMENT-TX-ID': '0xabc'
		});
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
	});

	it('returns 402 with correct protocol headers', async () => {
		const req = buildRequest({}); // No payment headers at all
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
		expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('true');
		expect(res.headers.get('X-PAYMENT-PROTOCOL')).toBe('x402-np');
		expect(res.headers.get('Content-Type')).toBe('application/json');
	});

	it('returns 402 when amount is invalid (non-numeric)', async () => {
		const req = buildRequest({
			'X-PAYMENT-AGENT': 'agent://payer',
			'X-PAYMENT-TX-ID': '0xabc',
			'X-PAYMENT-AMOUNT': 'not-a-number',
			'X-PAYMENT-SIG': 'dummy-sig'
		});
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid payment amount');
	});

	it('returns 402 when amount is zero', async () => {
		const req = buildRequest({
			'X-PAYMENT-AGENT': 'agent://payer',
			'X-PAYMENT-TX-ID': '0xabc',
			'X-PAYMENT-AMOUNT': '0',
			'X-PAYMENT-SIG': 'dummy-sig'
		});
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid payment amount');
	});

	it('returns 402 when X-PAYMENT-SIG is missing (P0-4)', async () => {
		const req = buildRequest({
			'X-PAYMENT-AGENT': 'agent://payer',
			'X-PAYMENT-TX-ID': '0xtx-middleware-test',
			'X-PAYMENT-AMOUNT': '100'
		});
		// Missing X-PAYMENT-SIG → immediate 402 before submitTransaction
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Missing payment signature (X-PAYMENT-SIG)');
	});

	it('passes through to next() with a valid HMAC signature (P4-3)', async () => {
		const txId = `0xtx-valid-${crypto.randomUUID()}`;
		const agent = 'agent://hmac-payer';
		const payee = 'service'; // default payee
		const amount = 250;
		const ts = Math.floor(Date.now() / 1000);

		// Generate a valid HMAC using the test secret
		const sig = await signHMAC(env.KYM_NANDA_RADIUS_SECRET, txId, agent, payee, amount, ts);

		const req = buildRequest({
			'X-PAYMENT-AGENT': agent,
			'X-PAYMENT-TX-ID': txId,
			'X-PAYMENT-AMOUNT': String(amount),
			'X-PAYMENT-SIG': sig
		});

		// The middleware needs to call submitTransaction, which uses Date.now()
		// for matching. We set the timestamp to now so the HMAC built inside
		// submitTransaction will use a different ts than what we signed.
		// Instead, we need the middleware's ts to match our sig.
		// The middleware calls submitTransaction with Math.floor(Date.now() / 1000).
		// Since ts === Math.floor(Date.now() / 1000) (set just above), as long as
		// this runs within the same second, the sig will match.
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	it('returns 402 with an invalid HMAC signature (P4-3 negative)', async () => {
		const txId = `0xtx-invalid-${crypto.randomUUID()}`;
		const req = buildRequest({
			'X-PAYMENT-AGENT': 'agent://bad-payer',
			'X-PAYMENT-TX-ID': txId,
			'X-PAYMENT-AMOUNT': '100',
			'X-PAYMENT-SIG': 'deadbeef1234567890abcdef' // bogus sig
		});
		const res = await paymentMiddleware(req, env as any, mockNext);
		expect(res.status).toBe(402);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('Invalid payment signature');
	});
});
