/**
 * SafeSearch Service — Agentic SafeSearch for Trust-Filtered Discovery
 *
 * Provides trust-aware agent search that filters by:
 *  - Minimum trust/reputation score
 *  - Required certifications
 *  - Content flag exclusions
 *  - Jurisdiction constraints
 *  - New-agent (NSA) flagging (< 30 days since registration)
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase F
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentAddrs, agentFacts, crossRegistryScores } from '$lib/db/schema';
import type { SafeSearchQuery, SafeSearchResult } from '$lib/types/safesearch';
import { createLogger } from '$lib/utils/logger';

const _log = createLogger(undefined, 'safesearch');

/** Default new-agent threshold in days */
const NEW_AGENT_DAYS = 30;

export class SafeSearchService {
	constructor(private db: DbClient) {}

	/**
	 * Execute a SafeSearch query — trust-filtered agent discovery.
	 *
	 * The search pipeline:
	 * 1. Start with all alive agents
	 * 2. Join agentFacts for cert_level, jurisdiction
	 * 3. Join reputation/cross-registry for trust score
	 * 4. Apply SafeSearch filters (cert, trust, jurisdiction, age)
	 * 5. Flag new agents (registered < 30 days)
	 * 6. Return enriched results with trust metadata
	 */
	async search(query: SafeSearchQuery): Promise<SafeSearchResult> {
		const filtersApplied: string[] = [];
		const now = Math.floor(Date.now() / 1000);
		const newAgentCutoff = now - NEW_AGENT_DAYS * 86400;

		// Base query: alive agents with optional facts + reputation
		const rows = await this.db
			.select({
				agentId: agentAddrs.agentId,
				agentUrl: agentAddrs.agentUrl,
				capabilities: agentAddrs.capabilities,
				tags: agentAddrs.tags,
				status: agentAddrs.status,
				registeredAt: agentAddrs.registeredAt,
				// From agentFacts
				agentName: agentFacts.agentName,
				certLevel: agentFacts.certLevel,
				jurisdiction: agentFacts.jurisdiction,
				factsJson: agentFacts.factsJson,
				// From crossRegistryScores (if available)
				combinedReputation: crossRegistryScores.combinedReputation
			})
			.from(agentAddrs)
			.leftJoin(agentFacts, eq(agentAddrs.agentId, agentFacts.agentId))
			.leftJoin(crossRegistryScores, eq(agentAddrs.agentId, crossRegistryScores.agentId))
			.where(eq(agentAddrs.status, 'alive'));

		// Apply SafeSearch filters in-memory (D1 doesn't support complex JOINs well)
		let filtered = rows;

		// Capability filter
		if (query.capability) {
			filtersApplied.push(`capability:${query.capability}`);
			filtered = filtered.filter((r) => {
				if (!r.capabilities) return false;
				try {
					const caps = JSON.parse(r.capabilities) as string[];
					return caps.some((c) => c.toLowerCase().includes(query.capability!.toLowerCase()));
				} catch {
					return false;
				}
			});
		}

		// Min trust score filter
		if (query.min_trust !== undefined) {
			filtersApplied.push(`min_trust:${query.min_trust}`);
			filtered = filtered.filter((r) => (r.combinedReputation ?? 0) >= query.min_trust!);
		}

		// Jurisdiction filter
		if (query.jurisdiction) {
			filtersApplied.push(`jurisdiction:${query.jurisdiction}`);
			filtered = filtered.filter(
				(r) => r.jurisdiction?.toLowerCase() === query.jurisdiction!.toLowerCase()
			);
		}

		// Required certifications filter
		if (query.requires_cert?.length) {
			filtersApplied.push(`requires_cert:${query.requires_cert.join(',')}`);
			filtered = filtered.filter((r) => {
				if (!r.certLevel) return false;
				return query.requires_cert!.some(
					(cert) => r.certLevel!.toLowerCase() === cert.toLowerCase()
				);
			});
		}

		// Exclude flags filter (from factsJson)
		if (query.exclude_flags?.length) {
			filtersApplied.push(`exclude_flags:${query.exclude_flags.join(',')}`);
			filtered = filtered.filter((r) => {
				const flags = this.extractContentFlags(r.factsJson);
				return !query.exclude_flags!.some((f) => flags.includes(f.toLowerCase()));
			});
		}

		// Max age filter (NSA: exclude agents newer than N days)
		if (query.max_age_days !== undefined) {
			filtersApplied.push(`max_age_days:${query.max_age_days}`);
			const ageCutoff = now - query.max_age_days * 86400;
			filtered = filtered.filter((r) => (r.registeredAt ?? 0) <= ageCutoff);
		}

		// Build SafeSearch results
		const results: SafeSearchResult['agents'] = filtered.map((r) => ({
			agent_id: r.agentId,
			agent_name: r.agentName ?? r.agentId,
			trust_score: r.combinedReputation ?? 0,
			certifications: r.certLevel ? [r.certLevel] : [],
			content_flags: this.extractContentFlags(r.factsJson),
			is_new_agent: (r.registeredAt ?? 0) > newAgentCutoff,
			protocol: this.extractProtocol(r.factsJson)
		}));

		return {
			agents: results,
			total: results.length,
			filters_applied: filtersApplied
		};
	}

	/** Extract content_flags from factsJson (if present) */
	private extractContentFlags(factsJson: string | null): string[] {
		if (!factsJson) return [];
		try {
			const facts = JSON.parse(factsJson);
			const flags = facts.content_flags ?? facts.flags ?? [];
			return Array.isArray(flags) ? flags.map((f: string) => f.toLowerCase()) : [];
		} catch {
			return [];
		}
	}

	/** Extract protocol from factsJson (if present) */
	private extractProtocol(factsJson: string | null): string | undefined {
		if (!factsJson) return undefined;
		try {
			const facts = JSON.parse(factsJson);
			return facts.protocol ?? facts.communication_protocol ?? undefined;
		} catch {
			return undefined;
		}
	}
}
