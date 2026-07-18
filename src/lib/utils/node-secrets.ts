/**
 * Node Secrets — KV fallback helpers for resolveSecret() and public keys.
 *
 * Reduces boilerplate when calling resolveSecret() with KV fallback
 * across all service call sites. Each function returns the `kvFallback`
 * parameter shape expected by resolveSecret().
 *
 * Also provides resolvePublicKey() for Ed25519 public key resolution
 * with KV fallback — matching the resolveSecret() pattern so Pegasus
 * nodes work correctly after key initialization via /admin/keys.
 *
 * Usage:
 *   const hmac = await resolveSecret(env.KYM_NANDA_HMAC_SECRET, kvFallback(env, 'hmac_secret'));
 *   const pubKey = await resolvePublicKey(env.NANDA_ED25519_PUBLIC_KEY_v1, env, 'v1');
 */
import { KV_SECRET_PREFIX } from '$lib/utils/resolve-secret';

/** Build a KV fallback descriptor for resolveSecret(). Returns undefined if KV is unavailable. */
export function kvFallback(
	env: { NANDA_NODE_CACHE?: KVNamespace },
	key: string
): { kv: KVNamespace; key: string } | undefined {
	if (!env.NANDA_NODE_CACHE) return undefined;
	return { kv: env.NANDA_NODE_CACHE, key };
}

/**
 * Resolve an Ed25519 public key with KV fallback for Pegasus deployments.
 *
 * Resolution order:
 *  1. Env var (e.g. NANDA_ED25519_PUBLIC_KEY_v1) — set for Nexartis-hosted nodes
 *  2. KV fallback (`__node_secrets:ed25519_public_key_{version}`) — set by /admin/keys
 *
 * This mirrors how resolveSecret() handles private keys: env/Secrets Store first,
 * KV fallback for Pegasus nodes where secrets are managed via the admin UI.
 */
export async function resolvePublicKey(
	envValue: string | undefined,
	env: { NANDA_NODE_CACHE?: KVNamespace },
	version: string
): Promise<string | undefined> {
	// 1. Env var — always preferred (set in wrangler.jsonc for Nexartis-hosted)
	if (envValue) return envValue;

	// 2. KV fallback — Pegasus nodes store keys via /admin/keys
	if (env.NANDA_NODE_CACHE) {
		try {
			const kvKey = `${KV_SECRET_PREFIX}ed25519_public_key_${version}`;
			const value = await env.NANDA_NODE_CACHE.get(kvKey);
			if (value) return value;
		} catch {
			// KV read failure — return undefined
		}
	}

	return undefined;
}

/** Well-known KV secret key names (must match /admin/keys API and PEGASUS.md) */
export const SECRET_KEYS = {
	HMAC_SECRET: 'hmac_secret',
	RADIUS_SECRET: 'radius_secret',
	ED25519_PRIVATE_KEY_V1: 'ed25519_private_key_v1',
	ED25519_PRIVATE_KEY_V2: 'ed25519_private_key_v2',
	CRON_AUTH_TOKEN: 'cron_auth_token',
	FEDERATION_ADMIN_KEY: 'federation_admin_key'
} as const;

export type SecretKeyName = (typeof SECRET_KEYS)[keyof typeof SECRET_KEYS];
