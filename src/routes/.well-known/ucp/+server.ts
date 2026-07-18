/**
 * UCP Well-Known Manifest Endpoint
 * GET /.well-known/ucp
 *
 * Returns the UCP manifest describing this node's capabilities, payment methods,
 * and supported protocols per UCP spec v2026-01-11.
 *
 * @see https://github.com/Universal-Commerce-Protocol/ucp
 *
 * @swagger
 * /.well-known/ucp:
 *   get:
 *     summary: UCP manifest
 *     description: Universal Checkout Protocol manifest with capabilities, payment methods, and supported protocols.
 *     tags:
 *       - Discovery
 *     responses:
 *       200:
 *         description: UCP manifest
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { UcpManifest } from '$lib/types/ucp';
import { getCapabilities } from '$lib/ucp/schemas';

export const GET: RequestHandler = async ({ platform }) => {
	const env = platform!.env;
	const baseUrl = env.NANDA_REGISTRY_URL;

	const manifest: UcpManifest = {
		name: 'Homeport',
		description: 'Agent registry, certification, and compliance infrastructure',
		url: baseUrl,
		version: '1.0.0',
		spec_version: '2026-01-11',
		capabilities: getCapabilities(),
		payment_methods: [
			{
				type: 'x402-np',
				description: 'Nanda Points via x402-NP protocol'
			}
		],
		protocols: ['a2a', 'mcp', 'ucp'],
		extensions: []
	};

	return json(manifest, {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'X-UCP-Spec-Version': '2026-01-11'
		}
	});
};
