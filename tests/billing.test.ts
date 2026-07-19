/**
 * Usage-Based Billing Tests — Phase 5 (Agent Bravo)
 *
 * Tests for tier configs, metering, billing service, and billing repository.
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { TIER_CONFIGS, type BillingTier } from '../src/lib/types/billing';
import {
	computeOverage,
	ensureOpenPeriod,
	recordApiCall,
	getUsageSummary
} from '../src/lib/services/billing/metering';
import {
	closePeriod,
	closeExpiredPeriods,
	generateLineItems
} from '../src/lib/services/billing/service';
import {
	createBillingPeriod,
	getBillingPeriod,
	getOpenPeriodForKey,
	incrementUsage,
	addLineItem,
	getLineItems,
	listPeriods,
	closeBillingPeriod
} from '../src/lib/db/repositories/billing';
import { nanoid } from 'nanoid';

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

/** D1 table creation for billing tables */
const BILLING_TABLES = [
	`CREATE TABLE IF NOT EXISTS billing_periods (
		id TEXT PRIMARY KEY, key_id TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'free',
		period_start INTEGER NOT NULL, period_end INTEGER NOT NULL,
		total_calls INTEGER NOT NULL DEFAULT 0, included_calls INTEGER NOT NULL DEFAULT 1000,
		overage_calls INTEGER NOT NULL DEFAULT 0, overage_charge_np INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'open',
		created_at INTEGER DEFAULT (unixepoch()), closed_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_bp_key ON billing_periods(key_id)`,
	`CREATE INDEX IF NOT EXISTS idx_bp_status ON billing_periods(status)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_bp_key_period ON billing_periods(key_id, period_start)`,
	`CREATE TABLE IF NOT EXISTS billing_line_items (
		id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES billing_periods(id),
		description TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
		unit_price_np INTEGER NOT NULL DEFAULT 0, total_np INTEGER NOT NULL DEFAULT 0,
		category TEXT NOT NULL DEFAULT 'overage',
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_bli_period ON billing_line_items(period_id)`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(BILLING_TABLES.map((sql) => env.DB.prepare(sql)));
});

// Clean tables between test groups
async function cleanBillingTables() {
	await env.DB.prepare('DELETE FROM billing_line_items').run();
	await env.DB.prepare('DELETE FROM billing_periods').run();
}

// ---------- Tier Configs ----------

describe('Tier Configs', () => {
	it('TIER_CONFIGS has all three tiers', () => {
		expect(TIER_CONFIGS).toHaveProperty('free');
		expect(TIER_CONFIGS).toHaveProperty('pro');
		expect(TIER_CONFIGS).toHaveProperty('enterprise');
	});

	it('free tier has 1000 included calls and no overage', () => {
		const free = TIER_CONFIGS.free;
		expect(free.includedCalls).toBe(1_000);
		expect(free.overageRateNp).toBe(0);
		expect(free.overageRateUsd).toBe(0);
	});

	it('pro tier has 10000 included calls at 1 NP overage', () => {
		const pro = TIER_CONFIGS.pro;
		expect(pro.includedCalls).toBe(10_000);
		expect(pro.overageRateNp).toBe(1);
		expect(pro.overageRateUsd).toBe(0.001);
	});

	it('enterprise tier has 100000 included calls at 0.5 NP overage', () => {
		const ent = TIER_CONFIGS.enterprise;
		expect(ent.includedCalls).toBe(100_000);
		expect(ent.overageRateNp).toBe(0.5);
		expect(ent.overageRateUsd).toBe(0.0005);
	});
});

// ---------- Metering ----------

describe('Metering', () => {
	beforeEach(async () => {
		await cleanBillingTables();
	});

	it('recordApiCall creates billing period if none exists', async () => {
		const keyId = `key-${nanoid(8)}`;
		const result = await recordApiCall(db, keyId, 'pro');
		expect(result.allowed).toBe(true);
		expect(result.totalCalls).toBe(1);

		const period = await getOpenPeriodForKey(db, keyId);
		expect(period).not.toBeNull();
		expect(period!.totalCalls).toBe(1);
	});

	it('recordApiCall increments total_calls', async () => {
		const keyId = `key-${nanoid(8)}`;
		await recordApiCall(db, keyId, 'pro');
		await recordApiCall(db, keyId, 'pro');
		await recordApiCall(db, keyId, 'pro');

		const period = await getOpenPeriodForKey(db, keyId);
		expect(period!.totalCalls).toBe(3);
	});

	it('recordApiCall returns overage=false when within included', async () => {
		const keyId = `key-${nanoid(8)}`;
		const result = await recordApiCall(db, keyId, 'pro');
		expect(result.overage).toBe(false);
		expect(result.chargeNp).toBe(0);
	});

	it('recordApiCall returns overage=true when beyond included', async () => {
		const keyId = `key-${nanoid(8)}`;
		// Create a period already at the limit
		const now = Math.floor(Date.now() / 1000);
		const periodId = nanoid();
		await createBillingPeriod(db, {
			id: periodId,
			keyId,
			tier: 'pro',
			periodStart: now - 1000,
			periodEnd: now + 86400,
			totalCalls: 10_000,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const result = await recordApiCall(db, keyId, 'pro');
		expect(result.allowed).toBe(true);
		expect(result.overage).toBe(true);
	});

	it('recordApiCall computes correct NP charge for overage', async () => {
		const keyId = `key-${nanoid(8)}`;
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id: nanoid(),
			keyId,
			tier: 'pro',
			periodStart: now - 1000,
			periodEnd: now + 86400,
			totalCalls: 10_005,
			includedCalls: 10_000,
			overageCalls: 5,
			overageChargeNp: 5,
			status: 'open'
		});

		const result = await recordApiCall(db, keyId, 'pro');
		expect(result.allowed).toBe(true);
		expect(result.overage).toBe(true);
		expect(result.chargeNp).toBe(1); // 1 NP per overage call for pro
	});

	it('free tier blocks at limit instead of accruing', async () => {
		const keyId = `key-${nanoid(8)}`;
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id: nanoid(),
			keyId,
			tier: 'free',
			periodStart: now - 1000,
			periodEnd: now + 86400,
			totalCalls: 1_000,
			includedCalls: 1_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const result = await recordApiCall(db, keyId, 'free');
		expect(result.allowed).toBe(false);
		expect(result.overage).toBe(false);
	});

	it('ensureOpenPeriod returns existing open period', async () => {
		const keyId = `key-${nanoid(8)}`;
		const period1 = await ensureOpenPeriod(db, keyId, 'pro');
		const period2 = await ensureOpenPeriod(db, keyId, 'pro');
		expect(period1.id).toBe(period2.id);
	});

	it('ensureOpenPeriod creates new period when none open', async () => {
		const keyId = `key-${nanoid(8)}`;
		const period = await ensureOpenPeriod(db, keyId, 'enterprise');
		expect(period).not.toBeNull();
		expect(period.keyId).toBe(keyId);
		expect(period.tier).toBe('enterprise');
		expect(period.status).toBe('open');
		expect(period.includedCalls).toBe(100_000);
	});

	it('computeOverage returns zero for within-limit usage', () => {
		const result = computeOverage(500, 1_000, 1);
		expect(result.overageCalls).toBe(0);
		expect(result.chargeNp).toBe(0);
	});

	it('computeOverage computes correct charge', () => {
		const result = computeOverage(10_005, 10_000, 1);
		expect(result.overageCalls).toBe(5);
		expect(result.chargeNp).toBe(5);
	});

	it('getUsageSummary returns null when no period exists', async () => {
		const result = await getUsageSummary(db, 'nonexistent-key');
		expect(result).toBeNull();
	});
});

// ---------- Billing Service ----------

describe('Billing Service', () => {
	beforeEach(async () => {
		await cleanBillingTables();
	});

	it('closePeriod generates line items and marks closed', async () => {
		const keyId = `key-${nanoid(8)}`;
		const now = Math.floor(Date.now() / 1000);
		const periodId = nanoid();
		await createBillingPeriod(db, {
			id: periodId,
			keyId,
			tier: 'pro',
			periodStart: now - 86400,
			periodEnd: now - 1,
			totalCalls: 10_500,
			includedCalls: 10_000,
			overageCalls: 500,
			overageChargeNp: 500,
			status: 'open'
		});

		const result = await closePeriod(db, periodId);
		expect(result.closed).toBe(true);

		const period = await getBillingPeriod(db, periodId);
		expect(period!.status).toBe('closed');

		const items = await getLineItems(db, periodId);
		expect(items.length).toBeGreaterThan(0);
		expect(items[0].category).toBe('overage');
	});

	it('closePeriod does nothing for already-closed period', async () => {
		const periodId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id: periodId,
			keyId: `key-${nanoid(8)}`,
			tier: 'pro',
			periodStart: now - 86400,
			periodEnd: now - 1,
			totalCalls: 100,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});
		await closeBillingPeriod(db, periodId);

		const result = await closePeriod(db, periodId);
		expect(result.closed).toBe(false);
	});

	it('generateLineItems creates overage line item', async () => {
		const periodId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		const period = {
			id: periodId,
			keyId: `key-${nanoid(8)}`,
			tier: 'pro' as const,
			periodStart: now - 86400,
			periodEnd: now,
			totalCalls: 10_100,
			includedCalls: 10_000,
			overageCalls: 100,
			overageChargeNp: 100,
			status: 'open' as const,
			createdAt: now - 86400,
			closedAt: null
		};
		await createBillingPeriod(db, period);
		await generateLineItems(db, period);

		const items = await getLineItems(db, periodId);
		expect(items.length).toBe(1);
		expect(items[0].category).toBe('overage');
		expect(items[0].quantity).toBe(100);
		expect(items[0].totalNp).toBe(100);
	});

	it('generateLineItems creates zero-cost line for within-limit', async () => {
		const periodId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		const period = {
			id: periodId,
			keyId: `key-${nanoid(8)}`,
			tier: 'pro' as const,
			periodStart: now - 86400,
			periodEnd: now,
			totalCalls: 500,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open' as const,
			createdAt: now - 86400,
			closedAt: null
		};
		await createBillingPeriod(db, period);
		await generateLineItems(db, period);

		const items = await getLineItems(db, periodId);
		expect(items.length).toBe(1);
		expect(items[0].category).toBe('base');
		expect(items[0].totalNp).toBe(0);
	});

	it('closeExpiredPeriods sweeps past-due open periods', async () => {
		const now = Math.floor(Date.now() / 1000);
		// Create two expired periods
		await createBillingPeriod(db, {
			id: nanoid(),
			keyId: `key-${nanoid(8)}`,
			tier: 'pro',
			periodStart: now - 172800,
			periodEnd: now - 86400,
			totalCalls: 50,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});
		await createBillingPeriod(db, {
			id: nanoid(),
			keyId: `key-${nanoid(8)}`,
			tier: 'enterprise',
			periodStart: now - 172800,
			periodEnd: now - 86400,
			totalCalls: 200,
			includedCalls: 100_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const result = await closeExpiredPeriods(db);
		expect(result.closed).toBe(2);
	});
});

// ---------- Billing Repository ----------

describe('Billing Repository', () => {
	beforeEach(async () => {
		await cleanBillingTables();
	});

	it('createBillingPeriod inserts correctly', async () => {
		const id = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id,
			keyId: 'test-key',
			tier: 'pro',
			periodStart: now,
			periodEnd: now + 86400,
			totalCalls: 0,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const period = await getBillingPeriod(db, id);
		expect(period).not.toBeNull();
		expect(period!.keyId).toBe('test-key');
		expect(period!.tier).toBe('pro');
	});

	it('getOpenPeriodForKey returns open period', async () => {
		const keyId = `key-${nanoid(8)}`;
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id: nanoid(),
			keyId,
			tier: 'free',
			periodStart: now,
			periodEnd: now + 86400,
			totalCalls: 0,
			includedCalls: 1_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const period = await getOpenPeriodForKey(db, keyId);
		expect(period).not.toBeNull();
		expect(period!.keyId).toBe(keyId);
		expect(period!.status).toBe('open');
	});

	it('getOpenPeriodForKey returns null when no open period', async () => {
		const period = await getOpenPeriodForKey(db, 'no-such-key');
		expect(period).toBeNull();
	});

	it('incrementUsage updates total_calls', async () => {
		const id = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id,
			keyId: 'test-key',
			tier: 'pro',
			periodStart: now,
			periodEnd: now + 86400,
			totalCalls: 5,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		await incrementUsage(db, id, 3);
		const period = await getBillingPeriod(db, id);
		expect(period!.totalCalls).toBe(8);
	});

	it('addLineItem inserts line item linked to period', async () => {
		const periodId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id: periodId,
			keyId: 'test-key',
			tier: 'pro',
			periodStart: now,
			periodEnd: now + 86400,
			totalCalls: 0,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const itemId = nanoid();
		await addLineItem(db, {
			id: itemId,
			periodId,
			description: 'Test overage',
			quantity: 10,
			unitPriceNp: 1,
			totalNp: 10,
			category: 'overage'
		});

		const items = await getLineItems(db, periodId);
		expect(items.length).toBe(1);
		expect(items[0].id).toBe(itemId);
		expect(items[0].totalNp).toBe(10);
	});

	it('listPeriods returns periods ordered by period_start desc', async () => {
		const keyId = `key-${nanoid(8)}`;
		const now = Math.floor(Date.now() / 1000);

		await createBillingPeriod(db, {
			id: nanoid(),
			keyId,
			tier: 'pro',
			periodStart: now - 200000,
			periodEnd: now - 100000,
			totalCalls: 100,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'closed'
		});
		await createBillingPeriod(db, {
			id: nanoid(),
			keyId,
			tier: 'pro',
			periodStart: now - 100000,
			periodEnd: now,
			totalCalls: 200,
			includedCalls: 10_000,
			overageCalls: 0,
			overageChargeNp: 0,
			status: 'open'
		});

		const periods = await listPeriods(db, keyId);
		expect(periods.length).toBe(2);
		expect(periods[0].periodStart).toBeGreaterThan(periods[1].periodStart);
	});
});
