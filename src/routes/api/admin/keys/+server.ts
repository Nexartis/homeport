/**
 * Admin Keys API — GET / POST / PATCH for node secret management.
 *
 * GET  → return initialization status of all node secrets
 * POST → initialize all secrets (first-time setup)
 * PATCH → rotate a single secret by key name
 *
 * Protected by /admin auth guard in hooks.server.ts.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKeyStatus, initializeAllKeys, rotateKey } from '$lib/services/key-management';
import type { SecretKeyName } from '$lib/utils/node-secrets';
import { SECRET_KEYS } from '$lib/utils/node-secrets';
import { getActor, rejectApiKeyAuth, requireAdminRole } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-keys');

export const GET: RequestHandler = async ({ platform, locals }) => {
	const actor = getActor(locals);
	rejectApiKeyAuth(actor, { log, fn: 'GET' });
	requireAdminRole(actor, { log, fn: 'GET' });
	const kv = platform?.env?.NANDA_NODE_CACHE;
	if (!kv) {
		return json({ error: 'KV namespace not available' }, { status: 503 });
	}

	try {
		const statuses = await getKeyStatus(kv);
		return json({ keys: statuses });
	} catch (err) {
		log.error('GET', 'Failed to get key status', {
			error: (err as Error)?.message ?? String(err)
		});
		return json({ error: 'Failed to retrieve key status' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	rejectApiKeyAuth(actor, { log, fn: 'POST' });
	requireAdminRole(actor, { log, fn: 'POST' });
	const kv = platform?.env?.NANDA_NODE_CACHE;
	if (!kv) {
		return json({ error: 'KV namespace not available' }, { status: 503 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const force = (body as Record<string, unknown>).force === true;

		const result = await initializeAllKeys(kv, { force });

		if (!result.success) {
			return json(
				{ error: result.error ?? 'Initialization failed', keys: result.keys },
				{ status: 500 }
			);
		}

		return json({
			message: 'Keys initialized successfully',
			keys: result.keys,
			publicKeys: result.publicKeys
		});
	} catch (err) {
		log.error('POST', 'Key initialization failed', {
			error: (err as Error)?.message ?? String(err)
		});
		return json({ error: 'Key initialization failed' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	rejectApiKeyAuth(actor, { log, fn: 'PATCH' });
	requireAdminRole(actor, { log, fn: 'PATCH' });
	const kv = platform?.env?.NANDA_NODE_CACHE;
	if (!kv) {
		return json({ error: 'KV namespace not available' }, { status: 503 });
	}

	try {
		const body = (await request.json()) as { key?: string };
		const keyName = body.key;

		if (!keyName) {
			return json({ error: 'Missing "key" field' }, { status: 400 });
		}

		// Validate key name
		const validKeys = Object.values(SECRET_KEYS) as string[];
		if (!validKeys.includes(keyName)) {
			return json({ error: `Invalid key name: ${keyName}` }, { status: 400 });
		}

		const result = await rotateKey(kv, keyName as SecretKeyName);

		if (!result.success) {
			return json({ error: result.error ?? 'Rotation failed' }, { status: 500 });
		}

		return json({
			message: `Key "${keyName}" rotated successfully`,
			publicKey: result.publicKey
		});
	} catch (err) {
		log.error('PATCH', 'Key rotation failed', {
			error: (err as Error)?.message ?? String(err)
		});
		return json({ error: 'Key rotation failed' }, { status: 500 });
	}
};
