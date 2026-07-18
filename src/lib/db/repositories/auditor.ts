/**
 * Auditor Repository — typed data access for audit_intents, audit_settlements,
 * audit_reconciliations, and audit_wallets tables.
 */

import { eq, sql, and, lt } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	auditIntents,
	auditSettlements,
	auditReconciliations,
	auditWallets,
	type NewAuditIntent,
	type NewAuditSettlement
} from '../schema';

// ===================================================================
// Intents
// ===================================================================

/** Insert a new audit intent */
export async function insertIntent(db: DbClient, intent: NewAuditIntent) {
	return await db.insert(auditIntents).values(intent);
}

/** Get intent by ID */
export async function getIntentById(db: DbClient, intentId: string) {
	return (
		(await db.query.auditIntents.findFirst({
			where: eq(auditIntents.intentId, intentId)
		})) ?? null
	);
}

/** Find open intents for a payer that haven't expired */
export async function findOpenIntents(db: DbClient, payer: string, ts: number) {
	return await db
		.select()
		.from(auditIntents)
		.where(
			and(
				eq(auditIntents.payer, payer),
				eq(auditIntents.status, 'open'),
				sql`${auditIntents.expiresAt} > ${ts}`
			)
		)
		.orderBy(auditIntents.createdAt);
}

/** Update intent status */
export async function updateIntentStatus(db: DbClient, intentId: string, status: string) {
	return await db.update(auditIntents).set({ status }).where(eq(auditIntents.intentId, intentId));
}

/** Get expired open intents */
export async function getExpiredOpenIntents(db: DbClient, now: number) {
	return await db
		.select({
			intentId: auditIntents.intentId,
			payer: auditIntents.payer,
			payee: auditIntents.payee,
			amount: auditIntents.amount,
			createdAt: auditIntents.createdAt
		})
		.from(auditIntents)
		.where(and(eq(auditIntents.status, 'open'), lt(auditIntents.expiresAt, now)));
}

// ===================================================================
// Settlements
// ===================================================================

/** Insert a settlement record */
export async function insertSettlement(db: DbClient, settlement: NewAuditSettlement) {
	return await db.insert(auditSettlements).values(settlement);
}

// ===================================================================
// Wallets
// ===================================================================

/** Ensure NP wallet rows exist for agents (idempotent INSERT OR IGNORE) */
export async function ensureWallets(db: DbClient, agentNames: string[]) {
	// Use batch for atomic multi-row insert
	if (agentNames.length === 0) return;
	const statements = agentNames.map((name) =>
		db.insert(auditWallets).values({ agentName: name, currency: 'NP' }).onConflictDoNothing()
	);
	await db.batch(statements as [(typeof statements)[0], ...typeof statements]);
}

/** Update NP wallet balances atomically (debit payer, credit payee) */
export async function updateWalletBalances(
	db: DbClient,
	payer: string,
	payee: string,
	amount: number
) {
	await db.batch([
		db
			.update(auditWallets)
			.set({ balanceMinor: sql`balance_minor - ${amount}`, updatedAt: sql`(unixepoch())` })
			.where(and(eq(auditWallets.agentName, payer), eq(auditWallets.currency, 'NP'))),
		db
			.update(auditWallets)
			.set({ balanceMinor: sql`balance_minor + ${amount}`, updatedAt: sql`(unixepoch())` })
			.where(and(eq(auditWallets.agentName, payee), eq(auditWallets.currency, 'NP')))
	]);
}

/** Get NP wallet balance for an agent */
export async function getWalletBalance(db: DbClient, agentName: string) {
	return (
		(await db.query.auditWallets.findFirst({
			columns: { balanceMinor: true },
			where: and(eq(auditWallets.agentName, agentName), eq(auditWallets.currency, 'NP'))
		})) ?? null
	);
}

// ===================================================================
// Reconciliations
// ===================================================================

/** Insert a reconciliation record */
export async function insertReconciliation(
	db: DbClient,
	recon: {
		reconId: string;
		intentId: string;
		txHash: string | null;
		verdict: string;
		delta: number;
		latencyMs: number;
		balances: string;
	}
) {
	return await db.insert(auditReconciliations).values(recon);
}

/** Get latest reconciliation for an intent */
export async function getReconciliationByIntent(db: DbClient, intentId: string) {
	return (
		(await db.query.auditReconciliations.findFirst({
			where: eq(auditReconciliations.intentId, intentId),
			orderBy: [sql`created_at DESC`]
		})) ?? null
	);
}

/** Sweep an expired intent: update status + insert no_show recon (batch) */
export async function sweepExpiredIntent(
	db: DbClient,
	intentId: string,
	reconId: string,
	delta: number,
	latencyMs: number
) {
	await db.batch([
		db.update(auditIntents).set({ status: 'expired' }).where(eq(auditIntents.intentId, intentId)),
		db.insert(auditReconciliations).values({
			reconId,
			intentId,
			txHash: null,
			verdict: 'no_show',
			delta,
			latencyMs,
			balances: '{}'
		})
	]);
}
