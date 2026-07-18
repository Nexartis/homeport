/**
 * @swagger
 * /.well-known/keys/{version}:
 *   get:
 *     summary: Public signing key
 *     description: Returns the Ed25519 public key for the given version in JWK format. Used for VC and AgentAddr signature verification.
 *     tags:
 *       - Discovery
 *     parameters:
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *         description: Key version (e.g. ed25519-v1)
 *     responses:
 *       200:
 *         description: JWK public key
 *       400:
 *         description: Invalid key version
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolvePublicKey } from '$lib/utils/node-secrets';

export const GET: RequestHandler = async ({ params, platform }) => {
	const env = platform!.env;

	// Parse version from the dynamic segment (e.g. "ed25519-v1" → 1)
	const match = params.version.match(/^ed25519-v(\d+)$/);
	if (!match) {
		return json({ error: 'Invalid key version' }, { status: 400 });
	}
	const version = parseInt(match[1], 10);
	if (isNaN(version) || version < 1) {
		return json({ error: 'Invalid key version' }, { status: 400 });
	}

	// Resolve public key: env var first, then KV fallback for Pegasus nodes
	const envKey = `NANDA_ED25519_PUBLIC_KEY_v${version}` as keyof typeof env;
	const spkiBase64 = await resolvePublicKey(env[envKey] as string | undefined, env, `v${version}`);
	if (!spkiBase64) {
		return json({ error: 'Key version not found' }, { status: 404 });
	}

	// Convert SPKI DER (base64) to JWK via WebCrypto
	try {
		const der = Uint8Array.from(atob(spkiBase64), (c) => c.charCodeAt(0));
		const key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, true, ['verify']);
		const jwk = await crypto.subtle.exportKey('jwk', key);
		return json(
			{ ...jwk, kid: `ed25519-v${version}` },
			{
				status: 200,
				headers: { 'Cache-Control': 'public, max-age=86400' }
			}
		);
	} catch {
		return json({ error: 'Failed to export key' }, { status: 500 });
	}
};
