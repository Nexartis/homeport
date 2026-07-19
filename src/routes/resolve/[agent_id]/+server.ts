/**
 * GET /resolve/:agent_id — Lean Index AgentAddr resolution
 * Phase 6 — Agent Bali
 *
 * Returns the signed AgentAddr record for a given agent_id.
 * Uses KV cache with D1 fallback.
 *
 * @swagger
 * /resolve/{agent_id}:
 *   get:
 *     summary: Resolve agent via Lean Index
 *     description: Returns signed AgentAddr record with endpoint URL, trust score, and Ed25519 signature.
 *     tags:
 *       - Resolution
 *     parameters:
 *       - in: path
 *         name: agent_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signed AgentAddr
 *       404:
 *         description: Agent not indexed
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { LeanIndexService } from '$lib/services/lean-index';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform!.env;
	const db = createDbClient(env.DB);
	const agentId = decodeURIComponent(params.agent_id);

	// Import signing key — best-effort for read-only resolution.
	// If the key is unavailable, we still resolve from D1/KV (signing is only needed for writes).
	let signingKey: CryptoKey | undefined;
	try {
		const privateKeyBase64 = await resolveSecret(
			env.KYM_NANDA_ED25519_PRIVATE_KEY_v1,
			kvFallback(env, SECRET_KEYS.ED25519_PRIVATE_KEY_V1)
		);
		if (privateKeyBase64) {
			const der = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));
			signingKey = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign']);
		}
	} catch {
		// Non-fatal for read-only resolution — continue without signing key
	}

	// Create service — signing key is optional for read-only resolve operations
	const service = new LeanIndexService(db, env.NANDA_NODE_CACHE, signingKey ?? undefined);
	const resolution = await service.resolve(agentId);

	if (!resolution) {
		// Check if the agent existed but is expired/revoked
		const { getAgentAddr } = await import('$lib/db/repositories');
		const record = await getAgentAddr(db, agentId);
		if (record && record.expiresAt && record.expiresAt < Math.floor(Date.now() / 1000)) {
			return json({ error: 'Agent revoked or expired' }, { status: 410 });
		}
		return json({ error: 'Agent not found' }, { status: 404 });
	}

	return json(resolution.agent_addr, {
		headers: {
			'Cache-Control': `public, max-age=${resolution.agent_addr.ttl_seconds}`,
			'X-NANDA-Node': 'nexartis',
			'X-NANDA-Cached': resolution.cached ? 'true' : 'false'
		}
	});
};
