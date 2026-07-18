/**
 * Revenue Sharing Tests — Phase 5 (Agent Bravo)
 *
 * Tests for revenue splits, share computation, settlement, and repository.
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { nanoid } from 'nanoid';

// Repository imports
import {
	createRevenueSplit,
	getRevenueSplit,
	getActiveSplitsForAgent,
	getActiveSplitsForDeveloper,
	deactivateSplit,
	createRevenueShare,
	getSharesForSplit,
	getPendingSharesForDeveloper,
	markSharesSettled,
	createSettlement,
	getSettlementsForDeveloper,
	completeSettlement
} from '../src/lib/db/repositories/revenue';

// Service imports
import {
	registerSplit,
	computeSharesForPeriod,
	getDeveloperEarnings,
	DEFAULT_SPLIT_PCT
} from '../src/lib/services/billing/revenue-share';
import { settleDeveloper, getSettlementHistory } from '../src/lib/services/billing/settlement';

// We also need billing repositories for period setup
import { createBillingPeriod, closeBillingPeriod } from '../src/lib/db/repositories/billing';

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

const BILLING_TABLES = [
	`CREATE TABLE IF NOT EXISTS billing_periods (
		id TEXT PRIMARY KEY, key_id TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'free',
		period_start INTEGER NOT NULL, period_end INTEGER NOT NULL,
		total_calls INTEGER NOT NULL DEFAULT 0, included_calls INTEGER NOT NULL DEFAULT 1000,
		overage_calls INTEGER NOT NULL DEFAULT 0, overage_charge_np INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'open',
		created_at INTEGER DEFAULT (unixepoch()), closed_at INTEGER)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_bp_key_period ON billing_periods(key_id, period_start)`
];

const REVENUE_TABLES = [
	`CREATE TABLE IF NOT EXISTS revenue_splits (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, developer_id TEXT NOT NULL,
		split_pct INTEGER NOT NULL DEFAULT 70, effective_from INTEGER NOT NULL,
		effective_to INTEGER, status TEXT NOT NULL DEFAULT 'active',
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rs_agent ON revenue_splits(agent_id)`,
	`CREATE INDEX IF NOT EXISTS idx_rs_developer ON revenue_splits(developer_id)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_rs_agent_dev ON revenue_splits(agent_id, developer_id, effective_from)`,
	`CREATE TABLE IF NOT EXISTS revenue_shares (
		id TEXT PRIMARY KEY, split_id TEXT NOT NULL REFERENCES revenue_splits(id),
		period_id TEXT NOT NULL, gross_revenue_np INTEGER NOT NULL DEFAULT 0,
		developer_share_np INTEGER NOT NULL DEFAULT 0, platform_share_np INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rsh_split ON revenue_shares(split_id)`,
	`CREATE INDEX IF NOT EXISTS idx_rsh_status ON revenue_shares(status)`,
	`CREATE TABLE IF NOT EXISTS revenue_settlements (
		id TEXT PRIMARY KEY, developer_id TEXT NOT NULL,
		total_np INTEGER NOT NULL DEFAULT 0, shares_count INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'pending', settled_at INTEGER,
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rse_developer ON revenue_settlements(developer_id)`,
	`CREATE INDEX IF NOT EXISTS idx_rse_status ON revenue_settlements(status)`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	const allSql = [...BILLING_TABLES, ...REVENUE_TABLES];
	await env.DB.batch(allSql.map((sql) => env.DB.prepare(sql)));
});

async function cleanAll() {
	await env.DB.prepare('DELETE FROM revenue_settlements').run();
	await env.DB.prepare('DELETE FROM revenue_shares').run();
	await env.DB.prepare('DELETE FROM revenue_splits').run();
	await env.DB.prepare('DELETE FROM billing_periods').run();
}

/** Helper: create a closed billing period with overage */
async function createClosedPeriod(keyId: string, overageNp: number) {
	const id = nanoid();
	const now = Math.floor(Date.now() / 1000);
	await createBillingPeriod(db, {
		id,
		keyId,
		tier: 'pro',
		periodStart: now - 86400,
		periodEnd: now - 1,
		totalCalls: 10_000 + overageNp,
		includedCalls: 10_000,
		overageCalls: overageNp,
		overageChargeNp: overageNp,
		status: 'open'
	});
	await closeBillingPeriod(db, id);
	return id;
}

// ---------- Revenue Splits (Repository) ----------

describe('Revenue Split Repository', () => {
	beforeEach(async () => {
		await cleanAll();
	});

	it('creates and retrieves a split', async () => {
		const id = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createRevenueSplit(db, {
			id,
			agentId: 'agent-1',
			developerId: 'dev-1',
			splitPct: 70,
			effectiveFrom: now,
			status: 'active'
		});
		const split = await getRevenueSplit(db, id);
		expect(split).not.toBeNull();
		expect(split!.splitPct).toBe(70);
	});

	it('getActiveSplitsForAgent returns active splits', async () => {
		const now = Math.floor(Date.now() / 1000);
		await createRevenueSplit(db, {
			id: nanoid(),
			agentId: 'agent-2',
			developerId: 'dev-2',
			splitPct: 80,
			effectiveFrom: now,
			status: 'active'
		});
		const splits = await getActiveSplitsForAgent(db, 'agent-2');
		expect(splits.length).toBe(1);
		expect(splits[0].splitPct).toBe(80);
	});

	it('deactivateSplit marks split inactive', async () => {
		const id = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createRevenueSplit(db, {
			id,
			agentId: 'agent-3',
			developerId: 'dev-3',
			splitPct: 70,
			effectiveFrom: now,
			status: 'active'
		});
		await deactivateSplit(db, id);
		const split = await getRevenueSplit(db, id);
		expect(split!.status).toBe('inactive');
	});
});

// ---------- Revenue Share Service ----------

describe('Revenue Share Service', () => {
	beforeEach(async () => {
		await cleanAll();
	});

	it('registerSplit creates an active split with default 70%', async () => {
		const splitId = await registerSplit(db, 'agent-10', 'dev-10');
		const split = await getRevenueSplit(db, splitId);
		expect(split).not.toBeNull();
		expect(split!.splitPct).toBe(DEFAULT_SPLIT_PCT);
		expect(split!.status).toBe('active');
	});

	it('registerSplit respects custom split percentage', async () => {
		const splitId = await registerSplit(db, 'agent-11', 'dev-11', 85);
		const split = await getRevenueSplit(db, splitId);
		expect(split!.splitPct).toBe(85);
	});

	it('computeSharesForPeriod returns zeros for non-existent period', async () => {
		const result = await computeSharesForPeriod(db, 'fake-period', 'agent-12');
		expect(result.shares).toBe(0);
	});

	it('computeSharesForPeriod computes 70/30 split from overage', async () => {
		const agentId = `agent-${nanoid(6)}`;
		const devId = `dev-${nanoid(6)}`;

		// Register split
		await registerSplit(db, agentId, devId, 70);

		// Create closed period with 1000 NP overage
		const periodId = await createClosedPeriod(`key-${nanoid(6)}`, 1000);

		const result = await computeSharesForPeriod(db, periodId, agentId);
		expect(result.shares).toBe(1);
		expect(result.totalDeveloperNp).toBe(700); // 70% of 1000
		expect(result.totalPlatformNp).toBe(300); // 30% of 1000
	});

	it('computeSharesForPeriod skips open periods', async () => {
		const agentId = `agent-${nanoid(6)}`;
		const devId = `dev-${nanoid(6)}`;
		await registerSplit(db, agentId, devId);

		const periodId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createBillingPeriod(db, {
			id: periodId,
			keyId: `key-${nanoid(6)}`,
			tier: 'pro',
			periodStart: now - 86400,
			periodEnd: now + 86400,
			totalCalls: 10_500,
			includedCalls: 10_000,
			overageCalls: 500,
			overageChargeNp: 500,
			status: 'open'
		});

		const result = await computeSharesForPeriod(db, periodId, agentId);
		expect(result.shares).toBe(0);
	});

	it('computeSharesForPeriod returns zeros when no overage', async () => {
		const agentId = `agent-${nanoid(6)}`;
		await registerSplit(db, agentId, `dev-${nanoid(6)}`);

		const periodId = await createClosedPeriod(`key-${nanoid(6)}`, 0);
		const result = await computeSharesForPeriod(db, periodId, agentId);
		expect(result.shares).toBe(0);
		expect(result.totalDeveloperNp).toBe(0);
	});

	it('getDeveloperEarnings shows pending shares', async () => {
		const agentId = `agent-${nanoid(6)}`;
		const devId = `dev-${nanoid(6)}`;
		await registerSplit(db, agentId, devId, 70);

		const periodId = await createClosedPeriod(`key-${nanoid(6)}`, 500);
		await computeSharesForPeriod(db, periodId, agentId);

		const earnings = await getDeveloperEarnings(db, devId);
		expect(earnings.pendingShares).toBe(1);
		expect(earnings.pendingTotalNp).toBe(350); // 70% of 500
		expect(earnings.shares.length).toBe(1);
	});
});

// ---------- Settlement ----------

describe('Settlement Service', () => {
	beforeEach(async () => {
		await cleanAll();
	});

	it('settleDeveloper creates settlement from pending shares', async () => {
		const agentId = `agent-${nanoid(6)}`;
		const devId = `dev-${nanoid(6)}`;
		await registerSplit(db, agentId, devId, 70);

		// Create two closed periods and compute shares
		const p1 = await createClosedPeriod(`key-${nanoid(6)}`, 1000);
		const p2 = await createClosedPeriod(`key-${nanoid(6)}`, 500);
		await computeSharesForPeriod(db, p1, agentId);
		await computeSharesForPeriod(db, p2, agentId);

		const result = await settleDeveloper(db, devId);
		expect(result).not.toBeNull();
		expect(result!.totalNp).toBe(1050); // 700 + 350
		expect(result!.sharesCount).toBe(2);
	});

	it('settleDeveloper returns null when no pending shares', async () => {
		const result = await settleDeveloper(db, 'dev-empty');
		expect(result).toBeNull();
	});

	it('getSettlementHistory returns history with totals', async () => {
		const agentId = `agent-${nanoid(6)}`;
		const devId = `dev-${nanoid(6)}`;
		await registerSplit(db, agentId, devId);

		const p1 = await createClosedPeriod(`key-${nanoid(6)}`, 200);
		await computeSharesForPeriod(db, p1, agentId);
		await settleDeveloper(db, devId);

		const history = await getSettlementHistory(db, devId);
		expect(history.count).toBe(1);
		expect(history.totalPendingNp).toBeGreaterThanOrEqual(0);
	});

	it('markSettlementComplete changes status', async () => {
		const settId = nanoid();
		await createSettlement(db, {
			id: settId,
			developerId: 'dev-x',
			totalNp: 100,
			sharesCount: 1,
			status: 'pending'
		});
		await completeSettlement(db, settId);

		const settlements = await getSettlementsForDeveloper(db, 'dev-x');
		expect(settlements[0].status).toBe('completed');
		expect(settlements[0].settledAt).not.toBeNull();
	});
});

// ---------- Revenue Repository (Shares) ----------

describe('Revenue Share Repository', () => {
	beforeEach(async () => {
		await cleanAll();
	});

	it('createRevenueShare links to split and period', async () => {
		const splitId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createRevenueSplit(db, {
			id: splitId,
			agentId: 'a',
			developerId: 'd',
			splitPct: 70,
			effectiveFrom: now,
			status: 'active'
		});
		const shareId = nanoid();
		await createRevenueShare(db, {
			id: shareId,
			splitId,
			periodId: 'test-period',
			grossRevenueNp: 100,
			developerShareNp: 70,
			platformShareNp: 30,
			status: 'pending'
		});
		const shares = await getSharesForSplit(db, splitId);
		expect(shares.length).toBe(1);
		expect(shares[0].developerShareNp).toBe(70);
	});

	it('markSharesSettled updates share status', async () => {
		const splitId = nanoid();
		const now = Math.floor(Date.now() / 1000);
		await createRevenueSplit(db, {
			id: splitId,
			agentId: 'b',
			developerId: 'e',
			splitPct: 70,
			effectiveFrom: now,
			status: 'active'
		});
		const shareId = nanoid();
		await createRevenueShare(db, {
			id: shareId,
			splitId,
			periodId: 'test-period-2',
			grossRevenueNp: 200,
			developerShareNp: 140,
			platformShareNp: 60,
			status: 'pending'
		});
		await markSharesSettled(db, [shareId], 'settlement-1');
		const shares = await getSharesForSplit(db, splitId);
		expect(shares[0].status).toBe('settled:settlement-1');
	});
});
