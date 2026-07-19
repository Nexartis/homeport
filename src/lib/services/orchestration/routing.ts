/**
 * Routing Service — Intelligent agent selection for workflow steps.
 * Phase 6 — Sprint 14: A2A Routing + Sub-agent Delegation
 *
 * Selects the best agent for a given action/capability by:
 *  1. Querying the registry for agents matching required capabilities
 *  2. Scoring candidates using health data, trust scores, and capability match
 *  3. Logging routing decisions for analytics
 *
 * Integrates with the existing Adaptive Resolver and ScoringEngine.
 */

import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentAddrs, probeRuns, reputationSnapshots } from '$lib/db/schema';
import { createRoutingDecision } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'routing');

export interface RoutingRequest {
	sourceAgentId: string;
	action: string;
	requiredCapabilities?: string[];
	preferredProtocol?: 'a2a' | 'mcp' | 'https' | 'any';
	minTrustScore?: number;
	maxLatencyMs?: number;
	excludeAgents?: string[];
}

export interface RoutingCandidate {
	agentId: string;
	agentUrl: string | null;
	apiUrl?: string | null;
	capabilities: string[];
	score: number;
	trustScore: number;
	healthScore: number;
	capabilityScore: number;
	reason: string;
}

export interface RoutingResult {
	requestId: string;
	selectedAgent: RoutingCandidate | null;
	candidates: RoutingCandidate[];
	strategy: string;
	durationMs: number;
}

/** Weights for routing score calculation */
const ROUTING_WEIGHTS = {
	capability: 0.4,
	trust: 0.3,
	health: 0.3
};

/**
 * Route a request to the best available agent.
 */
export async function routeToAgent(db: DbClient, request: RoutingRequest): Promise<RoutingResult> {
	const startMs = Date.now();
	const requestId = nanoid();

	// 1. Find candidate agents
	const candidateRows = await findCandidateAgents(db, request);

	// 2. Score each candidate
	const scored: RoutingCandidate[] = [];
	for (const row of candidateRows) {
		let capabilities: string[] = [];
		try {
			capabilities = row.capabilities ? (JSON.parse(row.capabilities) as string[]) : [];
		} catch {
			log.warn('routeToAgent', `Corrupt capabilities JSON for agent ${row.agentId}`);
		}
		const capScore = computeCapabilityScore(capabilities, request.requiredCapabilities);
		const trustScore = await getAgentTrustScore(db, row.agentId);
		const healthScore = await getAgentHealthScore(db, row.agentId);

		// Filter by min trust
		if (request.minTrustScore != null && trustScore < request.minTrustScore) continue;

		const composite =
			capScore * ROUTING_WEIGHTS.capability +
			trustScore * ROUTING_WEIGHTS.trust +
			healthScore * ROUTING_WEIGHTS.health;

		scored.push({
			agentId: row.agentId,
			agentUrl: row.agentUrl,
			apiUrl: row.apiUrl,
			capabilities,
			score: Math.round(composite * 1000) / 1000,
			trustScore,
			healthScore,
			capabilityScore: capScore,
			reason: capScore >= 1.0 ? 'full_match' : capScore > 0 ? 'partial_match' : 'no_match'
		});
	}

	// 3. Sort by score descending
	scored.sort((a, b) => b.score - a.score);

	const selected = scored.length > 0 ? scored[0] : null;
	const durationMs = Date.now() - startMs;

	// 4. Log routing decision (non-blocking)
	if (selected) {
		createRoutingDecision(db, {
			id: nanoid(),
			requestId,
			sourceAgentId: request.sourceAgentId,
			targetAgentId: selected.agentId,
			action: request.action,
			strategy: 'capability',
			score: selected.score,
			contextJson: JSON.stringify({
				requiredCapabilities: request.requiredCapabilities,
				preferredProtocol: request.preferredProtocol
			}),
			candidatesJson: JSON.stringify(scored.map((c) => ({ id: c.agentId, score: c.score }))),
			selectedReason: selected.reason,
			latencyMs: durationMs,
			success: null
		}).catch((err) => {
			log.error('routeToAgent', 'Failed to log routing decision', {
				error: err instanceof Error ? err.message : String(err)
			});
		});
	}

	log.info(
		'routeToAgent',
		`Routed ${request.action}: ${scored.length} candidates, selected=${selected?.agentId ?? 'none'}`,
		{
			requestId,
			durationMs
		}
	);

	return {
		requestId,
		selectedAgent: selected,
		candidates: scored,
		strategy: 'capability',
		durationMs
	};
}

/**
 * Find candidate agents from the registry that match the request.
 */
async function findCandidateAgents(
	db: DbClient,
	request: RoutingRequest
): Promise<
	Array<{
		agentId: string;
		agentUrl: string | null;
		apiUrl: string | null;
		capabilities: string | null;
	}>
> {
	// Query all alive agents
	const rows = await db.query.agentAddrs.findMany({
		where: eq(agentAddrs.status, 'alive'),
		columns: {
			agentId: true,
			agentUrl: true,
			apiUrl: true,
			capabilities: true
		}
	});

	// Filter out excluded agents and source agent
	const excluded = new Set(request.excludeAgents ?? []);
	excluded.add(request.sourceAgentId);

	return rows.filter((r) => {
		if (excluded.has(r.agentId)) return false;

		// If capabilities are required, check at least one matches
		if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
			let caps: string[] = [];
			try {
				caps = r.capabilities ? (JSON.parse(r.capabilities) as string[]) : [];
			} catch {
				return false; // skip agents with corrupt capabilities
			}
			const hasAny = request.requiredCapabilities.some((rc) => caps.includes(rc));
			if (!hasAny) return false;
		}

		return true;
	});
}

/**
 * Compute capability match score (0.0–1.0).
 * Full match on all required capabilities = 1.0
 */
function computeCapabilityScore(available: string[], required?: string[]): number {
	if (!required || required.length === 0) return 1.0;
	const matched = required.filter((r) => available.includes(r));
	return matched.length / required.length;
}

/**
 * Get the latest trust/reputation score for an agent (0.0–1.0).
 */
async function getAgentTrustScore(db: DbClient, agentId: string): Promise<number> {
	try {
		const rep = await db.query.reputationSnapshots.findFirst({
			where: eq(reputationSnapshots.agentId, agentId),
			orderBy: desc(reputationSnapshots.createdAt)
		});
		return rep?.reputation != null ? Math.min(1, Math.max(0, rep.reputation)) : 0.5;
	} catch {
		return 0.5;
	}
}

/**
 * Get health score for an agent from recent probes (0.0–1.0).
 */
async function getAgentHealthScore(db: DbClient, agentId: string): Promise<number> {
	try {
		const probe = await db.query.probeRuns.findFirst({
			where: eq(probeRuns.agentId, agentId),
			orderBy: desc(probeRuns.createdAt)
		});
		if (!probe) return 0.5;
		const successRate =
			probe.probesSent && probe.probesSent > 0 ? (probe.successCount ?? 0) / probe.probesSent : 0.5;
		return successRate;
	} catch {
		return 0.5;
	}
}
