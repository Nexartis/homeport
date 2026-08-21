/**
 * Global test setup — seeds KV with required node secrets so that the
 * hooks.server.ts "unconfigured state guard" (Section 7.5) doesn't
 * return 503 for every route.
 *
 * Also guarantees the shared test D1 `agent_addrs` table carries the Set C
 * visibility/metadata columns before any suite runs. Test files run in a
 * single worker against one shared D1 (vitest.config.ts: singleWorker,
 * isolatedStorage:false), and each file's `CREATE TABLE IF NOT EXISTS
 * agent_addrs` is written without the newer columns — so whichever file
 * creates the table first would otherwise leave it without `visibility`
 * etc., breaking the discovery/federation queries. Creating the table here
 * (setup runs before every file's beforeAll) makes all later CREATE IF NOT
 * EXISTS no-ops; the ALTER fallbacks cover a table that already exists.
 *
 * This runs once before all test suites via vitest.config.ts setupFiles.
 */
import { beforeAll } from 'vitest';
import { env } from 'cloudflare:test';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const KV_SECRET_PREFIX = '__node_secrets:';

const REQUIRED_SECRETS: Record<string, string> = {
	hmac_secret: 'test-hmac-secret',
	radius_secret: 'test-radius-secret',
	ed25519_private_key_v1: 'test-ed25519-key-placeholder',
	cron_auth_token: 'test-cron-token',
	federation_admin_key: 'test-admin-key'
};

/** Full agent_addrs schema including the Set C visibility/metadata columns. */
const AGENT_ADDRS_DDL = `CREATE TABLE IF NOT EXISTS agent_addrs (
	agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL, signature_hex TEXT NOT NULL,
	signer_id TEXT NOT NULL, facts_url TEXT, private_url TEXT, resolver_url TEXT,
	ttl_seconds INTEGER NOT NULL DEFAULT 300, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
	source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
	agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT, status TEXT DEFAULT 'alive',
	version TEXT DEFAULT '1.0.0', deprecated_at INTEGER, sunset_at INTEGER,
	registered_at INTEGER DEFAULT (unixepoch()),
	visibility TEXT NOT NULL DEFAULT 'public',
	capability_manifest TEXT, mcp_metadata TEXT, pricing TEXT)`;

/** Fallbacks in case a table already exists without the newer columns. */
const AGENT_ADDRS_ALTERS = [
	`ALTER TABLE agent_addrs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'`,
	`ALTER TABLE agent_addrs ADD COLUMN capability_manifest TEXT`,
	`ALTER TABLE agent_addrs ADD COLUMN mcp_metadata TEXT`,
	`ALTER TABLE agent_addrs ADD COLUMN pricing TEXT`
];

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

beforeAll(async () => {
	const db = env.DB;
	if (!db) return;

	await db.prepare(AGENT_ADDRS_DDL).run();
	for (const alter of AGENT_ADDRS_ALTERS) {
		try {
			await db.prepare(alter).run();
		} catch {
			// Column already exists — safe to ignore
		}
	}
	await db
		.prepare('CREATE INDEX IF NOT EXISTS idx_agent_addrs_visibility ON agent_addrs(visibility)')
		.run();
});

beforeAll(async () => {
	// Test isolation: purge per-window rate-limit counters (`rl:*`) so every
	// file starts with a fresh budget. The suite runs in a single worker with
	// shared KV (vitest.config.ts: singleWorker, isolatedStorage:false), so
	// earlier files' POST /register calls would otherwise leak 429s into
	// later files within the same 60s window.
	const kv = env.NANDA_NODE_CACHE;
	if (!kv) return;
	let cursor: string | undefined;
	do {
		const page = await kv.list({ prefix: 'rl:', cursor, limit: 1000 });
		await Promise.all(page.keys.map((k) => kv.delete(k.name)));
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
});
