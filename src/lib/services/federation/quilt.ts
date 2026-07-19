/**
 * Quilt Address Parser & Router — Federation v2
 *
 * Parses agent IDs to detect quilt type, routes lookups to the
 * correct federation peer based on prefix routing table.
 *
 * Quilt Types (from switchboard_routes.py):
 *   native   — Standard agent IDs (no prefix)
 *   gov      — @US:, @EU:, @UK:, etc.  (government jurisdiction)
 *   enterprise — @company:  (enterprise / Cisco-style)
 *   web3     — @DID:, @ENS:  (decentralized identifiers)
 *
 * Special: @agntcy: prefix — always routes to AGNTCY Directory peer.
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase D — Quilt Routing
 * @see nanda-repos/nanda-index/switchboard/switchboard_routes.py
 */

import { eq, asc } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { quiltRoutes } from '$lib/db/schema';
import type { QuiltType, QuiltRoute } from '$lib/types/federation-v2';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'quilt');

/** Known prefix → quilt type mapping */
const PREFIX_MAP: ReadonlyMap<string, QuiltType> = new Map([
	['@US:', 'gov'],
	['@EU:', 'gov'],
	['@UK:', 'gov'],
	['@JP:', 'gov'],
	['@AU:', 'gov'],
	['@CA:', 'gov'],
	['@DID:', 'web3'],
	['@ENS:', 'web3'],
	['@agntcy:', 'enterprise'],
	['@company:', 'enterprise']
]);

/** Regex to extract @prefix: from agent IDs */
const PREFIX_RE = /^(@[a-zA-Z0-9]+:)/;

export class QuiltService {
	constructor(private db: DbClient) {}

	/**
	 * Parse an agent ID and return its quilt type and prefix.
	 * Pure function — no DB access.
	 */
	parseAgentId(agentId: string): { quiltType: QuiltType; prefix: string | null } {
		const match = agentId.match(PREFIX_RE);
		if (!match) return { quiltType: 'native', prefix: null };

		const prefix = match[1];
		const type = PREFIX_MAP.get(prefix);

		if (type) return { quiltType: type, prefix };

		// Unknown prefix — treat as enterprise quilt
		log.info('parseAgentId', `Unknown prefix: ${prefix}, defaulting to enterprise`, {
			agentId,
			prefix
		});
		return { quiltType: 'enterprise', prefix };
	}

	/**
	 * Route an agent lookup to the correct peer(s) based on prefix.
	 * Returns matching quilt routes sorted by priority (ascending).
	 */
	async routeLookup(agentId: string): Promise<QuiltRoute[]> {
		const { prefix, quiltType: _quiltType } = this.parseAgentId(agentId);

		if (!prefix) return []; // Native quilt — resolve locally

		const routes = await this.db
			.select()
			.from(quiltRoutes)
			.where(eq(quiltRoutes.prefix, prefix))
			.orderBy(asc(quiltRoutes.priority));

		return routes.map((r) => ({
			id: r.id,
			prefix: r.prefix,
			quilt_type: r.quiltType as QuiltType,
			peer_id: r.peerId,
			priority: r.priority ?? 0,
			created_at: r.createdAt ?? undefined
		}));
	}

	/**
	 * Register a quilt route for a prefix → peer mapping.
	 */
	async registerRoute(route: Omit<QuiltRoute, 'id' | 'created_at'>): Promise<QuiltRoute> {
		const id = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		await this.db.insert(quiltRoutes).values({
			id,
			prefix: route.prefix,
			quiltType: route.quilt_type,
			peerId: route.peer_id,
			priority: route.priority
		});
		return { ...route, id };
	}

	/**
	 * Get all registered quilt routes (for status/admin).
	 */
	async getAllRoutes(): Promise<QuiltRoute[]> {
		const rows = await this.db.select().from(quiltRoutes).orderBy(asc(quiltRoutes.priority));
		return rows.map((r) => ({
			id: r.id,
			prefix: r.prefix,
			quilt_type: r.quiltType as QuiltType,
			peer_id: r.peerId,
			priority: r.priority ?? 0,
			created_at: r.createdAt ?? undefined
		}));
	}

	/**
	 * Detect if an agent ID belongs to the AGNTCY Directory.
	 * @agntcy: prefix always routes to the AGNTCY peer for
	 * compatibility with Cisco/AGNTCY directory standards.
	 *
	 * @see COMPATIBILITY_AUDIT.md — @agntcy: prefix
	 */
	isAgntcyAgent(agentId: string): boolean {
		return agentId.startsWith('@agntcy:');
	}

	/**
	 * Strip the quilt prefix from an agent ID to get the bare name.
	 * Useful for looking up agents by name after routing to the correct peer.
	 */
	stripPrefix(agentId: string): string {
		const match = agentId.match(PREFIX_RE);
		return match ? agentId.slice(match[1].length) : agentId;
	}
}
