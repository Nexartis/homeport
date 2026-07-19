/**
 * Resolution Strategies — Static, Rotating, and Adaptive endpoint resolution
 * Phase 6 — Agent California
 *
 * Strategy selection:
 *   - Static: no context → return endpoints from AgentFacts in order
 *   - Rotating: resolver_url set, no context → round-robin with health awareness
 *   - Adaptive: POST /resolve with context body → full scoring evaluation
 *
 * @see arXiv:2508.03113 — NANDA Adaptive Resolver
 */

import type {
	ResolutionContext,
	ResolvedEndpoint,
	HealthProbeData,
	AgentFactsV2Placeholder
} from '$lib/types/resolver';
import { ScoringEngine } from './scoring';

// ── Static Strategy ──

export class StaticStrategy {
	/** Return endpoints from AgentFacts in order, with basic scoring */
	resolve(facts: AgentFactsV2Placeholder): ResolvedEndpoint[] {
		const endpoints = facts.endpoints?.static ?? [];
		return endpoints.map((ep, index) => ({
			url: ep.url,
			protocol: ep.protocol,
			score: 1.0 - index * 0.1, // Ordered by position
			latency_estimate_ms: 0,
			trust_score: 0,
			capabilities: facts.skills?.map((s) => s.id) ?? [],
			connection_params: {},
			health_status: 'unknown' as const
		}));
	}
}

// ── Rotating Strategy ──

/** Internal counter for round-robin. Reset per-isolate, which is acceptable for Workers. */
let rotationCounter = 0;

export class RotatingStrategy {
	/**
	 * Round-robin across endpoint pool with health awareness.
	 * Unhealthy endpoints are deprioritized (moved to end) rather than removed.
	 */
	resolve(
		facts: AgentFactsV2Placeholder,
		healthData: Map<string, HealthProbeData>
	): ResolvedEndpoint[] {
		const endpoints = facts.endpoints?.static ?? [];
		if (endpoints.length === 0) return [];

		const scored = endpoints.map((ep) => {
			const health = healthData.get(ep.url);
			const healthScore = health ? health.success_rate : 0.5;
			return {
				url: ep.url,
				protocol: ep.protocol,
				score: healthScore,
				latency_estimate_ms: health?.p95_latency_ms ?? 0,
				trust_score: 0,
				capabilities: facts.skills?.map((s) => s.id) ?? [],
				connection_params: {},
				health_status: deriveHealthStatus(health)
			};
		});

		// Rotate starting index
		const start = rotationCounter % scored.length;
		rotationCounter++;

		// Rotate the array, healthy endpoints first
		const healthy = scored.filter((e) => e.health_status !== 'degraded');
		const degraded = scored.filter((e) => e.health_status === 'degraded');
		const merged = [...healthy, ...degraded];

		if (merged.length === 0) return scored;

		// Apply rotation
		const rotated = [
			...merged.slice(start % merged.length),
			...merged.slice(0, start % merged.length)
		];
		return rotated;
	}
}

// ── Adaptive Strategy ──

export class AdaptiveStrategy {
	private scoring: ScoringEngine;

	constructor(scoring: ScoringEngine) {
		this.scoring = scoring;
	}

	/**
	 * Full context evaluation: geo, load, capability match, trust.
	 * Returns endpoints ranked by composite score.
	 */
	resolve(
		facts: AgentFactsV2Placeholder,
		context: ResolutionContext,
		healthData: Map<string, HealthProbeData>,
		trustScores: Map<string, number>
	): ResolvedEndpoint[] {
		const endpoints = facts.endpoints?.static ?? [];
		if (endpoints.length === 0) return [];

		// Get agent-level trust score (use first available)
		const agentName = facts.agent_name;
		const trustScore = trustScores.get(agentName) ?? undefined;

		const scored = endpoints.map((ep) => {
			const health = healthData.get(ep.url);
			return this.scoring.scoreEndpoint(
				{
					url: ep.url,
					protocol: ep.protocol,
					capabilities: facts.skills?.map((s) => s.id)
				},
				context,
				health,
				trustScore
			);
		});

		// Filter by protocol preference if specified
		let filtered = scored;
		if (context.protocol_preference && context.protocol_preference !== 'any') {
			const matching = scored.filter((e) => e.protocol === context.protocol_preference);
			if (matching.length > 0) filtered = matching;
		}

		// Filter by minimum trust score
		if (context.min_trust_score != null) {
			const trustFiltered = filtered.filter((e) => e.trust_score >= (context.min_trust_score ?? 0));
			if (trustFiltered.length > 0) filtered = trustFiltered;
		}

		return this.scoring.rankEndpoints(filtered);
	}
}

// ── Helper ──

function deriveHealthStatus(data?: HealthProbeData): 'healthy' | 'degraded' | 'unknown' {
	if (!data) return 'unknown';
	if (data.success_rate >= 0.95 && data.p95_latency_ms < 2000) return 'healthy';
	if (data.success_rate >= 0.5) return 'degraded';
	return 'degraded';
}
