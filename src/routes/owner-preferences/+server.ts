/**
 * @swagger
 * /owner-preferences:
 *   get:
 *     summary: Signed owner-preferences approval policy
 *     description: |
 *       Returns the operator's approval policy wrapped in an Ed25519 signature
 *       (NND-D2). Consumed by Remote-Control clients (G8) at connect. Clients
 *       verify the signature against `/.well-known/keys/ed25519-v{n}` and
 *       apply the policy per §7 of the RC client ARCHITECTURE. TTL 60 s.
 *     tags:
 *       - Discovery
 *     responses:
 *       200:
 *         description: Signed owner-preferences envelope
 *       503:
 *         description: Node signing key not configured
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OWNER_PREFERENCES_TTL_SECONDS, signOwnerPreferences } from '$lib/server/owner-preferences';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'owner-preferences');

export const GET: RequestHandler = async ({ platform }) => {
	const env = platform?.env;
	if (!env) {
		return json({ error: 'Runtime env unavailable' }, { status: 503 });
	}
	try {
		const signed = await signOwnerPreferences(env);
		return json(signed, {
			status: 200,
			headers: {
				// Cache mirrors the signed TTL so shared caches drop the envelope
				// before its `expiresAt` field. `must-revalidate` prevents stale reuse.
				'Cache-Control': `public, max-age=${OWNER_PREFERENCES_TTL_SECONDS}, must-revalidate`,
				'Content-Type': 'application/json; charset=utf-8'
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('GET', 'Failed to build signed owner-preferences', { error: message });
		return json({ error: 'Signing key not configured' }, { status: 503 });
	}
};
