/**
 * Billing Domain Types — Phase 5 (Agent Bravo)
 *
 * Defines types for usage-based billing: tiers, billing periods,
 * line items, metering results, and tier configuration constants.
 */

// ===================================================================
// Billing Tiers
// ===================================================================

export type BillingTier = 'free' | 'pro' | 'enterprise';

export interface TierConfig {
	tier: BillingTier;
	includedCalls: number;
	overageRateNp: number; // NP per call beyond included
	overageRateUsd: number; // USD equivalent per overage call
}

/**
 * Tier configuration constants — defines included calls and overage rates.
 *
 * | Tier       | Included Calls/mo | Overage Rate (NP) | Monthly Base (NP) |
 * |------------|-------------------|-------------------|-------------------|
 * | free       | 1,000             | N/A (blocked)     | 0                 |
 * | pro        | 10,000            | 1 NP ($0.001)     | 0                 |
 * | enterprise | 100,000           | 0.5 NP ($0.0005)  | 0                 |
 */
export const TIER_CONFIGS: Record<BillingTier, TierConfig> = {
	free: {
		tier: 'free',
		includedCalls: 1_000,
		overageRateNp: 0, // Free tier blocks at limit — no overage
		overageRateUsd: 0
	},
	pro: {
		tier: 'pro',
		includedCalls: 10_000,
		overageRateNp: 1, // 1 NP per overage call
		overageRateUsd: 0.001
	},
	enterprise: {
		tier: 'enterprise',
		includedCalls: 100_000,
		overageRateNp: 0.5, // 0.5 NP per overage call
		overageRateUsd: 0.0005
	}
};

// ===================================================================
// Billing Periods
// ===================================================================

export interface BillingPeriod {
	id: string;
	keyId: string;
	tier: BillingTier;
	periodStart: number; // Unix timestamp
	periodEnd: number;
	totalCalls: number;
	includedCalls: number;
	overageCalls: number;
	overageChargeNp: number;
	status: 'open' | 'closed' | 'invoiced';
}

// ===================================================================
// Billing Line Items
// ===================================================================

export type LineItemCategory = 'base' | 'overage' | 'credit' | 'adjustment';

export interface BillingLineItem {
	id: string;
	periodId: string;
	description: string;
	quantity: number;
	unitPriceNp: number;
	totalNp: number;
	category: LineItemCategory;
}

// ===================================================================
// Metering Results
// ===================================================================

export interface MeteringResult {
	allowed: boolean;
	overage: boolean;
	chargeNp: number;
	totalCalls: number;
	includedCalls: number;
}

export interface OverageResult {
	overageCalls: number;
	chargeNp: number;
}

export interface UsageSummary {
	keyId: string;
	tier: BillingTier;
	periodStart: number;
	periodEnd: number;
	totalCalls: number;
	includedCalls: number;
	overageCalls: number;
	overageChargeNp: number;
	status: 'open' | 'closed' | 'invoiced';
}
