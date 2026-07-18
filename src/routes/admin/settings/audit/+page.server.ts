/**
 * Admin Audit Log — server loader with filter + pagination query params.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { listAudit, countAudit } from '$lib/db/repositories';

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	if (!d1) {
		return {
			events: [],
			total: 0,
			limit: 50,
			offset: 0,
			eventType: '',
			actorEmail: '',
			dbAvailable: false
		};
	}
	const limit = Math.min(
		Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
		500
	);
	const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
	const eventType = url.searchParams.get('eventType') ?? '';
	const actorEmail = url.searchParams.get('actorEmail') ?? '';

	const db = createDbClient(d1);
	const filter = {
		limit,
		offset,
		eventType: eventType || undefined,
		actorEmail: actorEmail || undefined
	};
	const [events, total] = await Promise.all([listAudit(db, filter), countAudit(db, filter)]);
	return { events, total, limit, offset, eventType, actorEmail, dbAvailable: true };
};
