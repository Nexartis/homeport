/**
 * GET /search — Search for agents by query, capabilities, tags, or SafeSearch filters
 *
 * @swagger
 * /search:
 *   get:
 *     summary: Search for agents
 *     description: Full-text search with optional capability, tag, trust, jurisdiction, and protocol filters. Supports SafeSearch mode.
 *     tags:
 *       - Registry
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Free-text search query
 *       - in: query
 *         name: capabilities
 *         schema:
 *           type: string
 *         description: Comma-separated capability filter
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tag filter
 *       - in: query
 *         name: min_trust
 *         schema:
 *           type: number
 *         description: Minimum trust score (SafeSearch)
 *       - in: query
 *         name: jurisdiction
 *         schema:
 *           type: string
 *         description: Jurisdiction filter (SafeSearch)
 *       - in: query
 *         name: protocol
 *         schema:
 *           type: string
 *         description: Protocol filter (a2a, mcp, nlweb)
 *     responses:
 *       200:
 *         description: Array of matching agents
 *       400:
 *         description: Invalid filter parameter
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchAgents } from '$lib/services/registry';
import { SafeSearchService } from '$lib/services/safesearch';
import { createDbClient } from '$lib/db/client';
import type { SafeSearchQuery } from '$lib/types/safesearch';
import { protocolAdapters } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = createDbClient(platform!.env.DB);
	const q = url.searchParams.get('q') ?? undefined;
	const caps = url.searchParams.get('capabilities')?.split(',').filter(Boolean);
	const tags = url.searchParams.get('tags')?.split(',').filter(Boolean);

	// SafeSearch mode: if any safesearch param is present, use SafeSearchService
	const minTrust = url.searchParams.get('min_trust');
	const jurisdiction = url.searchParams.get('jurisdiction');
	const requiresCert = url.searchParams.get('requires_cert')?.split(',').filter(Boolean);
	const excludeFlags = url.searchParams.get('exclude_flags')?.split(',').filter(Boolean);
	const maxAgeDays = url.searchParams.get('max_age_days');
	const protocol = url.searchParams.get('protocol');

	const hasSafeSearch =
		minTrust ||
		jurisdiction ||
		requiresCert?.length ||
		excludeFlags?.length ||
		maxAgeDays ||
		protocol;

	if (hasSafeSearch) {
		const safeSearch = new SafeSearchService(db);
		const parsedMinTrust = minTrust ? parseFloat(minTrust) : undefined;
		const parsedMaxAge = maxAgeDays ? parseInt(maxAgeDays, 10) : undefined;

		if (parsedMinTrust !== undefined && !Number.isFinite(parsedMinTrust)) {
			return json({ error: 'min_trust must be a valid number' }, { status: 400 });
		}
		if (parsedMaxAge !== undefined && !Number.isFinite(parsedMaxAge)) {
			return json({ error: 'max_age_days must be a valid integer' }, { status: 400 });
		}

		const query: SafeSearchQuery = {
			capability: caps?.[0] ?? q,
			min_trust: parsedMinTrust,
			jurisdiction: jurisdiction ?? undefined,
			requires_cert: requiresCert,
			exclude_flags: excludeFlags,
			max_age_days: parsedMaxAge,
			protocol: protocol ?? undefined
		};
		const result = await safeSearch.search(query);
		return json(result);
	}

	// Standard search (backward compatible) — enriched with protocol data (Phase 6)
	const results = await searchAgents(db, q, caps, tags);

	// Enrich results with detected protocols from protocol_adapters table
	const enriched = await Promise.all(
		results.map(async (agent) => {
			const agentId = (agent as { agent_id?: string }).agent_id;
			if (!agentId) return agent;
			try {
				const adapters = await db
					.select({ protocol: protocolAdapters.protocol })
					.from(protocolAdapters)
					.where(eq(protocolAdapters.agentId, agentId));
				return {
					...agent,
					protocols: adapters.map((a) => a.protocol)
				};
			} catch {
				return { ...agent, protocols: [] };
			}
		})
	);

	return json(enriched);
};
