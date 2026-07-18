/**
 * Auto-Renewal Cron — daily sweep for expiring subscriptions
 *
 * Phase 5 — Agent Charlie (D6)
 *
 * Finds active subscriptions past period_end with auto_renew enabled,
 * debits NP wallet for the next period, or suspends if insufficient balance.
 */

import type { DbClient } from '$lib/db/client';
import type { Env } from '$lib/types';
import { PLAN_CONFIGS, type SubscriptionPlan, type RenewalResult } from '$lib/types/subscriptions';
import {
	getExpiringSubscriptions,
	updateSubscription,
	logSubscriptionEvent
} from '$lib/db/repositories/subscriptions';
import { ensureWallets, updateWalletBalances, getWalletBalance } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'auto-renew');

/** Platform agent name used as payee for subscription charges */
const PLATFORM_PAYEE = 'platform';

/** Subscription period duration in seconds (30 days) */
const PERIOD_DURATION_SEC = 30 * 24 * 60 * 60;

/**
 * Process auto-renewals for all expiring subscriptions.
 *
 * Daily sweep logic:
 * 1. Find all active subscriptions where period_end <= now and auto_renew = true
 * 2. For each subscription:
 *    a. Check NP wallet balance for monthlyNp cost
 *    b. If sufficient: debit wallet, extend period_end by 30 days, log 'renewed' event
 *    c. If insufficient: set status to 'suspended', log 'suspended' event
 * 3. Return summary
 */
export async function processAutoRenewals(db: DbClient, _env?: Env): Promise<RenewalResult> {
	const now = Math.floor(Date.now() / 1000);
	const result: RenewalResult = { renewed: 0, suspended: 0, errors: 0 };

	const expiring = await getExpiringSubscriptions(db, now);
	if (expiring.length === 0) {
		log.info('processAutoRenewals', 'No subscriptions to renew');
		return result;
	}

	log.info('processAutoRenewals', `Found ${expiring.length} subscriptions to process`);

	for (const sub of expiring) {
		try {
			const plan = sub.plan as SubscriptionPlan;
			const config = PLAN_CONFIGS[plan];
			if (!config) {
				log.warn('processAutoRenewals', `Unknown plan ${plan} for subscription ${sub.id}`);
				result.errors++;
				continue;
			}

			// Ensure wallets exist
			await ensureWallets(db, [sub.keyId, PLATFORM_PAYEE]);

			// Check balance
			const wallet = await getWalletBalance(db, sub.keyId);
			const balance = wallet?.balanceMinor ?? 0;

			if (balance >= config.monthlyNp) {
				// Sufficient balance — renew
				await updateWalletBalances(db, sub.keyId, PLATFORM_PAYEE, config.monthlyNp);

				const newPeriodEnd = sub.periodEnd + PERIOD_DURATION_SEC;
				await updateSubscription(db, sub.id, {
					periodEnd: newPeriodEnd
				});

				await logSubscriptionEvent(db, {
					id: crypto.randomUUID(),
					subscriptionId: sub.id,
					eventType: 'renewed',
					metadata: JSON.stringify({ charged: config.monthlyNp, newPeriodEnd })
				});

				result.renewed++;
				log.info('processAutoRenewals', `Renewed subscription ${sub.id}`, {
					plan,
					charged: config.monthlyNp
				});
			} else {
				// Insufficient balance — suspend
				await updateSubscription(db, sub.id, { status: 'suspended' });

				await logSubscriptionEvent(db, {
					id: crypto.randomUUID(),
					subscriptionId: sub.id,
					eventType: 'suspended',
					metadata: JSON.stringify({
						reason: 'insufficient_balance',
						balance,
						required: config.monthlyNp
					})
				});

				result.suspended++;
				log.warn('processAutoRenewals', `Suspended subscription ${sub.id} — insufficient NP`, {
					balance,
					required: config.monthlyNp
				});
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log.error('processAutoRenewals', `Error processing subscription ${sub.id}`, {
				error: message
			});
			result.errors++;
		}
	}

	log.info('processAutoRenewals', 'Auto-renewal sweep complete', {
		renewed: result.renewed,
		suspended: result.suspended,
		errors: result.errors
	});
	return result;
}
