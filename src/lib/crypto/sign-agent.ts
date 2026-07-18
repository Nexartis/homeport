/**
 * Ed25519 signing for agent_addrs records.
 *
 * Single source of truth for all agent signing operations.
 * Every code path that writes to agent_addrs MUST use this module —
 * no placeholders, no silent fallbacks.
 */

import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'sign-agent');

/** Cached imported CryptoKey (valid for lifetime of the isolate) */
let _cachedKey: CryptoKey | null = null;
let _cachedPublicKeyHex: string | null = null;

/** Result of signing an agent_addrs record */
export interface AgentSignature {
	publicKeyHex: string;
	signatureHex: string;
	signerId: string;
}

/**
 * Import the Ed25519 private key from environment/KV.
 * Caches the imported CryptoKey for the lifetime of the Worker isolate.
 *
 * @throws Error if the key cannot be resolved or imported
 */
export async function importSigningKey(env: {
	KYM_NANDA_ED25519_PRIVATE_KEY_v1?: unknown;
	NANDA_NODE_CACHE?: KVNamespace;
}): Promise<CryptoKey> {
	if (_cachedKey) return _cachedKey;

	const privateKeyBase64 = await resolveSecret(
		env.KYM_NANDA_ED25519_PRIVATE_KEY_v1,
		env.NANDA_NODE_CACHE
			? kvFallback(env as { NANDA_NODE_CACHE: KVNamespace }, SECRET_KEYS.ED25519_PRIVATE_KEY_V1)
			: undefined
	);

	if (!privateKeyBase64) {
		throw new Error(
			'Ed25519 private key not configured. ' +
				'Set KYM_NANDA_ED25519_PRIVATE_KEY_v1 or initialize keys via /admin/keys.'
		);
	}

	const der = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));
	_cachedKey = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign']);
	return _cachedKey;
}

/**
 * Derive the hex-encoded public key from an Ed25519 private key.
 * Uses JWK round-trip (correct Web Crypto pattern for Ed25519).
 */
export async function derivePublicKeyHex(privateKey: CryptoKey): Promise<string> {
	if (_cachedPublicKeyHex) return _cachedPublicKeyHex;

	const jwk = await crypto.subtle.exportKey('jwk', privateKey);
	// Remove private component `d` to create a public-only JWK
	const { d: _privateComponent, ...publicJwk } = jwk;
	publicJwk.key_ops = ['verify'];
	const verifyKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, true, [
		'verify'
	]);
	const rawPub = await crypto.subtle.exportKey('raw', verifyKey);
	_cachedPublicKeyHex = Array.from(new Uint8Array(rawPub))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return _cachedPublicKeyHex;
}

/**
 * Sign an agent_addrs record. Returns the three required fields.
 *
 * The canonical signable is the agent_id (UTF-8 encoded).
 * This matches the NANDA spec for AgentAddr signing.
 *
 * @throws Error if the signing key is not available
 */
export async function signAgentAddr(
	agentId: string,
	signingKey: CryptoKey
): Promise<AgentSignature> {
	const publicKeyHex = await derivePublicKeyHex(signingKey);

	// Sign the agent_id as canonical signable
	const encoded = new TextEncoder().encode(agentId);
	const sig = await crypto.subtle.sign('Ed25519', signingKey, encoded);
	const signatureHex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	// DID key identifier per NANDA spec
	const signerId = `did:key:z6Mk${publicKeyHex.slice(0, 32)}`;

	return { publicKeyHex, signatureHex, signerId };
}

/**
 * Convenience: resolve key from env + sign in one call.
 * Use this in route handlers that have access to `platform.env`.
 *
 * @throws Error if signing key is not configured or signing fails
 */
export async function resolveAndSign(
	agentId: string,
	env: {
		KYM_NANDA_ED25519_PRIVATE_KEY_v1?: unknown;
		NANDA_NODE_CACHE?: KVNamespace;
	}
): Promise<AgentSignature> {
	const key = await importSigningKey(env);
	return signAgentAddr(agentId, key);
}

/** Clear cached key (for testing only) */
export function _clearKeyCache(): void {
	_cachedKey = null;
	_cachedPublicKeyHex = null;
}
