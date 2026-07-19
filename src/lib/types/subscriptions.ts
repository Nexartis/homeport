/**
 * Subscription Types — Phase 5, Agent Charlie (D6)
 *
 * Type definitions and plan configuration for the subscription model.
 */

export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'expired';

export interface PlanConfig {
	plan: SubscriptionPlan;
	monthlyNp: number;
	includedCalls: number;
	overageRateNp: number;
	displayName: string;
}

export interface Subscription {
	id: string;
	keyId: string;
	plan: SubscriptionPlan;
	status: SubscriptionStatus;
	periodStart: number;
	periodEnd: number;
	autoRenew: boolean;
	createdAt: number;
	cancelledAt?: number;
}

export interface SubscriptionEvent {
	id: string;
	subscriptionId: string;
	eventType:
		| 'created'
		| 'renewed'
		| 'upgraded'
		| 'downgraded'
		| 'cancelled'
		| 'suspended'
		| 'reactivated';
	fromPlan?: string;
	toPlan?: string;
	metadata?: string;
	createdAt: number;
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
	starter: {
		plan: 'starter',
		monthlyNp: 500,
		includedCalls: 1000,
		overageRateNp: 1.0,
		displayName: 'Starter'
	},
	pro: {
		plan: 'pro',
		monthlyNp: 4000,
		includedCalls: 10000,
		overageRateNp: 0.8,
		displayName: 'Pro'
	},
	enterprise: {
		plan: 'enterprise',
		monthlyNp: 30000,
		includedCalls: 100000,
		overageRateNp: 0.4,
		displayName: 'Enterprise'
	}
};

/** Result from subscribing */
export interface SubscriptionResult {
	subscription: Subscription;
	charged: number;
}

/** Result from changing plan */
export interface ChangeResult {
	subscription: Subscription;
	creditOrCharge: number;
	direction: 'upgrade' | 'downgrade';
}

/** Status result for a key's subscription */
export interface SubscriptionStatusResult {
	subscription: Subscription | null;
	plan: PlanConfig | null;
	usedCalls?: number;
	remainingCalls?: number;
}

/** Result from auto-renewal sweep */
export interface RenewalResult {
	renewed: number;
	suspended: number;
	errors: number;
}
