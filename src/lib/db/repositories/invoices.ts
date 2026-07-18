/**
 * Invoice Repository — typed data access for invoices + sequence tables.
 *
 * Phase 5 — Agent Charlie (D7)
 */

import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { invoices, invoiceSequence, type NewInvoiceRecord } from '../schema';

// ===================================================================
// Invoice Numbering
// ===================================================================

/**
 * Generate the next invoice number for a given year.
 * Format: INV-YYYY-NNNNN (e.g., INV-2026-00001)
 * Uses atomic upsert on the invoice_sequence table.
 */
export async function generateInvoiceNumber(db: DbClient, year: number): Promise<string> {
	// Atomic upsert + return using RETURNING clause (no race condition)
	const result = await db
		.insert(invoiceSequence)
		.values({ year, nextNumber: 1 })
		.onConflictDoUpdate({
			target: invoiceSequence.year,
			set: { nextNumber: sql`next_number + 1` }
		})
		.returning({ nextNumber: invoiceSequence.nextNumber });

	const num = result[0]?.nextNumber ?? 1;
	const padded = String(num).padStart(5, '0');
	return `INV-${year}-${padded}`;
}

// ===================================================================
// CRUD
// ===================================================================

/** Create a new invoice */
export async function createInvoice(db: DbClient, data: NewInvoiceRecord) {
	await db.insert(invoices).values(data);
	return await db.query.invoices.findFirst({
		where: eq(invoices.id, data.id!)
	});
}

/** Get invoice by ID */
export async function getInvoiceById(db: DbClient, id: string) {
	return (
		(await db.query.invoices.findFirst({
			where: eq(invoices.id, id)
		})) ?? null
	);
}

/** Get invoice by invoice number */
export async function getInvoiceByNumber(db: DbClient, invoiceNumber: string) {
	return (
		(await db.query.invoices.findFirst({
			where: eq(invoices.invoiceNumber, invoiceNumber)
		})) ?? null
	);
}

/** Get all invoices for a key (sorted newest-first) */
export async function getInvoicesForKey(db: DbClient, keyId: string) {
	return await db
		.select()
		.from(invoices)
		.where(eq(invoices.keyId, keyId))
		.orderBy(sql`created_at DESC`);
}

/** Get invoices for a billing period */
export async function getInvoicesForPeriod(db: DbClient, periodId: string) {
	return await db
		.select()
		.from(invoices)
		.where(eq(invoices.periodId, periodId))
		.orderBy(sql`created_at DESC`);
}

/** Update invoice status (e.g., draft → issued → paid) */
export async function updateInvoiceStatus(db: DbClient, id: string, status: string) {
	const updates: Record<string, unknown> = { status };
	if (status === 'issued') {
		updates.issuedAt = Math.floor(Date.now() / 1000);
	}
	return await db.update(invoices).set(updates).where(eq(invoices.id, id));
}
