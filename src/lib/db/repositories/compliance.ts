/**
 * Compliance Repository — typed data access for compliance_policies,
 * compliance_decisions, and compliance_violations tables.
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import { compliancePolicies, complianceDecisions, complianceViolations } from '../schema';

// ===================================================================
// Policy Rules
// ===================================================================

/** Get policy rules JSON by policy ID */
export async function getPolicyRules(db: DbClient, policyId: string) {
	return (
		(await db.query.compliancePolicies.findFirst({
			columns: { rulesJson: true },
			where: eq(compliancePolicies.policyId, policyId)
		})) ?? null
	);
}

// ===================================================================
// Decision Logging
// ===================================================================

/** Insert a compliance decision record */
export async function insertDecision(
	db: DbClient,
	decision: {
		decisionId: string;
		envelopeHash: string;
		fromAgent: string;
		toAgent: string;
		capability: string;
		decision: string;
		reasons: string;
		createdAt: number;
	}
) {
	return await db.insert(complianceDecisions).values(decision);
}

// ===================================================================
// Violation Reporting
// ===================================================================

/** Insert a compliance violation record */
export async function insertViolation(
	db: DbClient,
	violation: {
		violationId: string;
		agentId: string;
		envelopeHash: string | null;
		reason: string;
		createdAt: number;
	}
) {
	return await db.insert(complianceViolations).values(violation);
}
