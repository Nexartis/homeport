/**
 * Invoice Tests — generation, numbering, finalization, and repository operations.
 *
 * Phase 5 — Agent Charlie (D7)
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
	generateInvoice,
	issueInvoice,
	listInvoicesForKey
} from '../src/lib/services/billing/invoices';
import {
	generateInvoiceNumber,
	createInvoice as repoCreateInvoice,
	getInvoiceById,
	getInvoiceByNumber,
	getInvoicesForKey,
	updateInvoiceStatus
} from '../src/lib/db/repositories/invoices';
import { subscribe } from '../src/lib/services/billing/subscriptions';
import { createDbClient } from '../src/lib/db/client';

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

const SETUP_SQL = [
	`CREATE TABLE IF NOT EXISTS invoices (
		id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE,
		period_id TEXT, key_id TEXT NOT NULL, subscription_id TEXT,
		line_items TEXT NOT NULL, subtotal_np INTEGER NOT NULL DEFAULT 0,
		total_np INTEGER NOT NULL DEFAULT 0, total_usd_equivalent REAL,
		currency TEXT NOT NULL DEFAULT 'NP', status TEXT NOT NULL DEFAULT 'draft',
		issued_at INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_inv_key ON invoices(key_id)`,
	`CREATE TABLE IF NOT EXISTS invoice_sequence (
		year INTEGER PRIMARY KEY, next_number INTEGER NOT NULL DEFAULT 1)`,
	`CREATE TABLE IF NOT EXISTS subscriptions (
		id TEXT PRIMARY KEY, key_id TEXT NOT NULL, owner_id TEXT,
		plan TEXT NOT NULL DEFAULT 'starter', status TEXT NOT NULL DEFAULT 'active',
		period_start INTEGER NOT NULL, period_end INTEGER NOT NULL,
		auto_renew INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER DEFAULT (unixepoch()), cancelled_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_sub_key ON subscriptions(key_id)`,
	`CREATE TABLE IF NOT EXISTS subscription_events (
		id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
		event_type TEXT NOT NULL, from_plan TEXT, to_plan TEXT,
		metadata TEXT, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_wallets (
		agent_name TEXT PRIMARY KEY, balance_minor INTEGER DEFAULT 0,
		currency TEXT DEFAULT 'NP', scale INTEGER DEFAULT 0,
		updated_at INTEGER DEFAULT (unixepoch()))`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(SETUP_SQL.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM invoices'),
		env.DB.prepare('DELETE FROM invoice_sequence'),
		env.DB.prepare('DELETE FROM subscription_events'),
		env.DB.prepare('DELETE FROM subscriptions'),
		env.DB.prepare('DELETE FROM audit_wallets')
	]);
});

// ========== Invoice Numbering ==========

describe('Invoice Numbering', () => {
	it('generates INV-YYYY-NNNNN format', async () => {
		const num = await generateInvoiceNumber(db, 2026);
		expect(num).toMatch(/^INV-2026-\d{5}$/);
	});

	it('increments sequence on subsequent calls', async () => {
		const num1 = await generateInvoiceNumber(db, 2026);
		const num2 = await generateInvoiceNumber(db, 2026);
		expect(num1).not.toBe(num2);
		expect(num1).toBe('INV-2026-00001');
		expect(num2).toBe('INV-2026-00002');
	});

	it('separate years have independent sequences', async () => {
		const a = await generateInvoiceNumber(db, 2026);
		const b = await generateInvoiceNumber(db, 2027);
		expect(a).toBe('INV-2026-00001');
		expect(b).toBe('INV-2027-00001');
	});
});

// ========== Invoice Generation ==========

describe('Invoice Generation', () => {
	async function seedWallet(name: string, balance: number) {
		await env.DB.prepare(
			'INSERT OR REPLACE INTO audit_wallets (agent_name, balance_minor) VALUES (?, ?)'
		)
			.bind(name, balance)
			.run();
	}

	it('generates invoice with manual line items', async () => {
		const result = await generateInvoice(db, {
			keyId: 'key-inv-1',
			lineItems: [{ description: 'Test item', quantity: 1, unitPriceNp: 100, totalNp: 100 }]
		});
		expect(result.status).toBe('draft');
		expect(result.totalNp).toBe(100);
		expect(result.invoiceNumber).toMatch(/^INV-/);
	});

	it('auto-generates line items from active subscription', async () => {
		await seedWallet('key-inv-2', 5000);
		await subscribe(db, 'key-inv-2', 'starter');
		const result = await generateInvoice(db, { keyId: 'key-inv-2' });
		expect(result.totalNp).toBe(500); // starter plan cost
		expect(result.lineItems.length).toBeGreaterThanOrEqual(1);
	});

	it('adds overage line item when overageCallCount provided', async () => {
		await seedWallet('key-inv-3', 5000);
		await subscribe(db, 'key-inv-3', 'starter');
		const result = await generateInvoice(db, {
			keyId: 'key-inv-3',
			overageCallCount: 50
		});
		// 500 (subscription) + 50 * 1.0 (overage) = 550
		expect(result.totalNp).toBe(550);
		expect(result.lineItems.length).toBe(2);
	});
});

// ========== Invoice Finalization ==========

describe('Invoice Finalization', () => {
	it('issueInvoice changes status from draft to issued', async () => {
		const inv = await generateInvoice(db, {
			keyId: 'key-fin-1',
			lineItems: [{ description: 'Test', quantity: 1, unitPriceNp: 200, totalNp: 200 }]
		});
		await issueInvoice(db, inv.id);
		const updated = await getInvoiceById(db, inv.id);
		expect(updated?.status).toBe('issued');
		expect(updated?.issuedAt).toBeGreaterThan(0);
	});

	it('issueInvoice rejects already-issued invoice', async () => {
		const inv = await generateInvoice(db, {
			keyId: 'key-fin-2',
			lineItems: [{ description: 'Test', quantity: 1, unitPriceNp: 100, totalNp: 100 }]
		});
		await issueInvoice(db, inv.id);
		await expect(issueInvoice(db, inv.id)).rejects.toThrow('already');
	});

	it('issueInvoice rejects non-existent invoice', async () => {
		await expect(issueInvoice(db, 'nonexistent-id')).rejects.toThrow('not found');
	});
});

// ========== Repository ==========

describe('Invoice Repository', () => {
	it('createInvoice inserts correctly', async () => {
		const id = crypto.randomUUID();
		const result = await repoCreateInvoice(db, {
			id,
			invoiceNumber: 'INV-TEST-00001',
			keyId: 'key-repo-1',
			lineItems: '[]',
			subtotalNp: 0,
			totalNp: 0,
			currency: 'NP',
			status: 'draft'
		});
		expect(result?.id).toBe(id);
	});

	it('getInvoiceByNumber finds by invoice number', async () => {
		await repoCreateInvoice(db, {
			id: crypto.randomUUID(),
			invoiceNumber: 'INV-TEST-99999',
			keyId: 'key-repo-2',
			lineItems: '[]',
			subtotalNp: 0,
			totalNp: 0,
			currency: 'NP',
			status: 'draft'
		});
		const found = await getInvoiceByNumber(db, 'INV-TEST-99999');
		expect(found).not.toBeNull();
		expect(found?.keyId).toBe('key-repo-2');
	});

	it('getInvoicesForKey returns invoices for a key', async () => {
		await repoCreateInvoice(db, {
			id: crypto.randomUUID(),
			invoiceNumber: 'INV-TEST-00010',
			keyId: 'key-repo-3',
			lineItems: '[]',
			subtotalNp: 100,
			totalNp: 100,
			currency: 'NP',
			status: 'draft'
		});
		await repoCreateInvoice(db, {
			id: crypto.randomUUID(),
			invoiceNumber: 'INV-TEST-00011',
			keyId: 'key-repo-3',
			lineItems: '[]',
			subtotalNp: 200,
			totalNp: 200,
			currency: 'NP',
			status: 'draft'
		});
		const list = await getInvoicesForKey(db, 'key-repo-3');
		expect(list.length).toBe(2);
	});

	it('updateInvoiceStatus changes status', async () => {
		const id = crypto.randomUUID();
		await repoCreateInvoice(db, {
			id,
			invoiceNumber: 'INV-TEST-00020',
			keyId: 'key-repo-4',
			lineItems: '[]',
			subtotalNp: 0,
			totalNp: 0,
			currency: 'NP',
			status: 'draft'
		});
		await updateInvoiceStatus(db, id, 'void');
		const updated = await getInvoiceById(db, id);
		expect(updated?.status).toBe('void');
	});
});
