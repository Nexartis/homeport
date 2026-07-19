/**
 * Yanez sign-and-return — receive the app's signed callback.
 *
 * POST /api/yanez/callback/{id}?cap=...   (public; authenticated by `cap`)
 *   body: flat { signature, group_public_key, eth_address, message,
 *                request_id, yid }
 *   → { ok: true } on success, else an error with the appropriate status.
 *
 * Public by design — the Yanez mobile app calls it without a node session —
 * so it MUST NOT be added to hooks.server.ts PROTECTED_ROUTES. Authenticated
 * by the `cap` HMAC capability minted with the challenge; single-use.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { isYanezEnabled, verifyCallback } from '$lib/services/yanez';
import type { YanezCallbackBody } from '$lib/services/yanez';
import { markPublic } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-yanez-callback');

export const POST: RequestHandler = async ({ request, params, url, platform }) => {
	markPublic({
		reason:
			'Yanez mobile app callback — no node session; authenticated by the per-request `cap` HMAC capability minted with the challenge; single-use',
		csrf: false
	});

	const env = platform?.env;
	if (!env?.DB) return json({ error: 'Database not available' }, { status: 503 });
	const db = createDbClient(env.DB);
	if (!(await isYanezEnabled(db))) {
		return json({ error: 'Yanez service not enabled' }, { status: 503 });
	}

	const id = params.id;
	if (!id) return json({ error: 'missing challenge id' }, { status: 400 });
	const cap = url.searchParams.get('cap');

	let body: YanezCallbackBody = {};
	try {
		body = ((await request.json()) ?? {}) as YanezCallbackBody;
	} catch {
		return json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
	}

	try {
		const outcome = await verifyCallback(db, env, id, cap, body);
		if (outcome.ok) {
			return json({ ok: true }, { status: 200 });
		}
		return json({ ok: false, error: outcome.error }, { status: outcome.httpStatus });
	} catch (err) {
		log.error('POST', 'Yanez callback processing failed', {
			id,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ ok: false, error: 'callback processing failed' }, { status: 500 });
	}
};
