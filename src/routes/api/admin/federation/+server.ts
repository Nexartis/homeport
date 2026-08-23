/**
 * GET  /api/admin/federation          — Federation v2 status + peer list
 * POST /api/admin/federation          — Register/remove peers, evaluate ZTAA
 *
 * Phase 6 — Agent Hawaii
 *
 * Admin endpoints for federation peer management and ZTAA policy evaluation.
 * Requires admin authentication (valid nanda_ API key or Sentinel admin role).
 
 * @swagger
 * /api/admin/federation:
 *   get:
 *     summary: Federation admin status
 *     description: Federation v2 status including peers, gossip stats, and ZTAA policy.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Federation admin status
 *   post:
 *     summary: Manage federation peers
 *     description: Register/remove peers or evaluate ZTAA policy.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Action result
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { PeerService } from '$lib/services/federation/peers';
import { QuiltService } from '$lib/services/federation/quilt';
import { GossipService } from '$lib/services/federation/gossip';
import { CRDTMergeEngine } from '$lib/services/federation/crdt';

import { importSigningKey } from '$lib/crypto/sign-agent';
import {
	syncAllExternalRegistries,
	syncExternalRegistry,
	getAllExternalRegistries,
	addExternalRegistry,
	removeExternalRegistry,
	previewExternalRegistry,
	registerAgentOnExternal
} from '$lib/services/external-registry/bridge';
import { agentAddrs } from '$lib/db/schema';
import { and, eq, or, isNull } from 'drizzle-orm';
import { evaluateZTAA, DEFAULT_ZTAA_POLICY } from '$lib/middleware/ztaa';
import type { ZTAAPolicy } from '$lib/types/safesearch';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { getActor, requireAdminRole } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-federation');

export const GET: RequestHandler = async ({ request, platform, locals }) => {
	const m2m = await requireFederationAdmin(request, platform);
	if (m2m !== null) {
		const actor = getActor(locals);
		requireAdminRole(actor, { log, fn: 'GET' });
	}

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const db = createDbClient(platform.env.DB);
	const peers = new PeerService(db);
	const quilt = new QuiltService(db);

	const [allPeers, summary, routes] = await Promise.all([
		peers.getAllPeers(),
		peers.getPeerSummary(),
		quilt.getAllRoutes()
	]);

	return json({
		node_id: platform.env.NANDA_NODE_ID ?? 'homeport-node',
		peers: allPeers,
		summary,
		quilt_routes: routes
	});
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const m2m = await requireFederationAdmin(request, platform);
	if (m2m !== null) {
		const actor = getActor(locals);
		requireAdminRole(actor, { log, fn: 'POST' });
	}

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let body: {
		action?: string;
		peer_id?: string;
		peer_url?: string;
		node_id?: string;
		capabilities?: string[];
		quilt_types?: string[];
		public_key_spki?: string;
		agent_id?: string;
		policy?: ZTAAPolicy;
		prefix?: string;
		quilt_type?: string;
		priority?: number;
		// External registry fields
		registryId?: string;
		name?: string;
		baseUrl?: string;
		adapterType?: string;
		syncIntervalMin?: number;
		config?: Record<string, unknown>;
		removeAgents?: boolean;
		// Outbound registration fields
		agent_url?: string;
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const db = createDbClient(platform.env.DB);

	switch (body.action) {
		case 'register-peer': {
			if (!body.peer_id || !body.peer_url || !body.node_id) {
				return json({ error: 'peer_id, peer_url, and node_id are required' }, { status: 400 });
			}
			const peers = new PeerService(db);
			const peer = await peers.registerPeer({
				peer_id: body.peer_id,
				peer_url: body.peer_url,
				node_id: body.node_id,
				capabilities: body.capabilities,
				quilt_types: body.quilt_types,
				public_key_spki: body.public_key_spki ?? null
			});
			return json({ ok: true, peer });
		}

		case 'remove-peer': {
			if (!body.peer_id) {
				return json({ error: 'peer_id is required' }, { status: 400 });
			}
			const peers = new PeerService(db);
			const removed = await peers.removePeer(body.peer_id);
			return json({ ok: removed, peer_id: body.peer_id });
		}

		case 'evaluate-ztaa': {
			if (!body.agent_id) {
				return json({ error: 'agent_id is required' }, { status: 400 });
			}
			const policy = body.policy ?? DEFAULT_ZTAA_POLICY;
			const result = await evaluateZTAA(db, body.agent_id, policy);
			return json(result);
		}

		case 'register-quilt-route': {
			if (!body.prefix || !body.quilt_type || !body.peer_id) {
				return json({ error: 'prefix, quilt_type, and peer_id are required' }, { status: 400 });
			}
			const quilt = new QuiltService(db);
			const route = await quilt.registerRoute({
				prefix: body.prefix,
				quilt_type: body.quilt_type as 'native' | 'gov' | 'enterprise' | 'web3',
				peer_id: body.peer_id,
				priority: body.priority ?? 0
			});
			return json({ ok: true, route });
		}

		case 'trigger-gossip': {
			const env = platform.env;
			const sigKey = await importSigningKey(env);
			const crdt = new CRDTMergeEngine(db, sigKey);
			const peers = new PeerService(db);
			const nodeId = env.NANDA_NODE_ID ?? 'homeport-node';
			const fedKey = await resolveSecret(
				env.NANDA_FEDERATION_ADMIN_KEY,
				kvFallback(env, SECRET_KEYS.FEDERATION_ADMIN_KEY)
			);
			const ed25519Key = await resolveSecret(
				env.KYM_NANDA_ED25519_PRIVATE_KEY_v1,
				kvFallback(env, SECRET_KEYS.ED25519_PRIVATE_KEY_V1)
			);
			const gossip = new GossipService(
				db,
				crdt,
				peers,
				nodeId,
				fedKey ?? undefined,
				ed25519Key ?? undefined
			);
			const results = await gossip.pushToAllPeers();
			const summary: Record<string, unknown> = {};
			results.forEach((v, k) => {
				summary[k] = v;
			});
			log.info('POST', 'Manual gossip push triggered', { peers: results.size });
			return json({ ok: true, action: 'trigger-gossip', results: summary });
		}

		case 'add-external-registry': {
			if (!body.registryId || !body.name || !body.baseUrl || !body.adapterType) {
				return json(
					{ error: 'registryId, name, baseUrl, and adapterType are required' },
					{ status: 400 }
				);
			}
			await addExternalRegistry(db, {
				id: body.registryId,
				name: body.name,
				baseUrl: body.baseUrl,
				adapterType: body.adapterType,
				syncIntervalMin: body.syncIntervalMin,
				config: body.config
			});
			log.info('POST', `Added external registry: ${body.name} (${body.adapterType})`);
			return json({ ok: true, action: 'add-external-registry', registryId: body.registryId });
		}

		case 'remove-external-registry': {
			if (!body.registryId) {
				return json({ error: 'registryId is required' }, { status: 400 });
			}
			const result = await removeExternalRegistry(db, body.registryId, body.removeAgents ?? false);
			log.info('POST', `Removed external registry: ${body.registryId}`);
			return json({ ok: true, action: 'remove-external-registry', ...result });
		}

		case 'list-external-registries': {
			const registries = await getAllExternalRegistries(db);
			return json({ ok: true, registries });
		}

		case 'sync-external-registries': {
			if (body.registryId) {
				// Sync a specific registry
				const registries = await getAllExternalRegistries(db);
				const target = registries.find((r) => r.id === body.registryId);
				if (!target) {
					return json({ error: `Registry ${body.registryId} not found` }, { status: 404 });
				}
				const sigKey = await importSigningKey(platform.env);
				const result = await syncExternalRegistry(db, target, sigKey);
				return json({ ok: true, action: 'sync-external-registries', results: [result] });
			}
			// Sync all enabled registries
			const sigKey = await importSigningKey(platform.env);
			const results = await syncAllExternalRegistries(db, sigKey);
			return json({ ok: true, action: 'sync-external-registries', results });
		}

		case 'preview-external-registry': {
			if (!body.registryId) {
				return json({ error: 'registryId is required' }, { status: 400 });
			}
			const registries = await getAllExternalRegistries(db);
			const target = registries.find((r) => r.id === body.registryId);
			if (!target) {
				return json({ error: `Registry ${body.registryId} not found` }, { status: 404 });
			}
			try {
				const preview = await previewExternalRegistry(target);
				return json({ ok: true, action: 'preview-external-registry', ...preview });
			} catch (err) {
				return json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
			}
		}

		case 'register-agent-on-external': {
			if (!body.registryId || !body.agent_id) {
				return json({ error: 'registryId and agent_id are required' }, { status: 400 });
			}
			const registries = await getAllExternalRegistries(db);
			const target = registries.find((r) => r.id === body.registryId);
			if (!target) {
				return json({ error: `Registry ${body.registryId} not found` }, { status: 404 });
			}
			// Look up the local agent to get its URL
			const localAgent = await db.query.agentAddrs.findFirst({
				where: and(
					eq(agentAddrs.agentId, body.agent_id),
					or(isNull(agentAddrs.source), eq(agentAddrs.source, 'local'))
				)
			});
			// Tenant-agnostic lookup base URL. Prefer explicit override
			// (NANDA_LOOKUP_BASE_URL), fall back to this node's own registry URL
			// (NANDA_REGISTRY_URL / VITE_BASE_URL). No hardcoded Nexartis
			// fallback — a tenant node must never emit `nanda.nexartis.com`
			// self-references into federation registrations.
			// `||` (not `??`) so empty-string env values fall through to the
			// next candidate (matches hooks.server.ts buildCorsHeaders).
			const lookupBaseRaw =
				platform.env.NANDA_LOOKUP_BASE_URL ||
				platform.env.NANDA_REGISTRY_URL ||
				platform.env.VITE_BASE_URL;
			if (!body.agent_url && !localAgent?.agentUrl && !lookupBaseRaw) {
				return json(
					{
						error:
							'Cannot construct agent_url: no NANDA_LOOKUP_BASE_URL / NANDA_REGISTRY_URL / VITE_BASE_URL configured on this node'
					},
					{ status: 500 }
				);
			}
			const lookupBase = lookupBaseRaw ? lookupBaseRaw.replace(/\/+$/, '') : '';
			const fallbackLookupUrl = lookupBase ? `${lookupBase}/lookup/${body.agent_id}` : undefined;
			const agentUrl =
				body.agent_url ??
				(localAgent ? (localAgent.agentUrl ?? fallbackLookupUrl) : fallbackLookupUrl);
			if (!agentUrl) {
				return json(
					{ error: 'Cannot construct agent_url for federated registration' },
					{ status: 500 }
				);
			}
			const result = await registerAgentOnExternal(target, {
				agent_id: body.agent_id,
				agent_url: agentUrl,
				api_url: agentUrl
			});
			log.info('POST', `Register agent ${body.agent_id} on ${target.name}: ${result.success}`);
			return json({ ok: result.success, action: 'register-agent-on-external', ...result });
		}

		case 'list-local-agents': {
			// Filter to local-only agents at the DB level
			const own = await db
				.select()
				.from(agentAddrs)
				.where(or(isNull(agentAddrs.source), eq(agentAddrs.source, 'local')));
			return json({
				ok: true,
				agents: own.map((a) => ({
					agent_id: a.agentId,
					agent_url: a.agentUrl,
					status: a.status,
					capabilities: a.capabilities,
					tags: a.tags,
					created_at: a.registeredAt
				}))
			});
		}

		default:
			return json(
				{
					error: `Unknown action: ${body.action}. Supported: register-peer, remove-peer, evaluate-ztaa, register-quilt-route, trigger-gossip, add-external-registry, remove-external-registry, list-external-registries, sync-external-registries, preview-external-registry, register-agent-on-external, list-local-agents`
				},
				{ status: 400 }
			);
	}
};
