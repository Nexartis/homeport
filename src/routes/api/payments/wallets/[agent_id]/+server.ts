/**
 * GET /api/payments/wallets/:agent_id — Get multi-currency wallet balances
 *
 * Lane C (M2M): any authenticated caller — developer API key or admin
 * session — may read balances. The `audit_wallets` table is keyed by
 * `agent_name` with no owner column, so strict per-owner filtering is not
 * yet possible at this layer.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { getMultiCurrencyBalances } from '$lib/services/payment/multi-wallet';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-payments-wallets');

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET wallet' });

	const env = platform!.env;
	const db = createDbClient(env.DB);
	const agentId = params.agent_id;

	if (!agentId) {
		return json({ error: 'agent_id parameter is required' }, { status: 400 });
	}

	try {
		const balances = await getMultiCurrencyBalances(db, agentId);
		return json({ agent_id: agentId, balances });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: msg }, { status: 500 });
	}
};
