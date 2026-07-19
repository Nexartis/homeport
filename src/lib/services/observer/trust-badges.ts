/**
 * Trust Badge Service — pure computation of Bronze/Silver/Gold trust badges
 * from existing NANDA reputation data.
 *
 * Badge tiers:
 *   - None  (<0.50): Below minimum threshold
 *   - Bronze (≥0.50): Base level — agent is monitored and functional
 *   - Silver (≥0.70): Reliable — good availability and probe success
 *   - Gold   (≥0.85): Excellent — high reputation, certified, low fraud
 *
 * Gold has additional hard requirements (all must be true):
 *   - cert_score ≥ 0.70
 *   - fraud_rate < 0.05
 *   - availability ≥ 0.90
 */

// ---------------------------------------------------------------------------
// Constants — Badge tier thresholds
// ---------------------------------------------------------------------------

/** Minimum reputation for Bronze badge */
const BRONZE_THRESHOLD = 0.5;

/** Minimum reputation for Silver badge */
const SILVER_THRESHOLD = 0.7;

/** Minimum reputation for Gold badge */
const GOLD_THRESHOLD = 0.85;

/** Gold hard requirement: minimum cert_score */
const GOLD_MIN_CERT_SCORE = 0.7;

/** Gold hard requirement: maximum fraud_rate (exclusive) */
const GOLD_MAX_FRAUD_RATE = 0.05;

/** Gold hard requirement: minimum availability */
const GOLD_MIN_AVAILABILITY = 0.9;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Trust badge tier identifiers */
export type TrustBadgeTier = 'none' | 'bronze' | 'silver' | 'gold';

/** Computed trust badge with gamification data */
export interface TrustBadge {
	/** Badge tier */
	tier: TrustBadgeTier;
	/** The agent's reputation score */
	reputation: number;
	/** Human-readable tier label */
	label: string;
	/** Emoji for the badge tier */
	emoji: string;
	/** List of requirements that are currently satisfied */
	requirements_met: string[];
	/** Next tier to aim for, or null if already at Gold */
	next_tier: TrustBadgeTier | null;
	/** Gap to next tier threshold, or null if already at Gold */
	next_tier_gap: number | null;
}

/** Input shape — subset of reputation data needed for badge computation */
export interface ReputationData {
	reputation: number | null;
	availability: number | null;
	cert_score: number | null;
	fraud_rate: number | null;
}

// ---------------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------------

const TIER_META: Record<TrustBadgeTier, { label: string; emoji: string }> = {
	none: { label: 'None', emoji: '' },
	bronze: { label: 'Bronze', emoji: '🥉' },
	silver: { label: 'Silver', emoji: '🥈' },
	gold: { label: 'Gold', emoji: '🥇' }
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute the trust badge for an agent based on its reputation data.
 *
 * Pure function — no DB access, no side effects.
 *
 * @param data - Reputation data for the agent (reputation, availability, cert_score, fraud_rate).
 * @returns Computed {@link TrustBadge} with tier, requirements met, and next-tier guidance.
 */
export function computeTrustBadge(data: ReputationData): TrustBadge {
	// Round reputation up front so tier boundaries and displayed value are always consistent.
	// Without this, 0.699 rounds to 0.70 for display but would still fall into "bronze".
	const reputation = round(data.reputation ?? 0);
	const availability = data.availability ?? 0;
	const certScore = data.cert_score ?? 0;
	const fraudRate = data.fraud_rate ?? 1;

	// Collect which requirements are met
	const requirementsMet: string[] = [];

	if (reputation >= BRONZE_THRESHOLD) requirementsMet.push(`reputation >= ${BRONZE_THRESHOLD}`);
	if (reputation >= SILVER_THRESHOLD) requirementsMet.push(`reputation >= ${SILVER_THRESHOLD}`);
	if (reputation >= GOLD_THRESHOLD) requirementsMet.push(`reputation >= ${GOLD_THRESHOLD}`);
	if (certScore >= GOLD_MIN_CERT_SCORE)
		requirementsMet.push(`cert_score >= ${GOLD_MIN_CERT_SCORE}`);
	if (fraudRate < GOLD_MAX_FRAUD_RATE) requirementsMet.push(`fraud_rate < ${GOLD_MAX_FRAUD_RATE}`);
	if (availability >= GOLD_MIN_AVAILABILITY)
		requirementsMet.push(`availability >= ${GOLD_MIN_AVAILABILITY}`);

	// Determine tier
	let tier: TrustBadgeTier = 'none';

	if (reputation >= GOLD_THRESHOLD) {
		// Gold requires additional hard checks
		const goldHardReqs =
			certScore >= GOLD_MIN_CERT_SCORE &&
			fraudRate < GOLD_MAX_FRAUD_RATE &&
			availability >= GOLD_MIN_AVAILABILITY;

		tier = goldHardReqs ? 'gold' : 'silver';
	} else if (reputation >= SILVER_THRESHOLD) {
		tier = 'silver';
	} else if (reputation >= BRONZE_THRESHOLD) {
		tier = 'bronze';
	}

	// Next tier guidance
	let nextTier: TrustBadgeTier | null = null;
	let nextTierGap: number | null = null;

	if (tier === 'none') {
		nextTier = 'bronze';
		nextTierGap = round(BRONZE_THRESHOLD - reputation);
	} else if (tier === 'bronze') {
		nextTier = 'silver';
		nextTierGap = round(SILVER_THRESHOLD - reputation);
	} else if (tier === 'silver') {
		nextTier = 'gold';
		// If reputation already meets gold threshold but hard reqs failed,
		// gap is 0 — the agent needs to meet hard requirements, not more reputation.
		nextTierGap = reputation >= GOLD_THRESHOLD ? 0 : round(GOLD_THRESHOLD - reputation);
	}
	// Gold → no next tier

	const meta = TIER_META[tier];

	return {
		tier,
		reputation: round(reputation),
		label: meta.label,
		emoji: meta.emoji,
		requirements_met: requirementsMet,
		next_tier: nextTier,
		next_tier_gap: nextTierGap
	};
}

/** Round to 2 decimal places to avoid floating-point noise */
function round(n: number): number {
	return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Trust Certificate (Phase 3 — Agent Beta)
// ---------------------------------------------------------------------------

/** Historical badge snapshot used for tier-stability analysis */
export interface BadgeHistoryEntry {
	tier: TrustBadgeTier;
	reputation: number;
	recorded_at: number;
}

/** Extended badge with certificate-level metadata */
export interface TrustCertificate extends TrustBadge {
	/** Ordered history of badge tiers (newest first) */
	badge_history: BadgeHistoryEntry[];
	/** Unix timestamp when the agent first achieved its current tier (or null) */
	held_since: number | null;
	/** Ratio of history entries that match the current tier (0–1) */
	tier_stability: number;
	/** Whether the agent qualifies for a formal trust certificate */
	certificate_eligible: boolean;
}

/** Minimum consecutive periods at a tier to be certificate-eligible */
const CERT_MIN_PERIODS = 7;

/** Minimum tier for certificate eligibility */
const CERT_MIN_TIER: TrustBadgeTier = 'silver';

const TIER_ORDER: Record<TrustBadgeTier, number> = {
	none: 0,
	bronze: 1,
	silver: 2,
	gold: 3
};

/**
 * Compute an extended trust certificate that includes badge history,
 * tier-stability metrics, and certificate eligibility.
 *
 * Pure function — no DB access, no side effects.
 *
 * @param data - Current reputation data for the agent.
 * @param history - Ordered array of historical badge snapshots (newest first).
 * @returns Extended {@link TrustCertificate}.
 */
export function computeTrustCertificate(
	data: ReputationData,
	history: BadgeHistoryEntry[]
): TrustCertificate {
	const badge = computeTrustBadge(data);

	// Determine held_since: walk history from newest to oldest,
	// find the first entry whose tier differs from current tier,
	// then held_since = the entry just after that (or the oldest if all match).
	let heldSince: number | null = null;
	let consecutiveCount = 0;

	for (let i = 0; i < history.length; i++) {
		if (history[i].tier === badge.tier) {
			consecutiveCount++;
			heldSince = history[i].recorded_at;
		} else {
			break;
		}
	}

	// Tier stability: fraction of history entries matching current tier
	const matchCount = history.filter((h) => h.tier === badge.tier).length;
	const tierStability = history.length > 0 ? round(matchCount / history.length) : 0;

	// Certificate eligibility:
	// - Must be at or above CERT_MIN_TIER
	// - Must have held the tier for at least CERT_MIN_PERIODS consecutive periods
	const meetsMinTier = TIER_ORDER[badge.tier] >= TIER_ORDER[CERT_MIN_TIER];
	const certificateEligible = meetsMinTier && consecutiveCount >= CERT_MIN_PERIODS;

	return {
		...badge,
		badge_history: history,
		held_since: heldSince,
		tier_stability: tierStability,
		certificate_eligible: certificateEligible
	};
}
