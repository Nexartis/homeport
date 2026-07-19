/**
 * Global test setup — seeds KV with required node secrets so that the
 * hooks.server.ts "unconfigured state guard" (Section 7.5) doesn't
 * return 503 for every route.
 *
 * This runs once before all test suites via vitest.config.ts setupFiles.
 */
import { beforeAll } from 'vitest';
import { env } from 'cloudflare:test';

const KV_SECRET_PREFIX = '__node_secrets:';

const REQUIRED_SECRETS: Record<string, string> = {
	hmac_secret: 'test-hmac-secret',
	radius_secret: 'test-radius-secret',
	ed25519_private_key_v1: 'test-ed25519-key-placeholder',
	cron_auth_token: 'test-cron-token',
	federation_admin_key: 'test-admin-key'
};

beforeAll(async () => {
	const kv = env.NANDA_NODE_CACHE;
	if (!kv) {
		console.warn('[test-setup] NANDA_NODE_CACHE KV binding not available — skipping key seeding');
		return;
	}

	// Seed all required secrets into KV so areKeysInitialized() returns true
	await Promise.all(
		Object.entries(REQUIRED_SECRETS).map(([key, value]) =>
			kv.put(`${KV_SECRET_PREFIX}${key}`, value, {
				metadata: { updatedAt: new Date().toISOString() }
			})
		)
	);
});
