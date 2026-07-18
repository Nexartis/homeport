/**
 * Federation Admin — Page Data Loader
 *
 * Loads federation peers, gossip stats, quilt routes, and node identity
 * for the admin federation dashboard.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { PeerService } from '$lib/services/federation/peers';
import { GossipService } from '$lib/services/federation/gossip';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';
import { QuiltService } from '$lib/services/federation/quilt';
import { importSigningKey } from '$lib/crypto/sign-agent';
import { getAllExternalRegistries } from '$lib/services/external-registry/bridge';
import { agentAddrs } from '$lib/db/schema';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-federation');

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) {
		return {
			nodeId: 'unknown',
			registryUrl: null,
			configuredPeerUrl: null,
			peers: [],
			peerSummary: { active: 0, degraded: 0, offline: 0, total: 0 },
			gossipStats: { total_exchanges: 0, inbound: 0, outbound: 0 },
			quiltRoutes: [],
			externalRegistries: [],
			localAgents: []
		};
	}

	const env = platform.env;
	const db = createDbClient(d1);

	try {
		const signingKey = await importSigningKey(env);
		const peerService = new PeerService(db);
		const crdt = new CRDTMergeEngine(db, signingKey);
		const nodeId = env.NANDA_NODE_ID ?? 'unknown';
		const gossip = new GossipService(db, crdt, peerService, nodeId);
		const quilt = new QuiltService(db);

		const [allPeers, peerSummary, gossipStats, quiltRoutes, extRegistries, allAgents] =
			await Promise.all([
				peerService.getAllPeers(),
				peerService.getPeerSummary(),
				gossip.getStats(),
				quilt.getAllRoutes(),
				getAllExternalRegistries(db).catch(() => []),
				db
					.select()
					.from(agentAddrs)
					.all()
					.catch(() => [])
			]);

		// Filter to local-only agents — use the `source` column set by the bridge
		const localAgents = allAgents
			.filter((a) => !a.source || a.source === 'local')
			.map((a) => ({
				agent_id: a.agentId,
				agent_url: a.agentUrl,
				status: a.status,
				capabilities: a.capabilities,
				tags: a.tags
			}));

		return {
			nodeId,
			registryUrl: env.NANDA_REGISTRY_URL ?? null,
			configuredPeerUrl: env.NANDA_FEDERATION_PEER_URL ?? null,
			peers: allPeers,
			peerSummary,
			gossipStats,
			quiltRoutes,
			externalRegistries: extRegistries,
			localAgents
		};
	} catch (error) {
		log.error('load', 'Failed to load federation data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return {
			nodeId: env.NANDA_NODE_ID ?? 'unknown',
			registryUrl: env.NANDA_REGISTRY_URL ?? null,
			configuredPeerUrl: env.NANDA_FEDERATION_PEER_URL ?? null,
			peers: [],
			peerSummary: { active: 0, degraded: 0, offline: 0, total: 0 },
			gossipStats: { total_exchanges: 0, inbound: 0, outbound: 0 },
			quiltRoutes: [],
			externalRegistries: [],
			localAgents: []
		};
	}
};
