/**
 * Yanez sign-and-return — poll challenge status.
 *
 * GET /api/yanez/status/{id}?status_token=...   (public; token-authenticated)
 *   → { status, verifyOk, yid?, ethAddress? }
 *
 * The status_token is minted alongside the challenge. Public route; must not
 * be added to PROTECTED_ROUTES.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { isYanezEnabled, getStatus } from '$lib/services/yanez';
import { markPublic } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-yanez-status');

export const GET: RequestHandler = async ({ params, url, platform }) => {
	markPublic({
		reason:
			'Yanez challenge status poll — no node session; authenticated by the per-request `status_token` capability minted with the challenge',
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
	const token = url.searchParams.get('status_token');

	try {
		const result = await getStatus(db, env, id, token);
		if ('error' in result) {
			return json({ error: result.error }, { status: result.httpStatus });
		}
		return json(result, { status: 200 });
	} catch (err) {
		log.error('GET', 'Yanez status lookup failed', {
			id,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'status lookup failed' }, { status: 500 });
	}
};
