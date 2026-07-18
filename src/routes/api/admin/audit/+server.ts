/**
 * Admin Audit Log API — GET (admin read-only).
 *
 * Query params:
 *   limit       (default 50, max 500)
 *   offset      (default 0)
 *   eventType   (exact match, e.g. 'invitation.revoked')
 *   actorEmail  (exact match, case-insensitive)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { listAudit, countAudit } from '$lib/db/repositories';
import { getActor, requireAdminRole } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-audit');

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'GET' });
	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const limit = Math.min(
		Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
		500
	);
	const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
	const eventType = url.searchParams.get('eventType') ?? undefined;
	const actorEmail = url.searchParams.get('actorEmail') ?? undefined;

	try {
		const db = createDbClient(d1);
		const [rows, total] = await Promise.all([
			listAudit(db, { limit, offset, eventType, actorEmail }),
			countAudit(db, { eventType, actorEmail })
		]);
		return json({
			events: rows,
			total,
			limit,
			offset
		});
	} catch (err) {
		log.error('GET', 'Failed to list audit events', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to list audit events' }, { status: 500 });
	}
};
