/**
 * GET /.well-known/nanda-index — NANDA Index Metadata endpoint
 * Phase 6 — Agent Bali
 *
 * Returns node identity, supported protocols, quilt types, and AGNTCY
 * interop flags per the MIT NANDA Index spec (arXiv:2507.14263).
 *
 * @swagger
 * /.well-known/nanda-index:
 *   get:
 *     summary: NANDA Index metadata
 *     description: Node identity, supported protocols, quilt types, and AGNTCY interop flags.
 *     tags:
 *       - Discovery
 *     responses:
 *       200:
 *         description: NANDA Index metadata
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { countAgentAddrs } from '$lib/db/repositories/agent-addrs';

export interface NandaIndexMetadata {
	node_id: string;
	version: string;
	supported_protocols: string[];
	quilt_types: string[];
	agent_count: number;
	agntcy_interop: boolean;
	oasf_compatible: boolean;
	signing_algorithm: string;
	resolution_endpoint: string;
	well_known_keys_endpoint: string;
	privacy_endpoint?: string;
}

export const GET: RequestHandler = async ({ platform }) => {
	const env = platform!.env;
	const db = createDbClient(env.DB);
	const baseUrl = env.NANDA_REGISTRY_URL;

	let agentCount = 0;
	try {
		agentCount = await countAgentAddrs(db);
	} catch {
		// Table may not exist yet during migration — gracefully degrade
	}

	const metadata: NandaIndexMetadata = {
		node_id: env.NANDA_NODE_ID ?? 'homeport-node',
		version: '2.0.0',
		supported_protocols: ['a2a', 'mcp', 'ucp', 'nlweb', 'https'],
		quilt_types: ['native', 'gov', 'enterprise', 'web3'],
		agent_count: agentCount,
		agntcy_interop: true,
		oasf_compatible: true,
		signing_algorithm: 'Ed25519',
		resolution_endpoint: `${baseUrl}/resolve`,
		well_known_keys_endpoint: `${baseUrl}/.well-known/keys`,
		privacy_endpoint: `${baseUrl}/.well-known/nanda-index/privacy`
	};

	return json(metadata, {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'X-NANDA-Node': env.NANDA_NODE_ID ?? 'homeport-node',
			'X-NANDA-Index-Version': '2.0.0'
		}
	});
};
