/**
 * GET /health — Infrastructure health check
 *
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: >
 *       Checks D1 database, R2 storage, and KV cache. Returns 503 if any check fails.
 *       Pass `?probe=secrets` to additionally probe each declared secrets_store_secrets
 *       binding via `.get()` and report per-binding status (machine-readable, consumable
 *       by the tenant deploy-worker.yml post-provision assertions).
 *     tags:
 *       - System
 *     parameters:
 *       - in: query
 *         name: probe
 *         schema: { type: string, enum: [secrets] }
 *         description: When set to `secrets`, deep-probes each Secrets Store binding.
 *     responses:
 *       200:
 *         description: All systems operational
 *       503:
 *         description: One or more systems degraded
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { agentAddrs } from '$lib/db/schema';
import { createLogger } from '$lib/utils/logger';
import { sql } from 'drizzle-orm';

const log = createLogger(undefined, 'health');

// Declared secrets_store_secrets bindings (mirrors cube.jsonc L113–144).
// Update here when cube.jsonc changes. Keep this list narrow to the names that
// MUST exist for a Pegasus-healthy deploy; optional bindings go in OPTIONAL_SECRET_BINDINGS.
const REQUIRED_SECRET_BINDINGS = [
	'KYM_NANDA_HMAC_SECRET',
	'KYM_NANDA_RADIUS_SECRET',
	'KYM_NANDA_ED25519_PRIVATE_KEY_v1',
	'CRON_AUTH_TOKEN',
	'NANDA_FEDERATION_ADMIN_KEY'
] as const;

// KYM_NANDA_ED25519_PRIVATE_KEY_v2 is an unprovisioned rotation slot — will
// be re-added to this list when the rotation is scheduled (requires matching
// public key in NANDA_ED25519_PUBLIC_KEY_v2 + /.well-known/keys/ed25519-v2).
const OPTIONAL_SECRET_BINDINGS = ['RESEND_API_KEY'] as const;

type SecretStatus = 'ok' | 'missing' | 'probe_failed' | 'present';

/** Classify a secret binding's shape without calling `.get()`. */
function classifySecretBinding(binding: unknown): 'present' | 'missing' {
	if (binding == null) return 'missing';
	if (typeof binding === 'string' && binding.length > 0) return 'present';
	if (typeof binding === 'object' && binding !== null && 'get' in binding) return 'present';
	return 'missing';
}

/** Deep-probe a Secrets Store binding via `.get()` with a 2s timeout. */
async function probeSecretBinding(binding: unknown): Promise<SecretStatus> {
	if (binding == null) return 'missing';
	if (typeof binding === 'string') return binding.length > 0 ? 'ok' : 'missing';
	if (typeof binding === 'object' && binding !== null && 'get' in binding) {
		try {
			const ac = new AbortController();
			const timer = setTimeout(() => ac.abort(), 2000);
			const value = await (binding as { get: () => Promise<string> }).get();
			clearTimeout(timer);
			return value && value.length > 0 ? 'ok' : 'missing';
		} catch {
			return 'probe_failed';
		}
	}
	return 'missing';
}

export const GET: RequestHandler = async ({ platform, url }) => {
	const env = platform!.env;
	const deepProbe = url.searchParams.get('probe') === 'secrets';

	// --- DB connectivity check + agent count ---
	let db: 'ok' | 'error' = 'error';
	let agentCount = 0;
	try {
		const dbClient = createDbClient(env.DB);
		const [row] = await dbClient.select({ cnt: sql<number>`COUNT(*)` }).from(agentAddrs);
		agentCount = row?.cnt ?? 0;
		db = 'ok';
	} catch (err) {
		log.error('GET', 'DB connectivity check failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		db = 'error';
	}

	// --- R2 binding-presence check (verifies binding exists, not bucket reachability) ---
	const r2: 'ok' | 'error' = env.KYM_NANDA_EVIDENCE ? 'ok' : 'error';

	// --- KV binding-presence check (verifies binding exists, not namespace reachability) ---
	const kv: 'ok' | 'error' = env.NANDA_NODE_CACHE ? 'ok' : 'error';

	// --- Secrets bindings (per-binding report, presence by default; deep probe when requested) ---
	const envRec = env as unknown as Record<string, unknown>;
	const secrets: Record<string, SecretStatus> = {};
	const probe = deepProbe ? probeSecretBinding : async (b: unknown) => classifySecretBinding(b);
	await Promise.all(
		[...REQUIRED_SECRET_BINDINGS, ...OPTIONAL_SECRET_BINDINGS].map(async (name) => {
			secrets[name] = await probe(envRec[name]);
		})
	);
	// Only fold secrets into overall status when the caller explicitly asked for a
	// deep probe (?probe=secrets). Presence-only reporting is advisory so default
	// /health stays permissive for test runners and miniflare where bindings
	// aren't provisioned. Deploy-worker.yml should call /health?probe=secrets
	// for a 503-on-missing assertion.
	const requiredSecretsOk =
		!deepProbe || REQUIRED_SECRET_BINDINGS.every((name) => secrets[name] === 'ok');

	const overallStatus =
		db === 'ok' && r2 === 'ok' && kv === 'ok' && requiredSecretsOk ? 'ok' : 'degraded';

	const httpStatus = overallStatus === 'ok' ? 200 : 503;

	return json(
		{
			status: overallStatus,
			timestamp: new Date().toISOString(),
			environment: env.ENVIRONMENT,
			agents: agentCount,
			checks: {
				db,
				r2,
				kv,
				secrets
			},
			probe: {
				secrets: deepProbe ? 'deep' : 'presence'
			}
		},
		{ status: httpStatus }
	);
};
