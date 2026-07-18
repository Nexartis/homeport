/**
 * Scoring Engine — Composite endpoint scoring for adaptive resolution
 * Phase 6 — Agent California
 *
 * Scoring formula:
 *   composite = (geo × w_geo) + (trust × w_trust) + (capability × w_cap) + (health × w_health)
 *
 * @see arXiv:2508.03113 — NANDA Adaptive Resolver
 */

import type {
	ResolutionContext,
	ResolvedEndpoint,
	ScoringWeights,
	HealthProbeData
} from '$lib/types/resolver';
import { DEFAULT_WEIGHTS } from '$lib/types/resolver';

/** High-latency threshold in ms — endpoints above this score 0 for health */
const HIGH_LATENCY_MS = 5000;

/** Region groupings for geo proximity scoring */
const GEO_REGIONS: Record<string, string[]> = {
	'north-america': ['US', 'CA', 'MX'],
	europe: ['GB', 'DE', 'FR', 'NL', 'SE', 'NO', 'ES', 'IT', 'PL', 'CH', 'AT', 'BE', 'IE'],
	'asia-pacific': ['JP', 'KR', 'SG', 'AU', 'NZ', 'IN', 'TW', 'HK'],
	'south-america': ['BR', 'AR', 'CL', 'CO', 'PE'],
	africa: ['ZA', 'NG', 'KE', 'EG'],
	'middle-east': ['AE', 'SA', 'IL', 'QA']
};

/** Map country code to region */
function countryToRegion(country: string): string | null {
	for (const [region, countries] of Object.entries(GEO_REGIONS)) {
		if (countries.includes(country.toUpperCase())) return region;
	}
	return null;
}

export class ScoringEngine {
	private weights: ScoringWeights;

	constructor(weights: ScoringWeights = DEFAULT_WEIGHTS) {
		this.weights = weights;
	}

	/** Score a single endpoint against a resolution context */
	scoreEndpoint(
		endpoint: { url: string; protocol: string; capabilities?: string[] },
		context: ResolutionContext,
		healthData?: HealthProbeData,
		trustScore?: number
	): ResolvedEndpoint {
		const geo = this.geoScore(endpoint.url, context.requester_location);
		const trust = this.trustScoreNormalized(trustScore);
		const capability = this.capabilityMatchScore(
			endpoint.capabilities ?? [],
			context.required_capabilities
		);
		const health = this.healthScore(healthData);

		const composite =
			geo * this.weights.geo_proximity +
			trust * this.weights.trust_score +
			capability * this.weights.capability_match +
			health * this.weights.health;

		// Clamp to [0.0, 1.0]
		const score = Math.max(0, Math.min(1, composite));

		return {
			url: endpoint.url,
			protocol: endpoint.protocol,
			score,
			latency_estimate_ms: healthData?.p95_latency_ms ?? 0,
			trust_score: trustScore ?? 0,
			capabilities: endpoint.capabilities ?? [],
			connection_params: {},
			health_status: this.deriveHealthStatus(healthData)
		};
	}

	/** Rank multiple endpoints by composite score (descending) */
	rankEndpoints(endpoints: ResolvedEndpoint[]): ResolvedEndpoint[] {
		return [...endpoints].sort((a, b) => b.score - a.score);
	}

	/**
	 * Geographic proximity score (0.0–1.0).
	 * Same country = 1.0, same region = 0.7, different region = 0.3,
	 * no location data = 0.5 (neutral).
	 */
	private geoScore(endpointUrl: string, requesterLocation?: string): number {
		if (!requesterLocation) return 0.5;

		// Extract country from endpoint URL hostname TLD (heuristic)
		let endpointCountry: string | null = null;
		try {
			const hostname = new URL(endpointUrl).hostname;
			const tld = hostname.split('.').pop()?.toUpperCase();
			// Only use country-code TLDs (2-letter)
			if (tld && tld.length === 2 && tld !== 'IO' && tld !== 'AI') {
				endpointCountry = tld;
			}
		} catch {
			// Invalid URL — neutral score
		}

		if (!endpointCountry) return 0.5;

		const reqUpper = requesterLocation.toUpperCase();
		if (endpointCountry === reqUpper) return 1.0;

		const reqRegion = countryToRegion(reqUpper);
		const epRegion = countryToRegion(endpointCountry);
		if (reqRegion && epRegion && reqRegion === epRegion) return 0.7;

		return 0.3;
	}

	/** Trust score normalization (0.0–1.0) */
	private trustScoreNormalized(raw?: number): number {
		if (raw == null || raw < 0) return 0;
		return Math.min(1, raw);
	}

	/** Capability match score (0.0–1.0) — intersection / required */
	private capabilityMatchScore(available: string[], required?: string[]): number {
		if (!required || required.length === 0) return 1.0;
		const matched = required.filter((r) => available.includes(r));
		return matched.length / required.length;
	}

	/** Health score (0.0–1.0) from Observer probe data */
	private healthScore(data?: HealthProbeData): number {
		if (!data) return 0.5; // Unknown — neutral score

		// Weighted: 70% success rate, 30% latency score
		const latencyScore =
			data.p95_latency_ms <= 0 ? 1.0 : Math.max(0, 1 - data.p95_latency_ms / HIGH_LATENCY_MS);
		return 0.7 * data.success_rate + 0.3 * latencyScore;
	}

	/** Derive health status label from probe data */
	private deriveHealthStatus(data?: HealthProbeData): 'healthy' | 'degraded' | 'unknown' {
		if (!data) return 'unknown';
		if (data.success_rate >= 0.95 && data.p95_latency_ms < 2000) return 'healthy';
		if (data.success_rate >= 0.5) return 'degraded';
		return 'degraded';
	}
}
