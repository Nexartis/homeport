/**
 * Multi-Currency Wallet Service
 *
 * Extends the existing audit_wallets ledger to support per-currency balances.
 * The original wallet system only tracked NP; this module adds currency-aware
 * credit/debit/balance operations using the `currency` column added in migration 0009.
 *
 * All amounts are in minor units (e.g. NP whole units with 0 decimals,
 * USDC in 10^-6 units, DAI in 10^-18 units).
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { auditWallets } from '$lib/db/schema';
import { validateCurrency } from './currencies';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get the balance for a specific agent + currency pair.
 * Returns 0 if no wallet row exists.
 */
export async function getWalletBalance(
	db: DbClient,
	agent: string,
	currency: string
): Promise<number> {
	if (!validateCurrency(currency)) {
		throw new Error(`[getWalletBalance] Unknown currency: ${currency}`);
	}

	const row = await db.query.auditWallets.findFirst({
		columns: { balanceMinor: true },
		where: and(eq(auditWallets.agentName, agent), eq(auditWallets.currency, currency))
	});

	return row?.balanceMinor ?? 0;
}

/**
 * Get all currency balances for an agent.
 * Returns a map of currency symbol → balance (only currencies with rows).
 */
export async function getMultiCurrencyBalances(
	db: DbClient,
	agent: string
): Promise<Record<string, number>> {
	const rows = await db
		.select({ currency: auditWallets.currency, balance: auditWallets.balanceMinor })
		.from(auditWallets)
		.where(eq(auditWallets.agentName, agent));

	const balances: Record<string, number> = {};
	for (const row of rows) {
		balances[row.currency ?? 'NP'] = row.balance ?? 0;
	}
	return balances;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Ensure a wallet row exists for agent + currency (idempotent).
 */
async function ensureWalletRow(db: DbClient, agent: string, currency: string): Promise<void> {
	await db
		.insert(auditWallets)
		.values({ agentName: agent, currency, balanceMinor: 0 })
		.onConflictDoNothing();
}

/**
 * Credit (increase) an agent's balance for a specific currency.
 * Creates the wallet row if it doesn't exist.
 */
export async function creditWallet(
	db: DbClient,
	agent: string,
	currency: string,
	amount: number
): Promise<void> {
	if (!validateCurrency(currency)) {
		throw new Error(`[creditWallet] Unknown currency: ${currency}`);
	}
	if (amount <= 0) {
		throw new Error(`[creditWallet] Amount must be positive, got ${amount}`);
	}

	await ensureWalletRow(db, agent, currency);

	await db
		.update(auditWallets)
		.set({
			balanceMinor: sql`balance_minor + ${amount}`,
			updatedAt: sql`(unixepoch())`
		})
		.where(and(eq(auditWallets.agentName, agent), eq(auditWallets.currency, currency)));
}

/**
 * Debit (decrease) an agent's balance for a specific currency.
 * Fails if the agent has insufficient balance.
 */
export async function debitWallet(
	db: DbClient,
	agent: string,
	currency: string,
	amount: number
): Promise<{ success: boolean; error?: string }> {
	if (!validateCurrency(currency)) {
		return { success: false, error: `Unknown currency: ${currency}` };
	}
	if (amount <= 0) {
		return { success: false, error: `Amount must be positive, got ${amount}` };
	}

	// Atomic conditional debit: only succeeds if balance is sufficient
	// This avoids the read-then-update race condition
	const result = await db
		.update(auditWallets)
		.set({
			balanceMinor: sql`balance_minor - ${amount}`,
			updatedAt: sql`(unixepoch())`
		})
		.where(
			and(
				eq(auditWallets.agentName, agent),
				eq(auditWallets.currency, currency),
				sql`balance_minor >= ${amount}`
			)
		)
		.returning({ balanceMinor: auditWallets.balanceMinor });

	if (result.length === 0) {
		// No row was updated — either wallet doesn't exist or insufficient balance
		const currentBalance = await getWalletBalance(db, agent, currency);
		return {
			success: false,
			error: `Insufficient ${currency} balance: have ${currentBalance}, need ${amount}`
		};
	}

	return { success: true };
}
