/**
 * Federation Service — federated agent queries and cross-registry trust.
 *
 * All agent data (local + federated) lives in agent_addrs.
 * Federation happens via CRDT gossip (federation/ module).
 * This file provides query helpers for federated agents and cross-registry trust.
 */
import { and, ne, sql, desc } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import { createLogger } from '../utils/logger';

const log = createLogger(undefined, 'federation');

// ---------------------------------------------------------------------------
// SSRF Protection — validate peer URLs before fetching (P2-FF2)
// ---------------------------------------------------------------------------

/** RFC 1918 / loopback / link-local patterns */
const PRIVATE_IP_PATTERNS = [
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2[0-9]|3[01])\./,
	/^192\.168\./,
	/^0\./,
	/^169\.254\./,
	/^::1$/,
	/^fc00:/i,
	/^fd[0-9a-f]{2}:/i,
	/^fe80:/i
];

/**
 * Validate a peer URL for SSRF safety.
 * - Must be a valid URL
 * - Must use HTTPS in production (HTTP allowed in dev/test for local registries)
 * - Hostname must not resolve to a private/loopback IP
 */
export function validatePeerUrl(peerUrl: string, env?: string): void {
	let parsed: URL;
	try {
		parsed = new URL(peerUrl);
	} catch {
		throw new Error(`Invalid peer URL: ${peerUrl}`);
	}

	// Enforce HTTPS in production
	if (env === 'production' && parsed.protocol !== 'https:') {
		throw new Error(`SSRF: peer URL must use HTTPS in production: ${peerUrl}`);
	}

	// Block private IPs in hostname (covers bare-IP URLs like http://192.168.1.1)
	const hostname = parsed.hostname;
	if (hostname === 'localhost' || PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) {
		throw new Error(`SSRF: peer URL resolves to a private/loopback address: ${hostname}`);
	}
}

/**
 * Get all federated (non-local) agents from agent_addrs.
 */
export async function getFederatedAgents(db: DbClient): Promise<Array<Record<string, unknown>>> {
	const rows = await db
		.select()
		.from(agentAddrs)
		.where(and(sql`${agentAddrs.source} IS NOT NULL`, ne(agentAddrs.source, 'local')))
		.orderBy(desc(agentAddrs.updatedAt));
	return rows as unknown as Array<Record<string, unknown>>;
}

/**
 * Get federation sync status — last sync time per peer.
 * Queries agent_addrs (H3 — CRDT writes to agent_addrs).
 */
export async function getFederationStatus(
	db: DbClient
): Promise<Array<{ source: string; count: number; lastUpdated: string | null }>> {
	const rows = await db
		.select({
			source: agentAddrs.source,
			cnt: sql<number>`COUNT(*)`,
			lastUpdated: sql<number | null>`MAX(${agentAddrs.updatedAt})`
		})
		.from(agentAddrs)
		.where(and(sql`${agentAddrs.source} IS NOT NULL`, ne(agentAddrs.source, 'local')))
		.groupBy(agentAddrs.source);

	return rows.map((r) => ({
		source: r.source ?? '',
		count: r.cnt,
		lastUpdated: r.lastUpdated ? new Date(r.lastUpdated * 1000).toISOString() : null
	}));
}

// ---------------------------------------------------------------------------
// Cross-Registry Trust Sync (Phase 3 — Agent Alpha)
// ---------------------------------------------------------------------------

/**
 * Sync trust scores from the configured federation peer and compute
 * aggregated cross-registry scores. Orchestrates fetch + aggregate in one call.
 *
 * @param db          - Drizzle D1 client
 * @param peerUrl     - Peer registry base URL
 * @param environment - Current env name (for SSRF validation)
 * @param env         - Full Env for weight config (TRUST_LOCAL_WEIGHT)
 */
export async function syncCrossRegistryTrust(
	db: DbClient,
	peerUrl: string,
	environment?: string,
	env?: import('$lib/types').Env
): Promise<{
	fetch: import('./trust/cross-registry').PeerFetchResult;
	compute: { computed: number; errors: number };
}> {
	const { fetchPeerTrustScores, computeCrossRegistryScores } =
		await import('./trust/cross-registry');

	const fetchResult = await fetchPeerTrustScores(db, peerUrl, environment);
	const computeResult = await computeCrossRegistryScores(db, env);

	log.info(
		'syncCrossRegistryTrust',
		`Fetched ${fetchResult.agents} scores, computed ${computeResult.computed} cross-registry`,
		{
			peerUrl,
			fetchErrors: fetchResult.errors,
			computeErrors: computeResult.errors
		}
	);

	return { fetch: fetchResult, compute: computeResult };
}

// ---------------------------------------------------------------------------
// Federation v2 Status Extensions (Phase 6 — Agent Hawaii)
// ---------------------------------------------------------------------------

import { PeerService } from './federation/peers';
import { GossipService } from './federation/gossip';
import { CRDTMergeEngine } from './federation/crdt';
import { QuiltService } from './federation/quilt';

/**
 * Get extended federation v2 status — includes peers, gossip stats,
 * quilt routes, and vector clock information.
 */
export async function getFederationV2Status(
	db: DbClient,
	env?: Record<string, unknown>,
	signingKey?: CryptoKey
) {
	const peerService = new PeerService(db);
	// signingKey required for CRDTMergeEngine — must be resolved by caller
	if (!signingKey) throw new Error('Ed25519 signing key required for federation status');
	const crdt = new CRDTMergeEngine(db, signingKey);
	const nodeId = env?.NANDA_NODE_ID as string;
	if (!nodeId) {
		throw new Error('NANDA_NODE_ID must be configured in wrangler.jsonc');
	}
	const gossip = new GossipService(db, crdt, peerService, nodeId);
	const quilt = new QuiltService(db);

	const [peerSummary, gossipStats, quiltRoutes, allPeers] = await Promise.all([
		peerService.getPeerSummary(),
		gossip.getStats(),
		quilt.getAllRoutes(),
		peerService.getAllPeers()
	]);

	return {
		version: 2,
		node_id: nodeId,
		peers: peerSummary,
		gossip: gossipStats,
		quilt_routes: quiltRoutes,
		peer_list: allPeers
	};
}
