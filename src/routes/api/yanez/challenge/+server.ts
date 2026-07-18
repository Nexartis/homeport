/**
 * Yanez sign-and-return — mint a signing challenge.
 *
 * POST /api/yanez/challenge  (admin/owner only)
 *   body: { subject?: string, message?: string, ttlSec?: number }
 *   → { challengeId, deepLink, qrDataUrl, callbackUrl, statusToken, expiresAt }
 *
 * Gated by YANEZ_ENABLED (503 when the service is off). Minting is an
 * operator action, so it requires an admin session (the public callback and
 * status routes self-protect via cap / status_token instead).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { isYanezEnabled, mintChallenge } from '$lib/services/yanez';
import { getActor, requireAdminRole } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-yanez-challenge');

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'POST' });

	const env = platform?.env;
	if (!env?.DB) return json({ error: 'Database not available' }, { status: 503 });
	const db = createDbClient(env.DB);
	if (!(await isYanezEnabled(db))) {
		return json({ error: 'Yanez service not enabled' }, { status: 503 });
	}

	// Fail loud on a malformed body rather than silently minting with defaults.
	// An empty body ({}) is allowed — every field is optional — but invalid JSON
	// is a client error, matching the callback route.
	let bodyRaw: unknown;
	try {
		bodyRaw = await request.text();
		bodyRaw = bodyRaw === '' ? {} : JSON.parse(bodyRaw as string);
	} catch {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}
	if (bodyRaw === null || typeof bodyRaw !== 'object') {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}
	const body = bodyRaw as { subject?: unknown; message?: unknown; ttlSec?: unknown };

	try {
		const result = await mintChallenge(db, env, {
			subject: typeof body.subject === 'string' ? body.subject : undefined,
			message: typeof body.message === 'string' ? body.message : undefined,
			ttlSec: typeof body.ttlSec === 'number' ? body.ttlSec : undefined
		});
		return json(result, { status: 201 });
	} catch (err) {
		log.error('POST', 'Failed to mint Yanez challenge', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to mint challenge' }, { status: 500 });
	}
};
