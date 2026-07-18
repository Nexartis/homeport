/**
 * Compliance Scanner — Agent Beta Phase 3
 *
 * Periodic automated policy re-evaluation for all registered agents.
 * Checks reputation metrics against minimum compliance thresholds and
 * stores results in the compliance_scan_runs table.
 *
 * Exports:
 *   scanAgent(db, agentId, policyId, scanType)
 *   scanAllAgents(db, policyId)
 *   getLastScanResults(db, agentId, limit)
 */

import type { DbClient } from '$lib/db/client';
import { sql, eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { complianceScanRuns, type ComplianceScanRun } from '$lib/db/schema';
import { getAliveAgents } from '$lib/db/repositories';

// ---------------------------------------------------------------------------
// Constants — compliance thresholds
// ---------------------------------------------------------------------------

/** Minimum reputation score for ALLOW (below → DENY) */
const MIN_REPUTATION = 0.3;

/** Maximum fraud rate (above → DENY) */
const MAX_FRAUD_RATE = 0.1;

/** Minimum availability for ALLOW (below → ESCALATE) */
const MIN_AVAILABILITY = 0.5;

/** Default scanning policy identifier */
const DEFAULT_POLICY_ID = 'minimum-standards';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScanDecision = 'ALLOW' | 'DENY' | 'ESCALATE';

export interface ScanResult {
	id: string;
	agent_id: string;
	policy_id: string;
	decision: ScanDecision;
	reasons: string[];
	scan_type: string;
	created_at: number;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Run a compliance scan for a single agent.
 *
 * Fetches the agent's latest reputation snapshot and evaluates it
 * against minimum compliance thresholds.
 *
 * @param db - Drizzle D1 client.
 * @param agentId - Target agent identifier.
 * @param policyId - Policy to evaluate against (default: 'minimum-standards').
 * @param scanType - 'scheduled' or 'manual' (default: 'scheduled').
 */
export async function scanAgent(
	db: DbClient,
	agentId: string,
	policyId: string = DEFAULT_POLICY_ID,
	scanType: 'scheduled' | 'manual' = 'scheduled'
): Promise<ScanResult> {
	// Fetch latest reputation snapshot
	const rep = await db.get<{
		reputation: number | null;
		availability: number | null;
		fraud_rate: number | null;
		error_rate: number | null;
	}>(sql`SELECT reputation, availability, fraud_rate, error_rate
		FROM reputation_snapshots
		WHERE agent_id = ${agentId}
		ORDER BY created_at DESC LIMIT 1`);

	const reasons: string[] = [];
	let decision: ScanDecision = 'ALLOW';

	if (!rep) {
		// No reputation data — cannot evaluate
		decision = 'ESCALATE';
		reasons.push('No reputation data available for evaluation');
	} else {
		const reputation = rep.reputation ?? 0;
		const fraudRate = rep.fraud_rate ?? 0;
		const availability = rep.availability ?? 0;

		// Check thresholds
		if (reputation < MIN_REPUTATION) {
			decision = 'DENY';
			reasons.push(`Reputation ${reputation.toFixed(3)} below minimum ${MIN_REPUTATION}`);
		}

		if (fraudRate > MAX_FRAUD_RATE) {
			decision = 'DENY';
			reasons.push(
				`Fraud rate ${(fraudRate * 100).toFixed(1)}% exceeds maximum ${MAX_FRAUD_RATE * 100}%`
			);
		}

		if (availability < MIN_AVAILABILITY && decision !== 'DENY') {
			decision = 'ESCALATE';
			reasons.push(
				`Availability ${(availability * 100).toFixed(1)}% below minimum ${MIN_AVAILABILITY * 100}%`
			);
		}

		if (reasons.length === 0) {
			reasons.push('All compliance checks passed');
		}
	}

	// Persist scan result
	const id = nanoid();
	const now = Math.floor(Date.now() / 1000);

	await db.insert(complianceScanRuns).values({
		id,
		agentId,
		policyId,
		decision,
		reasons: JSON.stringify(reasons),
		scanType,
		createdAt: now
	});

	return {
		id,
		agent_id: agentId,
		policy_id: policyId,
		decision,
		reasons,
		scan_type: scanType,
		created_at: now
	};
}

/**
 * Run a compliance scan for all alive agents.
 */
export async function scanAllAgents(
	db: DbClient,
	policyId: string = DEFAULT_POLICY_ID
): Promise<{ scanned: number; results: ScanResult[] }> {
	const agents = await getAliveAgents(db);
	const results: ScanResult[] = [];

	for (const agent of agents) {
		const result = await scanAgent(db, agent.agentId, policyId);
		results.push(result);
	}

	return { scanned: results.length, results };
}

/**
 * Get the most recent scan results for an agent.
 */
export async function getLastScanResults(
	db: DbClient,
	agentId: string,
	limit: number = 10
): Promise<ComplianceScanRun[]> {
	return await db
		.select()
		.from(complianceScanRuns)
		.where(eq(complianceScanRuns.agentId, agentId))
		.orderBy(desc(complianceScanRuns.createdAt))
		.limit(limit);
}
