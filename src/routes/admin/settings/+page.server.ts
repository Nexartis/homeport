/**
 * Admin Settings Overview — loads current node_settings + invitation counts
 * via the service + repository layers. Admin-gated by the admin layout.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { getSettings } from '$lib/services/node-settings';
import { countInvitationsByStatus } from '$lib/db/repositories';

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) {
		return {
			settings: null,
			invitationCounts: null,
			dbAvailable: false
		};
	}

	const db = createDbClient(d1);
	const [settings, invitationCounts] = await Promise.all([
		getSettings(db),
		countInvitationsByStatus(db)
	]);

	return { settings, invitationCounts, dbAvailable: true };
};
