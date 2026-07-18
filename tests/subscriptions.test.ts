/**
 * Subscription Model Tests — plan configs, lifecycle (create/cancel/change),
 * auto-renewal, and repository operations.
 *
 * Phase 5 — Agent Charlie (D6)
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { PLAN_CONFIGS } from '../src/lib/types/subscriptions';
import type { SubscriptionPlan } from '../src/lib/types/subscriptions';
import {
	subscribe,
	cancelSubscription,
	changePlan,
	getSubscriptionStatus
} from '../src/lib/services/billing/subscriptions';
import { processAutoRenewals } from '../src/lib/services/billing/auto-renew';
import {
	createSubscription as repoCreateSub,
	getActiveSubscription,
	getExpiringSubscriptions,
	getSubscriptionById,
	logSubscriptionEvent,
	getSubscriptionEvents
} from '../src/lib/db/repositories/subscriptions';
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

/** D1 table creation statements for subscription + wallet tables */
const SETUP_SQL = [
	`CREATE TABLE IF NOT EXISTS subscriptions (
		id TEXT PRIMARY KEY, key_id TEXT NOT NULL, owner_id TEXT,
		plan TEXT NOT NULL DEFAULT 'starter', status TEXT NOT NULL DEFAULT 'active',
		period_start INTEGER NOT NULL, period_end INTEGER NOT NULL,
		auto_renew INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER DEFAULT (unixepoch()), cancelled_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_sub_key ON subscriptions(key_id)`,
	`CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status)`,
	`CREATE TABLE IF NOT EXISTS subscription_events (
		id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
		event_type TEXT NOT NULL, from_plan TEXT, to_plan TEXT,
		metadata TEXT, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_se_sub ON subscription_events(subscription_id)`,
	`CREATE TABLE IF NOT EXISTS audit_wallets (
		agent_name TEXT PRIMARY KEY, balance_minor INTEGER DEFAULT 0,
		currency TEXT DEFAULT 'NP', scale INTEGER DEFAULT 0,
		updated_at INTEGER DEFAULT (unixepoch()))`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(SETUP_SQL.map((sql) => env.DB.prepare(sql)));
});

// Clean tables between tests
beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare('DELETE FROM subscription_events'),
		env.DB.prepare('DELETE FROM subscriptions'),
		env.DB.prepare('DELETE FROM audit_wallets')
	]);
});

// ========== Plan Configs ==========

describe('Plan Configs', () => {
	it('PLAN_CONFIGS has all three plans', () => {
		expect(Object.keys(PLAN_CONFIGS)).toEqual(['starter', 'pro', 'enterprise']);
	});

	it('starter plan has 500 NP monthly cost', () => {
		expect(PLAN_CONFIGS.starter.monthlyNp).toBe(500);
		expect(PLAN_CONFIGS.starter.includedCalls).toBe(1000);
	});

	it('pro plan has 4000 NP monthly cost', () => {
		expect(PLAN_CONFIGS.pro.monthlyNp).toBe(4000);
		expect(PLAN_CONFIGS.pro.includedCalls).toBe(10000);
	});

	it('enterprise plan has 30000 NP monthly cost', () => {
		expect(PLAN_CONFIGS.enterprise.monthlyNp).toBe(30000);
		expect(PLAN_CONFIGS.enterprise.includedCalls).toBe(100000);
	});
});

// ========== Subscription Lifecycle ==========

describe('Subscription Lifecycle', () => {
	async function seedWallet(name: string, balance: number) {
		await env.DB.prepare(
			'INSERT OR REPLACE INTO audit_wallets (agent_name, balance_minor) VALUES (?, ?)'
		)
			.bind(name, balance)
			.run();
	}

	it('subscribe creates active subscription', async () => {
		await seedWallet('key-1', 1000);
		const result = await subscribe(db, 'key-1', 'starter');
		expect(result.subscription.status).toBe('active');
		expect(result.subscription.plan).toBe('starter');
		expect(result.subscription.autoRenew).toBe(true);
	});

	it('subscribe debits NP wallet for monthly cost', async () => {
		await seedWallet('key-2', 5000);
		const result = await subscribe(db, 'key-2', 'starter');
		expect(result.charged).toBe(500);
	});

	it('subscribe rejects if active subscription exists', async () => {
		await seedWallet('key-3', 10000);
		await subscribe(db, 'key-3', 'starter');
		await expect(subscribe(db, 'key-3', 'pro')).rejects.toThrow('already exists');
	});

	it('subscribe rejects if insufficient NP balance', async () => {
		await seedWallet('key-4', 100);
		await expect(subscribe(db, 'key-4', 'starter')).rejects.toThrow('Insufficient NP');
	});

	it('cancelSubscription sets status to cancelled', async () => {
		await seedWallet('key-5', 1000);
		const result = await subscribe(db, 'key-5', 'starter');
		await cancelSubscription(db, result.subscription.id);
		const sub = await getSubscriptionById(db, result.subscription.id);
		expect(sub?.status).toBe('cancelled');
	});

	it('cancelSubscription logs cancelled event', async () => {
		await seedWallet('key-6', 1000);
		const result = await subscribe(db, 'key-6', 'starter');
		await cancelSubscription(db, result.subscription.id);
		const events = await getSubscriptionEvents(db, result.subscription.id);
		const cancelEvent = events.find((e) => e.eventType === 'cancelled');
		expect(cancelEvent).toBeDefined();
	});
});

// ========== Plan Changes ==========

describe('Plan Changes', () => {
	async function seedWallet(name: string, balance: number) {
		await env.DB.prepare(
			'INSERT OR REPLACE INTO audit_wallets (agent_name, balance_minor) VALUES (?, ?)'
		)
			.bind(name, balance)
			.run();
	}

	it('changePlan upgrades from starter to pro', async () => {
		await seedWallet('key-u1', 50000);
		const sub = await subscribe(db, 'key-u1', 'starter');
		const result = await changePlan(db, sub.subscription.id, 'pro');
		expect(result.direction).toBe('upgrade');
		expect(result.subscription.plan).toBe('pro');
	});

	it('changePlan downgrades from pro to starter', async () => {
		await seedWallet('key-d1', 50000);
		const sub = await subscribe(db, 'key-d1', 'pro');
		const result = await changePlan(db, sub.subscription.id, 'starter');
		expect(result.direction).toBe('downgrade');
		expect(result.subscription.plan).toBe('starter');
	});

	it('changePlan logs appropriate event type', async () => {
		await seedWallet('key-e1', 50000);
		const sub = await subscribe(db, 'key-e1', 'starter');
		await changePlan(db, sub.subscription.id, 'pro');
		const events = await getSubscriptionEvents(db, sub.subscription.id);
		const upgradeEvent = events.find((e) => e.eventType === 'upgraded');
		expect(upgradeEvent).toBeDefined();
		expect(upgradeEvent?.fromPlan).toBe('starter');
		expect(upgradeEvent?.toPlan).toBe('pro');
	});
});

// ========== Auto-Renewal ==========

describe('Auto-Renewal', () => {
	async function seedWallet(name: string, balance: number) {
		await env.DB.prepare(
			'INSERT OR REPLACE INTO audit_wallets (agent_name, balance_minor) VALUES (?, ?)'
		)
			.bind(name, balance)
			.run();
	}

	async function createExpiredSub(
		keyId: string,
		plan: string = 'starter',
		autoRenew: number = 1,
		status: string = 'active'
	) {
		const now = Math.floor(Date.now() / 1000);
		const id = crypto.randomUUID();
		await repoCreateSub(db, {
			id,
			keyId,
			plan,
			status,
			periodStart: now - 60 * 60 * 24 * 31,
			periodEnd: now - 100, // expired 100s ago
			autoRenew
		});
		return id;
	}

	it('processAutoRenewals renews active subscriptions past period_end', async () => {
		await seedWallet('key-r1', 10000);
		await createExpiredSub('key-r1', 'starter');
		const result = await processAutoRenewals(db);
		expect(result.renewed).toBe(1);
		expect(result.suspended).toBe(0);
	});

	it('processAutoRenewals extends period_end by 30 days', async () => {
		await seedWallet('key-r2', 10000);
		const subId = await createExpiredSub('key-r2', 'starter');
		const beforeSub = await getSubscriptionById(db, subId);
		await processAutoRenewals(db);
		const afterSub = await getSubscriptionById(db, subId);
		// period_end should have been extended by ~30 days (2592000 seconds)
		expect(afterSub!.periodEnd - beforeSub!.periodEnd).toBe(30 * 24 * 60 * 60);
	});

	it('processAutoRenewals suspends when insufficient balance', async () => {
		await seedWallet('key-r3', 100); // Not enough for starter (500 NP)
		await createExpiredSub('key-r3', 'starter');
		const result = await processAutoRenewals(db);
		expect(result.suspended).toBe(1);
		expect(result.renewed).toBe(0);
	});

	it('processAutoRenewals skips non-auto-renew subscriptions', async () => {
		await seedWallet('key-r4', 10000);
		await createExpiredSub('key-r4', 'starter', 0); // autoRenew = false
		const result = await processAutoRenewals(db);
		expect(result.renewed).toBe(0);
		expect(result.suspended).toBe(0);
	});

	it('processAutoRenewals skips cancelled subscriptions', async () => {
		await seedWallet('key-r5', 10000);
		await createExpiredSub('key-r5', 'starter', 1, 'cancelled');
		const result = await processAutoRenewals(db);
		expect(result.renewed).toBe(0);
		expect(result.suspended).toBe(0);
	});
});

// ========== Repository ==========

describe('Repository', () => {
	it('createSubscription inserts correctly', async () => {
		const now = Math.floor(Date.now() / 1000);
		const id = crypto.randomUUID();
		const result = await repoCreateSub(db, {
			id,
			keyId: 'key-repo-1',
			plan: 'pro',
			status: 'active',
			periodStart: now,
			periodEnd: now + 2592000,
			autoRenew: 1
		});
		expect(result?.id).toBe(id);
		expect(result?.plan).toBe('pro');
	});

	it('getActiveSubscription returns active sub for key', async () => {
		const now = Math.floor(Date.now() / 1000);
		await repoCreateSub(db, {
			id: crypto.randomUUID(),
			keyId: 'key-repo-2',
			plan: 'starter',
			status: 'active',
			periodStart: now,
			periodEnd: now + 2592000,
			autoRenew: 1
		});
		const active = await getActiveSubscription(db, 'key-repo-2');
		expect(active).not.toBeNull();
		expect(active?.plan).toBe('starter');
	});

	it('getExpiringSubscriptions returns subs past threshold', async () => {
		const now = Math.floor(Date.now() / 1000);
		await repoCreateSub(db, {
			id: crypto.randomUUID(),
			keyId: 'key-repo-3',
			plan: 'starter',
			status: 'active',
			periodStart: now - 2592000,
			periodEnd: now - 100,
			autoRenew: 1
		});
		const expiring = await getExpiringSubscriptions(db, now);
		expect(expiring.length).toBeGreaterThanOrEqual(1);
	});

	it('logSubscriptionEvent creates event record', async () => {
		const now = Math.floor(Date.now() / 1000);
		const subId = crypto.randomUUID();
		await repoCreateSub(db, {
			id: subId,
			keyId: 'key-repo-4',
			plan: 'starter',
			status: 'active',
			periodStart: now,
			periodEnd: now + 2592000,
			autoRenew: 1
		});
		await logSubscriptionEvent(db, {
			id: crypto.randomUUID(),
			subscriptionId: subId,
			eventType: 'created',
			toPlan: 'starter'
		});
		const events = await getSubscriptionEvents(db, subId);
		expect(events.length).toBe(1);
		expect(events[0].eventType).toBe('created');
	});
});
