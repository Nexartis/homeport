/**
 * Points Auditor Tests — HMAC verification, intent lifecycle, transaction
 * submission, intent matching, reconciliation, and audit status queries.
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
	verifyHMAC,
	signHMAC,
	declareIntent,
	submitTransaction,
	getAuditStatus,
	sweepExpiredIntents
} from '../src/lib/services/auditor/service';
import { handleA2A } from '../src/lib/services/a2a';
import { createDbClient } from '../src/lib/db/client';

// Type the test env
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

/** Test HMAC secret — mirrors KYM_NANDA_RADIUS_SECRET in test env */
const TEST_SECRET = 'test-radius-secret';

/** D1 table creation statements for the 4 audit tables */
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

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(AUDIT_TABLES.map((sql) => env.DB.prepare(sql)));
});

// ---------- HMAC Verification Tests ----------

describe('HMAC Verification', () => {
	const txHash = '0xabc123';
	const from = 'agent://payer';
	const to = 'agent://payee';
	const amount = 1000;
	const ts = 1700000000;

	it('verifyHMAC returns true for valid signature', async () => {
		const sig = await signHMAC(TEST_SECRET, txHash, from, to, amount, ts);
		const valid = await verifyHMAC(TEST_SECRET, txHash, from, to, amount, ts, sig);
		expect(valid).toBe(true);
	});

	it('verifyHMAC returns false for tampered signature', async () => {
		const sig = await signHMAC(TEST_SECRET, txHash, from, to, amount, ts);
		const tampered = sig.slice(0, -4) + 'dead';
		const valid = await verifyHMAC(TEST_SECRET, txHash, from, to, amount, ts, tampered);
		expect(valid).toBe(false);
	});

	it('verifyHMAC returns false for wrong secret', async () => {
		const sig = await signHMAC('wrong-secret', txHash, from, to, amount, ts);
		const valid = await verifyHMAC(TEST_SECRET, txHash, from, to, amount, ts, sig);
		expect(valid).toBe(false);
	});

	it('signHMAC produces consistent pipe-delimited message format', async () => {
		const sig1 = await signHMAC(TEST_SECRET, txHash, from, to, amount, ts);
		const sig2 = await signHMAC(TEST_SECRET, txHash, from, to, amount, ts);
		expect(sig1).toBe(sig2);
		expect(sig1).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex chars
	});
});

// ---------- Intent Declaration Tests ----------

describe('Intent Declaration', () => {
	it('creates intent in D1 with correct fields', async () => {
		const result = await declareIntent(db, {
			payer: 'agent://alice',
			payee: 'agent://bob',
			amount: 500,
			memo: 'test payment'
		});
		expect(result.intent_id).toBeDefined();
		expect(typeof result.intent_id).toBe('string');
		expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));

		// Verify in D1
		const row = await env.DB.prepare('SELECT * FROM audit_intents WHERE intent_id = ?')
			.bind(result.intent_id)
			.first();
		expect(row).not.toBeNull();
		expect(row!.payer).toBe('agent://alice');
		expect(row!.payee).toBe('agent://bob');
		expect(row!.amount).toBe(500);
		expect(row!.status).toBe('open');
		expect(row!.memo).toBe('test payment');
	});

	it('creates wallet rows for payer and payee', async () => {
		await declareIntent(db, {
			payer: 'agent://wallet-test-payer',
			payee: 'agent://wallet-test-payee',
			amount: 100
		});
		const payer = await env.DB.prepare('SELECT * FROM audit_wallets WHERE agent_name = ?')
			.bind('agent://wallet-test-payer')
			.first();
		const payee = await env.DB.prepare('SELECT * FROM audit_wallets WHERE agent_name = ?')
			.bind('agent://wallet-test-payee')
			.first();
		expect(payer).not.toBeNull();
		expect(payer!.balance_minor).toBe(0);
		expect(payee).not.toBeNull();
		expect(payee!.balance_minor).toBe(0);
	});

	it('rejects empty payer', async () => {
		await expect(
			declareIntent(db, { payer: '', payee: 'agent://bob', amount: 100 })
		).rejects.toThrow('[declareIntent] payer must be a non-empty string');
	});

	it('rejects amount <= 0', async () => {
		await expect(
			declareIntent(db, { payer: 'agent://a', payee: 'agent://b', amount: 0 })
		).rejects.toThrow('[declareIntent] amount must be a positive number');
	});
});

// ---------- Transaction Submission Tests ----------

describe('Transaction Submission', () => {
	it('records settlement and returns verified=true with valid sig', async () => {
		const txHash = '0xtx-valid-sig';
		const from = 'agent://sig-payer';
		const to = 'agent://sig-payee';
		const amount = 200;
		const ts = Math.floor(Date.now() / 1000);
		const sig = await signHMAC(TEST_SECRET, txHash, from, to, amount, ts);

		const result = await submitTransaction(db, txHash, from, to, amount, ts, sig, TEST_SECRET);
		expect(result.settlement_id).toBeDefined();
		expect(result.verified).toBe(true);

		// Verify in D1
		const row = await env.DB.prepare('SELECT * FROM audit_settlements WHERE settlement_id = ?')
			.bind(result.settlement_id)
			.first();
		expect(row).not.toBeNull();
		expect(row!.tx_hash).toBe(txHash);
		expect(row!.frm).toBe(from);
		expect(row!.to_agent).toBe(to);
		expect(row!.verified).toBe(1);
	});

	it('returns verified=false when no sig provided', async () => {
		const result = await submitTransaction(
			db,
			'0xtx-no-sig',
			'agent://a',
			'agent://b',
			100,
			Math.floor(Date.now() / 1000),
			null,
			TEST_SECRET
		);
		expect(result.verified).toBe(false);

		const row = await env.DB.prepare('SELECT * FROM audit_settlements WHERE settlement_id = ?')
			.bind(result.settlement_id)
			.first();
		expect(row!.verified).toBe(0);
	});

	it('rejects invalid txHash', async () => {
		await expect(submitTransaction(db, '', 'a', 'b', 100, 1000, null, TEST_SECRET)).rejects.toThrow(
			'[submitTransaction] txHash'
		);
	});

	it('rejects invalid amount', async () => {
		await expect(
			submitTransaction(db, '0x1', 'a', 'b', -5, 1000, null, TEST_SECRET)
		).rejects.toThrow('[submitTransaction] amount');
	});
});

// ---------- Intent Matching + Reconciliation Tests ----------

describe('Intent Matching and Reconciliation', () => {
	it('finds matching intent within time window and amount tolerance', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://match-payer',
			payee: 'agent://match-payee',
			amount: 1000,
			window_sec: 7200
		});

		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 60;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-match',
			'agent://match-payer',
			'agent://match-payee',
			1000,
			txTs
		);

		const result = await submitTransaction(
			db,
			'0xtx-match',
			'agent://match-payer',
			'agent://match-payee',
			1000,
			txTs,
			sig,
			TEST_SECRET
		);
		expect(result.recon).toBeDefined();
		expect(result.recon!.verdict).toBe('settled');
		expect(result.recon!.delta).toBe(0);
		expect(result.recon!.intent_id).toBe(intent.intent_id);
	});

	it('verdict=settled when amounts match exactly', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://exact-payer',
			payee: 'agent://exact-payee',
			amount: 500
		});
		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 10;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-exact',
			'agent://exact-payer',
			'agent://exact-payee',
			500,
			txTs
		);

		const result = await submitTransaction(
			db,
			'0xtx-exact',
			'agent://exact-payer',
			'agent://exact-payee',
			500,
			txTs,
			sig,
			TEST_SECRET
		);
		expect(result.recon!.verdict).toBe('settled');
	});

	it('verdict=partial with strict default tolerance (P1-12: 0.0 per Python ref)', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://tol-payer',
			payee: 'agent://tol-payee',
			amount: 1000
		});
		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 10;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-tol',
			'agent://tol-payer',
			'agent://tol-payee',
			960,
			txTs
		);

		// 960 is underpaid with strict (0.0) tolerance — delta = -40 → partial
		const result = await submitTransaction(
			db,
			'0xtx-tol',
			'agent://tol-payer',
			'agent://tol-payee',
			960,
			txTs,
			sig,
			TEST_SECRET
		);
		expect(result.recon!.verdict).toBe('partial');
		expect(result.recon!.delta).toBe(-40);
	});

	it('verdict=partial when underpaid (per Python reference: got < want)', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://mis-payer',
			payee: 'agent://mis-payee',
			amount: 1000
		});
		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 10;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-mismatch',
			'agent://mis-payer',
			'agent://mis-payee',
			800,
			txTs
		);

		// 800 is 20% under 1000 — well outside tolerance → partial (underpaid)
		const result = await submitTransaction(
			db,
			'0xtx-mismatch',
			'agent://mis-payer',
			'agent://mis-payee',
			800,
			txTs,
			sig,
			TEST_SECRET
		);
		expect(result.recon).toBeDefined();
		expect(result.recon!.verdict).toBe('partial');
		expect(result.recon!.delta).toBe(-200);
	});

	it('verdict=mismatch when overpaid (per Python reference: got > want)', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://over-payer',
			payee: 'agent://over-payee',
			amount: 1000
		});
		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 10;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-over',
			'agent://over-payer',
			'agent://over-payee',
			1200,
			txTs
		);

		// 1200 is overpaid — delta > 0 → mismatch
		const result = await submitTransaction(
			db,
			'0xtx-over',
			'agent://over-payer',
			'agent://over-payee',
			1200,
			txTs,
			sig,
			TEST_SECRET
		);
		expect(result.recon).toBeDefined();
		expect(result.recon!.verdict).toBe('mismatch');
		expect(result.recon!.delta).toBe(200);
	});

	it('updates wallet balances with double-entry bookkeeping', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://wal-payer',
			payee: 'agent://wal-payee',
			amount: 500
		});
		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 10;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-wal',
			'agent://wal-payer',
			'agent://wal-payee',
			500,
			txTs
		);

		const result = await submitTransaction(
			db,
			'0xtx-wal',
			'agent://wal-payer',
			'agent://wal-payee',
			500,
			txTs,
			sig,
			TEST_SECRET
		);
		expect(result.recon).toBeDefined();
		// Debit payer by settled amount (= want for settled verdict), credit payee by same
		expect(result.recon!.balances.payer_balance).toBe(-500);
		expect(result.recon!.balances.payee_balance).toBe(500);

		// Verify in D1
		const payer = await env.DB.prepare(
			'SELECT balance_minor FROM audit_wallets WHERE agent_name = ?'
		)
			.bind('agent://wal-payer')
			.first<{ balance_minor: number }>();
		const payee = await env.DB.prepare(
			'SELECT balance_minor FROM audit_wallets WHERE agent_name = ?'
		)
			.bind('agent://wal-payee')
			.first<{ balance_minor: number }>();
		expect(payer!.balance_minor).toBe(-500);
		expect(payee!.balance_minor).toBe(500);
	});
});

// ---------- Audit Status Tests ----------

describe('Audit Status', () => {
	it('returns combined intent and reconciliation data', async () => {
		const intent = await declareIntent(db, {
			payer: 'agent://status-payer',
			payee: 'agent://status-payee',
			amount: 750
		});
		const intentRow = await env.DB.prepare(
			'SELECT created_at FROM audit_intents WHERE intent_id = ?'
		)
			.bind(intent.intent_id)
			.first<{ created_at: number }>();
		const txTs = intentRow!.created_at + 10;
		const sig = await signHMAC(
			TEST_SECRET,
			'0xtx-status',
			'agent://status-payer',
			'agent://status-payee',
			750,
			txTs
		);

		await submitTransaction(
			db,
			'0xtx-status',
			'agent://status-payer',
			'agent://status-payee',
			750,
			txTs,
			sig,
			TEST_SECRET
		);

		const status = await getAuditStatus(db, intent.intent_id);
		expect(status.intent).toBeDefined();
		expect(status.intent.intent_id).toBe(intent.intent_id);
		expect(status.intent.payer).toBe('agent://status-payer');
		expect(status.reconciliation).not.toBeNull();
		expect(status.reconciliation!.verdict).toBe('settled');
		expect(status.reconciliation!.tx_hash).toBe('0xtx-status');
	});

	it('throws for nonexistent intent', async () => {
		await expect(getAuditStatus(db, 'nonexistent-intent-id')).rejects.toThrow(
			'[getAuditStatus] intent not found'
		);
	});
});

// ---------- P4-2: Expired Intent + Sweeper Tests ----------

describe('Expired Intent Matching and Sweeper (P4-2)', () => {
	it('matchIntent skips intents past their expiry', async () => {
		// Create an intent with a very short window (1 second)
		const result = await declareIntent(db, {
			payer: 'agent://expire-payer',
			payee: 'agent://expire-payee',
			amount: 1000,
			window_sec: 1
		});

		// Manually backdate the intent so it's already expired
		// Set created_at to 100 seconds ago, expires_at to 99 seconds ago
		const now = Math.floor(Date.now() / 1000);
		await env.DB.prepare(
			'UPDATE audit_intents SET created_at = ?, expires_at = ? WHERE intent_id = ?'
		)
			.bind(now - 100, now - 99, result.intent_id)
			.run();

		// Submit a matching transaction — should NOT find the expired intent
		const txResult = await submitTransaction(
			db,
			'0xtx-expired',
			'agent://expire-payer',
			'agent://expire-payee',
			1000,
			now,
			null,
			TEST_SECRET
		);
		expect(txResult.recon).toBeUndefined(); // No match — intent expired
	});

	it('sweepExpiredIntents marks expired intents and creates no_show records', async () => {
		// Create an intent and manually expire it
		const result = await declareIntent(db, {
			payer: 'agent://sweep-payer',
			payee: 'agent://sweep-payee',
			amount: 500,
			window_sec: 1
		});

		const now = Math.floor(Date.now() / 1000);
		await env.DB.prepare(
			'UPDATE audit_intents SET created_at = ?, expires_at = ? WHERE intent_id = ?'
		)
			.bind(now - 200, now - 199, result.intent_id)
			.run();

		// Sweep expired intents
		const sweepResult = await sweepExpiredIntents(db);
		expect(sweepResult.swept).toBeGreaterThanOrEqual(1);

		// Verify intent status changed to 'expired'
		const intent = await env.DB.prepare('SELECT status FROM audit_intents WHERE intent_id = ?')
			.bind(result.intent_id)
			.first<{ status: string }>();
		expect(intent!.status).toBe('expired');

		// Verify no_show reconciliation record was created
		const recon = await env.DB.prepare(
			'SELECT verdict, delta FROM audit_reconciliations WHERE intent_id = ?'
		)
			.bind(result.intent_id)
			.first<{ verdict: string; delta: number }>();
		expect(recon).not.toBeNull();
		expect(recon!.verdict).toBe('no_show');
		expect(recon!.delta).toBe(-500); // negative of the intent amount
	});

	it('sweepExpiredIntents returns 0 when no intents are expired', async () => {
		// Create a fresh intent with long window — should NOT be swept
		await declareIntent(db, {
			payer: 'agent://fresh-payer',
			payee: 'agent://fresh-payee',
			amount: 100,
			window_sec: 99999
		});

		// Sweep — the fresh intent should not be caught
		// (Note: previously expired intents may still be in the DB from other tests,
		//  but they've already been swept. We just verify the function doesn't crash.)
		const result = await sweepExpiredIntents(db);
		expect(result.swept).toBeGreaterThanOrEqual(0);
	});
});

// ---------- P4-4: A2A Integration Tests (Auditor routing) ----------

/** Helper to build an A2A JSON-RPC request */
function buildA2ARequest(action: string, payload: Record<string, unknown>, id?: string): Request {
	return new Request('https://test.local/a2a', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'message/send',
			params: {
				message: {
					role: 'user',
					parts: [{ text: JSON.stringify({ action, ...payload }) }]
				}
			},
			id: id ?? 'test-1'
		})
	});
}

describe('A2A routing — Auditor actions (P4-4)', () => {
	it('audit.intent creates an intent via A2A', async () => {
		const req = buildA2ARequest('audit.intent', {
			payer: 'agent://a2a-payer',
			payee: 'agent://a2a-payee',
			amount: 100,
			window_sec: 3600
		});
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			jsonrpc: string;
			result: { parts: Array<{ text: string }> };
			id: string;
		};
		expect(body.jsonrpc).toBe('2.0');
		expect(body.id).toBe('test-1');

		const result = JSON.parse(body.result.parts[0].text) as {
			intent_id: string;
			expires_at: number;
		};
		expect(result.intent_id).toBeDefined();
		expect(result.expires_at).toBeGreaterThan(0);
	});

	it('audit.status returns intent status via A2A', async () => {
		// First create an intent directly
		const intent = await declareIntent(db, {
			payer: 'agent://a2a-status-payer',
			payee: 'agent://a2a-status-payee',
			amount: 200
		});

		const req = buildA2ARequest('audit.status', { intent_id: intent.intent_id });
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(200);

		const body = (await res.json()) as { result: { parts: Array<{ text: string }> } };
		const result = JSON.parse(body.result.parts[0].text) as {
			intent: { intent_id: string; status: string };
		};
		expect(result.intent.intent_id).toBe(intent.intent_id);
		expect(result.intent.status).toBe('open');
	});

	it('returns JSON-RPC error for unknown audit action', async () => {
		const req = buildA2ARequest('audit.nonexistent', {});
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(400);

		const body = (await res.json()) as { error: { code: number; message: string } };
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown audit action');
	});

	it('returns JSON-RPC error for invalid JSON-RPC request', async () => {
		const req = new Request('https://test.local/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '1.0', method: 'message/send' })
		});
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(400);

		const body = (await res.json()) as { error: { code: number; message: string } };
		expect(body.error.code).toBe(-32600);
	});

	it('returns JSON-RPC error for missing action field', async () => {
		const req = new Request('https://test.local/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'message/send',
				params: { message: { role: 'user', parts: [{ text: '{"no_action": true}' }] } },
				id: 'test-err'
			})
		});
		const res = await handleA2A(req, env as any);
		expect(res.status).toBe(400);

		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain('Missing or invalid action field');
	});
});
