/**
 * Resolve a Cloudflare Secrets Store binding to its string value,
 * with optional KV fallback for Pegasus-deployed nodes.
 *
 * Resolution order:
 *  1. Secrets Store binding — call .get() per Cloudflare docs
 *  2. Plain string (e.g. miniflare test override or env var)
 *  3. KV fallback — look up `__node_secrets:{key}` in KV namespace
 *
 * The KV fallback enables Pegasus deployments where secrets are managed
 * via the admin UI (/admin/keys) rather than Cloudflare Secrets Store.
 *
 * @see https://developers.cloudflare.com/secrets-store/integrations/workers/
 */
import { createLogger } from './logger';

const log = createLogger(undefined, 'resolve-secret');

/** Prefix for KV-stored node secrets (used by Pegasus deployments) */
export const KV_SECRET_PREFIX = '__node_secrets:';

export async function resolveSecret(
	binding: unknown,
	kvFallback?: { kv: KVNamespace; key: string }
): Promise<string | undefined> {
	if (binding != null) {
		// Secrets Store binding — call .get() per Cloudflare docs
		if (typeof binding === 'object' && 'get' in binding) {
			try {
				const value = await (binding as { get: () => Promise<string> }).get();
				if (value) return value;
			} catch (err) {
				// Log the error so Secrets Store outages are diagnosable (no secret values leaked)
				log.error('resolveSecret', 'Secrets Store .get() failed', {
					error: (err as Error)?.message ?? String(err)
				});
				// Fall through to KV fallback
			}
		}

		// Plain string (e.g. miniflare test override or env var)
		if (typeof binding === 'string') {
			return binding;
		}
	}

	// KV fallback — Pegasus deployments store secrets in KV
	if (kvFallback) {
		try {
			const kvKey = `${KV_SECRET_PREFIX}${kvFallback.key}`;
			const value = await kvFallback.kv.get(kvKey);
			if (value) return value;
		} catch (err) {
			log.error('resolveSecret', 'KV fallback .get() failed', {
				key: kvFallback.key,
				error: (err as Error)?.message ?? String(err)
			});
		}
	}

	return undefined;
}
