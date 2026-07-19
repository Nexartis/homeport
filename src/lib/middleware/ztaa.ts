/**
 * Zero Trust Agentic Access (ZTAA) Middleware — Phase 6 (Agent Hawaii)
 *
 * Enforces trust-based access policies on agent-to-agent interactions.
 * Every request is evaluated against a ZTAAPolicy:
 *  - Minimum trust score
 *  - Required VC authentication
 *  - Jurisdiction allowlist
 *  - Content flag blocklist
 *  - Required certifications
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase F — ZTAA
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentFacts, crossRegistryScores } from '$lib/db/schema';
import type { ZTAAPolicy } from '$lib/types/safesearch';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'ztaa');

export interface ZTAAResult {
	allowed: boolean;
	reason?: string;
	trust_score?: number;
	policy_applied: string;
}

/** Default ZTAA policy — permissive baseline */
export const DEFAULT_ZTAA_POLICY: ZTAAPolicy = {
	min_trust_score: 0,
	require_vc_auth: false,
	allowed_jurisdictions: undefined,
	blocked_content_flags: undefined,
	required_certifications: undefined
};

/**
 * Evaluate a ZTAA policy against a requesting agent.
 *
 * @param db - Database client
 * @param agentId - The agent requesting access
 * @param policy - The ZTAA policy to enforce
 * @returns ZTAAResult indicating whether access is allowed
 */
export async function evaluateZTAA(
	db: DbClient,
	agentId: string,
	policy: ZTAAPolicy
): Promise<ZTAAResult> {
	// 1. Look up agent's trust score
	const trustRow = await db.query.crossRegistryScores.findFirst({
		where: eq(crossRegistryScores.agentId, agentId)
	});

	const trustScore = trustRow?.combinedReputation ?? 0;

	// 2. Require VC authentication if policy demands it
	if (policy.require_vc_auth) {
		// Agent must have a valid certificate (certLevel) to satisfy VC auth
		const vcFacts = await db.query.agentFacts.findFirst({
			where: eq(agentFacts.agentId, agentId)
		});
		if (!vcFacts?.certLevel) {
			log.info('evaluateZTAA', `Agent ${agentId} blocked: VC auth required but no cert`, {
				agentId
			});
			return {
				allowed: false,
				reason: 'VC authentication required but agent has no valid certificate',
				trust_score: trustScore,
				policy_applied: 'require_vc_auth'
			};
		}
	}

	// 3. Check minimum trust score
	if (trustScore < policy.min_trust_score) {
		log.info(
			'evaluateZTAA',
			`Agent ${agentId} blocked: trust ${trustScore} < ${policy.min_trust_score}`,
			{
				agentId,
				trustScore,
				required: policy.min_trust_score
			}
		);
		return {
			allowed: false,
			reason: `Trust score ${trustScore.toFixed(2)} below minimum ${policy.min_trust_score}`,
			trust_score: trustScore,
			policy_applied: 'min_trust_score'
		};
	}

	// 4. Look up agent facts for jurisdiction + cert checks
	const facts = await db.query.agentFacts.findFirst({
		where: eq(agentFacts.agentId, agentId)
	});

	// 5. Jurisdiction check
	if (policy.allowed_jurisdictions?.length) {
		const jurisdiction = facts?.jurisdiction;
		if (!jurisdiction || !policy.allowed_jurisdictions.includes(jurisdiction.toUpperCase())) {
			return {
				allowed: false,
				reason: `Jurisdiction '${jurisdiction ?? 'unknown'}' not in allowed list`,
				trust_score: trustScore,
				policy_applied: 'allowed_jurisdictions'
			};
		}
	}

	// 6. Required certifications check
	if (policy.required_certifications?.length) {
		const certLevel = facts?.certLevel;
		if (!certLevel || !policy.required_certifications.includes(certLevel)) {
			return {
				allowed: false,
				reason: `Certification '${certLevel ?? 'none'}' not in required list`,
				trust_score: trustScore,
				policy_applied: 'required_certifications'
			};
		}
	}

	// 7. Content flag blocklist check
	if (policy.blocked_content_flags?.length && facts?.factsJson) {
		try {
			const parsed = JSON.parse(facts.factsJson);
			const flags: string[] = parsed.content_flags ?? parsed.flags ?? [];
			const blocked = policy.blocked_content_flags.find((f) =>
				flags.some((flag) => flag.toLowerCase() === f.toLowerCase())
			);
			if (blocked) {
				return {
					allowed: false,
					reason: `Content flag '${blocked}' is blocked by policy`,
					trust_score: trustScore,
					policy_applied: 'blocked_content_flags'
				};
			}
		} catch {
			// Can't parse facts — skip flag check
		}
	}

	// All checks passed
	return {
		allowed: true,
		trust_score: trustScore,
		policy_applied: 'none'
	};
}

/**
 * Build a 403 Forbidden response for ZTAA policy violations.
 */
export function ztaaForbiddenResponse(result: ZTAAResult): Response {
	return new Response(
		JSON.stringify({
			error: 'ZTAA Policy Violation',
			reason: result.reason,
			trust_score: result.trust_score,
			policy_applied: result.policy_applied
		}),
		{
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}
