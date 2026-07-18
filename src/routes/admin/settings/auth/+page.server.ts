/**
 * Admin Auth Settings — loads node_settings + the most recent
 * settings-related audit entries to render the sidebar history.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { getSettings } from '$lib/services/node-settings';
import { listAudit } from '$lib/db/repositories';

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) {
		return { settings: null, auditEvents: [], dbAvailable: false };
	}
	const db = createDbClient(d1);
	const [settings, all] = await Promise.all([getSettings(db), listAudit(db, { limit: 50 })]);
	// Client-side filter to avoid two repo variants.
	const auditEvents = all.filter((row) => row.eventType.startsWith('settings.')).slice(0, 10);
	return { settings, auditEvents, dbAvailable: true };
};
