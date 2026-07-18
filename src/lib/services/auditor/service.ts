/**
 * Points Auditor Service — HMAC-verified transaction reconciliation
 *
 * Provides intent declaration, transaction submission with HMAC-SHA256 verification,
 * intent matching within configurable time windows, reconciliation with configurable amount
 * tolerance for verdict determination, double-entry wallet operations, and audit status queries.
 *
 * Reference: nanda-infrastructure/agents/points_auditor/langchain_points_auditor.py
 * Crypto: Web Crypto API (HMAC-SHA256) using KYM_NANDA_RADIUS_SECRET
 * Storage: Cloudflare D1 — audit_intents, audit_settlements, audit_reconciliations, audit_wallets
 */

import type { Env } from '$lib/types';
import type { DbClient } from '$lib/db/client';
import type { AuditIntent } from '$lib/db/schema';
import { hmacHex } from '$lib/crypto/hmac';
import {
	insertIntent,
	getIntentById,
	findOpenIntents,
	updateIntentStatus,
	getExpiredOpenIntents,
	insertSettlement,
	ensureWallets,
	updateWalletBalances,
	getWalletBalance,
	insertReconciliation,
	getReconciliationByIntent,
	sweepExpiredIntent
} from '$lib/db/repositories';

/** Default intent matching window in seconds */
const DEFAULT_WINDOW_SEC = 3600;

/** Amount tolerance for reconciliation verdict determination. Default 0.0 (strict match per Python ref). Override: AUDIT_AMOUNT_TOL env var. */
const AMOUNT_TOLERANCE = 0.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row shape for audit_intents D1 table */
export interface IntentRow {
	intent_id: string;
	payer: string;
	payee: string;
	amount: number;
	memo: string | null;
	nonce: string | null;
	window_sec: number;
	status: string;
	created_at: number;
	expires_at: number;
}

/** Row shape for audit_settlements D1 table */
export interface SettlementRow {
	settlement_id: string;
	tx_hash: string;
	frm: string;
	to_agent: string;
	amount: number;
	ts: number;
	sig: string | null;
	verified: number;
	created_at: number;
}

/** Reconciliation result returned from reconcile() */
export interface ReconResult {
	recon_id: string;
	intent_id: string | null;
	tx_hash: string | null;
	verdict: 'settled' | 'partial' | 'mismatch' | 'no_show';
	delta: number;
	latency_ms: number;
	balances: { payer_balance: number; payee_balance: number };
}

/** Combined audit status for an intent */
export interface AuditStatus {
	intent: IntentRow;
	reconciliation: ReconResult | null;
}

/** Internal: matched intent during transaction processing */
interface IntentMatch {
	intent: IntentRow;
}

/** Convert Drizzle camelCase AuditIntent to snake_case IntentRow */
function toIntentRow(row: AuditIntent): IntentRow {
	return {
		intent_id: row.intentId,
		payer: row.payer,
		payee: row.payee,
		amount: row.amount,
		memo: row.memo ?? null,
		nonce: row.nonce ?? null,
		window_sec: row.windowSec ?? 3600,
		status: row.status ?? 'open',
		created_at: row.createdAt ?? 0,
		expires_at: row.expiresAt ?? 0
	};
}

// ---------------------------------------------------------------------------
// HMAC Verification — uses the shared crypto/hmac helper
// ---------------------------------------------------------------------------

/**
 * Verify an HMAC-SHA256 signature over transaction fields.
 *
 * Message format: `"${txHash}|${from}|${to}|${amount}|${ts}"` (pipe-delimited).
 *
 * @param secret - The HMAC signing key (KYM_NANDA_RADIUS_SECRET)
 * @param txHash - Transaction hash
 * @param from - Sender identifier
 * @param to - Recipient identifier
 * @param amount - Transaction amount in NP minor units
 * @param ts - Unix timestamp of the transaction
 * @param signature - Hex-encoded HMAC-SHA256 signature to verify
 * @returns true if the signature is valid
 */
export async function verifyHMAC(
	secret: string,
	txHash: string,
	from: string,
	to: string,
	amount: number,
	ts: number,
	signature: string
): Promise<boolean> {
	const message = `${txHash}|${from}|${to}|${amount}|${ts}`;
	const expected = await hmacHex(secret, message);
	// Timing-safe comparison: compare all bytes regardless of early mismatch
	if (expected.length !== signature.length) return false;
	let mismatch = 0;
	for (let i = 0; i < expected.length; i++) {
		mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Generate an HMAC-SHA256 signature for transaction fields.
 * Exposed for testing purposes.
 *
 * @param secret - The HMAC signing key
 * @param txHash - Transaction hash
 * @param from - Sender identifier
 * @param to - Recipient identifier
 * @param amount - Transaction amount in NP minor units
 * @param ts - Unix timestamp
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export async function signHMAC(
	secret: string,
	txHash: string,
	from: string,
	to: string,
	amount: number,
	ts: number
): Promise<string> {
	const message = `${txHash}|${from}|${to}|${amount}|${ts}`;
	return hmacHex(secret, message);
}

// ---------------------------------------------------------------------------
// Intent Declaration
// ---------------------------------------------------------------------------

/**
 * Declare a payment intent between two agents.
 *
 * Creates an open intent record in D1 and ensures wallet rows exist for both
 * payer and payee. The intent will expire after `window_sec` seconds (default 3600).
 *
 * @param db - D1 database binding
 * @param intent - Intent parameters
 * @returns The created intent_id and expiration timestamp
 * @throws Error if required fields are missing or invalid
 */
export async function declareIntent(
	db: DbClient,
	intent: {
		payer: string;
		payee: string;
		amount: number;
		memo?: string;
		nonce?: string;
		window_sec?: number;
	},
	env?: Env
): Promise<{ intent_id: string; expires_at: number }> {
	// Validate required fields
	if (!intent.payer || typeof intent.payer !== 'string') {
		throw new Error('[declareIntent] payer must be a non-empty string');
	}
	if (!intent.payee || typeof intent.payee !== 'string') {
		throw new Error('[declareIntent] payee must be a non-empty string');
	}
	if (typeof intent.amount !== 'number' || intent.amount <= 0) {
		throw new Error('[declareIntent] amount must be a positive number');
	}

	const intentId = crypto.randomUUID();
	const defaultWindow = parseInt(env?.AUDIT_MATCH_WINDOW_SEC ?? '', 10) || DEFAULT_WINDOW_SEC;
	const windowSec = intent.window_sec ?? defaultWindow;
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + windowSec;

	// Insert intent row
	await insertIntent(db, {
		intentId,
		payer: intent.payer,
		payee: intent.payee,
		amount: intent.amount,
		memo: intent.memo ?? null,
		nonce: intent.nonce ?? null,
		windowSec,
		status: 'open',
		expiresAt
	});

	// Ensure wallet rows exist for both payer and payee (idempotent)
	await ensureWallets(db, [intent.payer, intent.payee]);

	return { intent_id: intentId, expires_at: expiresAt };
}

// ---------------------------------------------------------------------------
// Transaction Submission
// ---------------------------------------------------------------------------

/**
 * Submit a transaction for auditing.
 *
 * Records the settlement in D1, verifies the HMAC signature if provided,
 * attempts to match against open intents, and reconciles if a match is found.
 *
 * @param db - D1 database binding
 * @param txHash - Transaction hash identifier
 * @param from - Sender agent identifier
 * @param to - Recipient agent identifier
 * @param amount - Transaction amount in NP minor units
 * @param ts - Unix timestamp of the transaction
 * @param sig - Optional HMAC-SHA256 hex signature
 * @param radiusSecret - The KYM_NANDA_RADIUS_SECRET for HMAC verification
 * @returns Settlement ID, verification status, and optional reconciliation result
 * @throws Error if required fields are missing or invalid
 */
export async function submitTransaction(
	db: DbClient,
	txHash: string,
	from: string,
	to: string,
	amount: number,
	ts: number,
	sig: string | null,
	radiusSecret: string,
	env?: Env
): Promise<{ settlement_id: string; verified: boolean; recon?: ReconResult }> {
	// Validate required fields
	if (!txHash || typeof txHash !== 'string') {
		throw new Error('[submitTransaction] txHash must be a non-empty string');
	}
	if (!from || typeof from !== 'string') {
		throw new Error('[submitTransaction] from must be a non-empty string');
	}
	if (!to || typeof to !== 'string') {
		throw new Error('[submitTransaction] to must be a non-empty string');
	}
	if (typeof amount !== 'number' || amount <= 0) {
		throw new Error('[submitTransaction] amount must be a positive number');
	}
	if (typeof ts !== 'number' || ts <= 0) {
		throw new Error('[submitTransaction] ts must be a positive unix timestamp');
	}

	const settlementId = crypto.randomUUID();

	// Verify HMAC signature if provided
	let verified = false;
	if (sig) {
		verified = await verifyHMAC(radiusSecret, txHash, from, to, amount, ts, sig);
	}

	// Insert settlement row
	await insertSettlement(db, {
		settlementId,
		txHash,
		frm: from,
		toAgent: to,
		amount,
		ts,
		sig,
		verified: verified ? 1 : 0
	});

	// Attempt intent matching
	const match = await matchIntent(db, from, to, amount, ts);
	let recon: ReconResult | undefined;

	if (match) {
		// Build a SettlementRow for reconciliation
		const settlement: SettlementRow = {
			settlement_id: settlementId,
			tx_hash: txHash,
			frm: from,
			to_agent: to,
			amount,
			ts,
			sig,
			verified: verified ? 1 : 0,
			created_at: Math.floor(Date.now() / 1000)
		};
		const tolerance = parseFloat(env?.AUDIT_AMOUNT_TOL ?? '') || AMOUNT_TOLERANCE;
		recon = await reconcile(db, match.intent, settlement, tolerance);
	}

	return { settlement_id: settlementId, verified, recon };
}

// ---------------------------------------------------------------------------
// Intent Matching (internal)
// ---------------------------------------------------------------------------

/**
 * Find an open intent matching a transaction.
 *
 * Matching criteria:
 * 1. Intent payer matches transaction sender (`from`)
 * 2. Intent payee matches transaction recipient (`to`)
 * 3. Transaction timestamp within intent's time window (created_at to expires_at)
 *
 * Amount tolerance is NOT applied here — the reconcile() function determines
 * the verdict (settled/partial/mismatch) based on the actual amount delta.
 *
 * Returns the first matching open intent, or null if none found.
 *
 * @param db - D1 database binding
 * @param from - Transaction sender
 * @param to - Transaction recipient
 * @param amount - Transaction amount
 * @param ts - Transaction unix timestamp
 * @returns Matched intent or null
 */
async function matchIntent(
	db: DbClient,
	from: string,
	to: string,
	amount: number,
	ts: number
): Promise<IntentMatch | null> {
	// Query open intents for this payer that haven't expired
	const rows = await findOpenIntents(db, from, ts);

	for (const row of rows) {
		const intent = toIntentRow(row);

		// Payee must match
		if (intent.payee !== to) continue;

		// Transaction timestamp within window
		if (ts < intent.created_at || ts > intent.expires_at) continue;

		// Amount tolerance is evaluated in reconcile() to determine verdict
		// (settled / partial / mismatch). matchIntent uses payer+payee+window only,
		// consistent with the Python reference (_match_intent does `pass` not `continue`
		// on amount mismatch).
		return { intent };
	}

	return null;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

/**
 * Reconcile a matched intent with a settlement transaction.
 *
 * Verdict determination (aligned with Python reference `reconcile()` lines 179–200):
 * 1. If transaction is **not verified** → `mismatch` (settled_amt = 0, no wallet movement)
 * 2. If `|got − want| <= tolerance` → `settled` (settled_amt = want)
 * 3. If `got < want` → `partial` (settled_amt = got)
 * 4. If `got > want` → `mismatch` (settled_amt = 0, no wallet movement)
 *
 * Wallet operations only apply when `settled_amt > 0` (settled or partial).
 * Tolerance is an **absolute** NP amount (not a percentage), matching the Python reference.
 *
 * @param db - D1 database binding
 * @param intent - The matched intent row
 * @param settlement - The settlement row
 * @param tolerance - Absolute amount tolerance (default 0.0 = strict match)
 * @returns Reconciliation result with verdict, delta, latency, and balances
 */
async function reconcile(
	db: DbClient,
	intent: IntentRow,
	settlement: SettlementRow,
	tolerance: number = AMOUNT_TOLERANCE
): Promise<ReconResult> {
	const reconId = crypto.randomUUID();
	const want = intent.amount;
	const got = settlement.amount;
	const delta = got - want;
	const verified = settlement.verified === 1;

	// Determine verdict and settled amount (per Python reference lines 179–200)
	let verdict: ReconResult['verdict'];
	let settledAmt: number;

	if (!verified) {
		// Bug #1 fix: unverified transactions always get mismatch, no wallet movement
		verdict = 'mismatch';
		settledAmt = 0;
	} else if (Math.abs(delta) <= tolerance) {
		// Bug #4 fix: absolute tolerance (not percentage-based) per Python reference
		verdict = 'settled';
		settledAmt = want;
	} else if (got < want) {
		// Underpaid — partial
		verdict = 'partial';
		settledAmt = got;
	} else {
		// Overpaid — mismatch (no wallet movement per Python ref line 200–201)
		verdict = 'mismatch';
		settledAmt = 0;
	}

	// Latency: time from intent creation to settlement
	const latencyMs = (settlement.ts - intent.created_at) * 1000;

	// Bug #2 fix: only apply wallet operations when settled_amt > 0 (Python ref lines 203–207)
	if (settledAmt > 0) {
		await updateWalletBalances(db, intent.payer, intent.payee, settledAmt);
	}

	// Read current balances (always read, even if no wallet movement)
	const payerWallet = await getWalletBalance(db, intent.payer);
	const payeeWallet = await getWalletBalance(db, intent.payee);

	const balances = {
		payer_balance: payerWallet?.balanceMinor ?? 0,
		payee_balance: payeeWallet?.balanceMinor ?? 0
	};

	// Update intent status
	await updateIntentStatus(db, intent.intent_id, verdict);

	// Insert reconciliation record
	await insertReconciliation(db, {
		reconId,
		intentId: intent.intent_id,
		txHash: settlement.tx_hash,
		verdict,
		delta,
		latencyMs,
		balances: JSON.stringify(balances)
	});

	return {
		recon_id: reconId,
		intent_id: intent.intent_id,
		tx_hash: settlement.tx_hash,
		verdict,
		delta,
		latency_ms: latencyMs,
		balances
	};
}

// ---------------------------------------------------------------------------
// Audit Status
// ---------------------------------------------------------------------------

/**
 * Get the audit status for a declared intent.
 *
 * Returns the intent details and any associated reconciliation record.
 *
 * @param db - D1 database binding
 * @param intentId - The intent ID to look up
 * @returns Combined intent and reconciliation data
 * @throws Error if the intent is not found
 */
export async function getAuditStatus(db: DbClient, intentId: string): Promise<AuditStatus> {
	// Look up the intent
	const row = await getIntentById(db, intentId);

	if (!row) {
		throw new Error(`[getAuditStatus] intent not found: ${intentId}`);
	}

	const intent = toIntentRow(row);

	// Look up any reconciliation for this intent
	const recon = await getReconciliationByIntent(db, intentId);

	let reconciliation: ReconResult | null = null;
	if (recon) {
		reconciliation = {
			recon_id: recon.reconId,
			intent_id: recon.intentId ?? null,
			tx_hash: recon.txHash ?? null,
			verdict: recon.verdict as ReconResult['verdict'],
			delta: recon.delta ?? 0,
			latency_ms: recon.latencyMs ?? 0,
			balances: JSON.parse(recon.balances ?? '{}')
		};
	}

	return { intent, reconciliation };
}

// ---------------------------------------------------------------------------
// Intent Expiry Sweeper (P3-3 / P3-7)
// ---------------------------------------------------------------------------

/**
 * Sweep expired intents and create `no_show` reconciliation records.
 *
 * Called hourly by the cron-triggered `/api/cron/sweep-intents` endpoint.
 * Finds all intents with status = 'open' whose `expires_at` has passed,
 * sets their status to 'expired', and inserts a `no_show` reconciliation
 * record for each.
 *
 * Reference: langchain_points_auditor.py line 168 — `no_show` verdict
 *
 * @param db - D1 database binding
 * @returns Number of intents swept
 */
export async function sweepExpiredIntents(db: DbClient): Promise<{ swept: number }> {
	const now = Math.floor(Date.now() / 1000);

	const expired = await getExpiredOpenIntents(db, now);

	if (!expired || expired.length === 0) {
		return { swept: 0 };
	}

	for (const row of expired) {
		const reconId = crypto.randomUUID();
		const latencyMs = (now - (row.createdAt ?? 0)) * 1000;

		await sweepExpiredIntent(db, row.intentId, reconId, -row.amount, latencyMs);
	}

	return { swept: expired.length };
}
