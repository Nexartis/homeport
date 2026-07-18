/**
 * Subscription Service — create, cancel, change plan for recurring subscriptions
 *
 * Phase 5 — Agent Charlie (D6)
 */

import type { DbClient } from '$lib/db/client';
import type { Env } from '$lib/types';
import {
	PLAN_CONFIGS,
	type SubscriptionPlan,
	type SubscriptionResult,
	type ChangeResult,
	type SubscriptionStatusResult,
	type Subscription
} from '$lib/types/subscriptions';
import {
	createSubscription as repoCreateSub,
	getActiveSubscription,
	getSubscriptionById,
	updateSubscription,
	logSubscriptionEvent
} from '$lib/db/repositories/subscriptions';
import { ensureWallets, updateWalletBalances, getWalletBalance } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'subscriptions');

/** Platform agent name used as payee for subscription charges */
const PLATFORM_PAYEE = 'platform';

/** Subscription period duration in seconds (30 days) */
const PERIOD_DURATION_SEC = 30 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

/**
 * Create a new subscription for a developer key.
 *
 * 1. Validate plan exists
 * 2. Check no active subscription already exists for this key
 * 3. Debit NP wallet for monthlyNp cost
 * 4. Create subscription row with period_end = period_start + 30 days
 * 5. Log 'created' event
 */
export async function subscribe(
	db: DbClient,
	keyId: string,
	plan: SubscriptionPlan,
	env?: Env,
	ownerId?: string
): Promise<SubscriptionResult> {
	const config = PLAN_CONFIGS[plan];
	if (!config) {
		throw new Error(`Invalid plan: ${plan}`);
	}

	// Check for existing active subscription
	const existing = await getActiveSubscription(db, keyId);
	if (existing) {
		throw new Error(`Active subscription already exists for key ${keyId}`);
	}

	// Ensure wallet exists and check balance
	await ensureWallets(db, [keyId, PLATFORM_PAYEE]);
	const wallet = await getWalletBalance(db, keyId);
	const balance = wallet?.balanceMinor ?? 0;
	if (balance < config.monthlyNp) {
		throw new Error(
			`Insufficient NP balance: have ${balance}, need ${config.monthlyNp} for ${plan} plan`
		);
	}

	// Debit wallet
	await updateWalletBalances(db, keyId, PLATFORM_PAYEE, config.monthlyNp);

	// Create subscription
	const now = Math.floor(Date.now() / 1000);
	const subId = crypto.randomUUID();
	await repoCreateSub(db, {
		id: subId,
		keyId,
		ownerId: ownerId ?? null,
		plan,
		status: 'active',
		periodStart: now,
		periodEnd: now + PERIOD_DURATION_SEC,
		autoRenew: 1
	});

	// Log event
	await logSubscriptionEvent(db, {
		id: crypto.randomUUID(),
		subscriptionId: subId,
		eventType: 'created',
		toPlan: plan
	});

	log.info('subscribe', `Created ${plan} subscription for key ${keyId}`, { subId });

	const subscription: Subscription = {
		id: subId,
		keyId,
		plan,
		status: 'active',
		periodStart: now,
		periodEnd: now + PERIOD_DURATION_SEC,
		autoRenew: true,
		createdAt: now
	};

	return { subscription, charged: config.monthlyNp };
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/** Cancel a subscription — sets status to cancelled, autoRenew to false */
export async function cancelSubscription(db: DbClient, subId: string): Promise<void> {
	const sub = await getSubscriptionById(db, subId);
	if (!sub) {
		throw new Error(`Subscription not found: ${subId}`);
	}
	if (sub.status === 'cancelled') {
		throw new Error('Subscription is already cancelled');
	}

	const now = Math.floor(Date.now() / 1000);
	await updateSubscription(db, subId, {
		status: 'cancelled',
		autoRenew: 0,
		cancelledAt: now
	});

	await logSubscriptionEvent(db, {
		id: crypto.randomUUID(),
		subscriptionId: subId,
		eventType: 'cancelled'
	});

	log.info('cancelSubscription', `Cancelled subscription ${subId}`);
}

// ---------------------------------------------------------------------------
// Change Plan
// ---------------------------------------------------------------------------

/**
 * Change subscription plan (upgrade or downgrade).
 * Computes prorated credit/charge for remaining period.
 */
export async function changePlan(
	db: DbClient,
	subId: string,
	newPlan: SubscriptionPlan
): Promise<ChangeResult> {
	const newConfig = PLAN_CONFIGS[newPlan];
	if (!newConfig) {
		throw new Error(`Invalid plan: ${newPlan}`);
	}

	const sub = await getSubscriptionById(db, subId);
	if (!sub) {
		throw new Error(`Subscription not found: ${subId}`);
	}
	if (sub.status !== 'active') {
		throw new Error('Can only change plan on active subscriptions');
	}
	if (sub.plan === newPlan) {
		throw new Error(`Already on ${newPlan} plan`);
	}

	const oldConfig = PLAN_CONFIGS[sub.plan as SubscriptionPlan];
	const now = Math.floor(Date.now() / 1000);
	const totalPeriod = sub.periodEnd - sub.periodStart;
	const remaining = Math.max(0, sub.periodEnd - now);
	const fraction = totalPeriod > 0 ? remaining / totalPeriod : 0;

	// Prorated credit for old plan, charge for new plan
	const credit = Math.floor(oldConfig.monthlyNp * fraction);
	const charge = Math.floor(newConfig.monthlyNp * fraction);
	const netDelta = charge - credit; // positive = consumer pays more (upgrade)

	const direction: 'upgrade' | 'downgrade' =
		newConfig.monthlyNp > oldConfig.monthlyNp ? 'upgrade' : 'downgrade';

	// Apply net charge/credit via wallet
	if (netDelta > 0) {
		await ensureWallets(db, [sub.keyId, PLATFORM_PAYEE]);
		// Verify balance before debiting (same check as subscribe())
		const wallet = await getWalletBalance(db, sub.keyId);
		const balance = wallet?.balanceMinor ?? 0;
		if (balance < netDelta) {
			throw new Error(`Insufficient NP balance for upgrade: have ${balance}, need ${netDelta}`);
		}
		await updateWalletBalances(db, sub.keyId, PLATFORM_PAYEE, netDelta);
	} else if (netDelta < 0) {
		await ensureWallets(db, [sub.keyId, PLATFORM_PAYEE]);
		await updateWalletBalances(db, PLATFORM_PAYEE, sub.keyId, Math.abs(netDelta));
	}

	await updateSubscription(db, subId, { plan: newPlan });

	await logSubscriptionEvent(db, {
		id: crypto.randomUUID(),
		subscriptionId: subId,
		eventType: direction === 'upgrade' ? 'upgraded' : 'downgraded',
		fromPlan: sub.plan,
		toPlan: newPlan
	});

	log.info('changePlan', `Changed ${sub.plan} → ${newPlan} for subscription ${subId}`, {
		direction,
		netDelta
	});

	const updatedSub: Subscription = {
		id: sub.id,
		keyId: sub.keyId,
		plan: newPlan,
		status: 'active',
		periodStart: sub.periodStart,
		periodEnd: sub.periodEnd,
		autoRenew: sub.autoRenew === 1,
		createdAt: sub.createdAt ?? now
	};

	return { subscription: updatedSub, creditOrCharge: netDelta, direction };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Get subscription status for a developer key */
export async function getSubscriptionStatus(
	db: DbClient,
	keyId: string
): Promise<SubscriptionStatusResult> {
	const sub = await getActiveSubscription(db, keyId);
	if (!sub) {
		return { subscription: null, plan: null };
	}

	const plan = PLAN_CONFIGS[sub.plan as SubscriptionPlan] ?? null;
	const subscription: Subscription = {
		id: sub.id,
		keyId: sub.keyId,
		plan: sub.plan as SubscriptionPlan,
		status: sub.status as 'active' | 'suspended' | 'cancelled' | 'expired',
		periodStart: sub.periodStart,
		periodEnd: sub.periodEnd,
		autoRenew: sub.autoRenew === 1,
		createdAt: sub.createdAt ?? 0,
		cancelledAt: sub.cancelledAt ?? undefined
	};

	return { subscription, plan };
}
