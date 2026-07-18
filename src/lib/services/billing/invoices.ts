/**
 * Invoice Service — generate, list, and finalize invoices
 *
 * Phase 5 — Agent Charlie (D7)
 */

import type { DbClient } from '$lib/db/client';
import type { Env } from '$lib/types';
import {
	generateInvoiceNumber,
	createInvoice as repoCreateInvoice,
	getInvoiceById,
	getInvoicesForKey,
	updateInvoiceStatus
} from '$lib/db/repositories/invoices';
import { getActiveSubscription, getSubscriptionById } from '$lib/db/repositories/subscriptions';
import { PLAN_CONFIGS, type SubscriptionPlan } from '$lib/types/subscriptions';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'invoices');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineItem {
	description: string;
	quantity: number;
	unitPriceNp: number;
	totalNp: number;
}

export interface GenerateInvoiceInput {
	keyId: string;
	periodId?: string;
	subscriptionId?: string;
	/** Override line items; if omitted, auto-generate from subscription */
	lineItems?: LineItem[];
	/** Extra call-based overage charges */
	overageCallCount?: number;
}

export interface InvoiceResult {
	id: string;
	invoiceNumber: string;
	status: string;
	totalNp: number;
	lineItems: LineItem[];
}

// ---------------------------------------------------------------------------
// Generate Invoice
// ---------------------------------------------------------------------------

/**
 * Generate a new invoice for a developer key.
 *
 * If lineItems are not provided, auto-generates from the active subscription.
 * Adds overage charges if overageCallCount is specified.
 */
export async function generateInvoice(
	db: DbClient,
	input: GenerateInvoiceInput,
	_env?: Env
): Promise<InvoiceResult> {
	const { keyId, periodId, subscriptionId, overageCallCount } = input;
	const lineItems: LineItem[] = input.lineItems ?? [];

	// Auto-generate subscription line item if none provided
	if (lineItems.length === 0) {
		const sub = subscriptionId
			? await getSubscriptionById(db, subscriptionId)
			: await getActiveSubscription(db, keyId);

		if (sub) {
			const plan = PLAN_CONFIGS[sub.plan as SubscriptionPlan];
			if (plan) {
				lineItems.push({
					description: `${plan.displayName} Plan — monthly subscription`,
					quantity: 1,
					unitPriceNp: plan.monthlyNp,
					totalNp: plan.monthlyNp
				});
			}
		}
	}

	// Add overage line item
	if (overageCallCount && overageCallCount > 0) {
		const sub = await getActiveSubscription(db, keyId);
		const plan = sub ? PLAN_CONFIGS[sub.plan as SubscriptionPlan] : null;
		const rate = plan?.overageRateNp ?? 1.0;
		// Round DOWN to match computeOverage() in metering.ts (Math.floor).
		// Ceil here would systematically over-invoice vs what was metered.
		const overageNp = Math.floor(overageCallCount * rate);
		lineItems.push({
			description: `API overage charges (${overageCallCount} calls)`,
			quantity: overageCallCount,
			unitPriceNp: rate,
			totalNp: overageNp
		});
	}

	// Compute totals
	const subtotalNp = lineItems.reduce((sum, item) => sum + item.totalNp, 0);
	const totalNp = subtotalNp; // No tax for now

	// Generate invoice number
	const year = new Date().getFullYear();
	const invoiceNumber = await generateInvoiceNumber(db, year);

	// Create invoice
	const id = crypto.randomUUID();
	await repoCreateInvoice(db, {
		id,
		invoiceNumber,
		periodId: periodId ?? null,
		keyId,
		subscriptionId: subscriptionId ?? null,
		lineItems: JSON.stringify(lineItems),
		subtotalNp,
		totalNp,
		currency: 'NP',
		status: 'draft'
	});

	log.info('generateInvoice', `Invoice ${invoiceNumber} generated for key ${keyId}`, {
		totalNp,
		itemCount: lineItems.length
	});

	return { id, invoiceNumber, status: 'draft', totalNp, lineItems };
}

// ---------------------------------------------------------------------------
// Finalize (Issue) Invoice
// ---------------------------------------------------------------------------

/** Mark an invoice as issued */
export async function issueInvoice(db: DbClient, invoiceId: string): Promise<void> {
	const inv = await getInvoiceById(db, invoiceId);
	if (!inv) {
		throw new Error(`Invoice not found: ${invoiceId}`);
	}
	if (inv.status !== 'draft') {
		throw new Error(`Invoice ${invoiceId} is already ${inv.status}`);
	}
	await updateInvoiceStatus(db, invoiceId, 'issued');
	log.info('issueInvoice', `Invoice ${inv.invoiceNumber} issued`);
}

// ---------------------------------------------------------------------------
// List / Lookup
// ---------------------------------------------------------------------------

/** List invoices for a key */
export async function listInvoicesForKey(db: DbClient, keyId: string) {
	return getInvoicesForKey(db, keyId);
}
