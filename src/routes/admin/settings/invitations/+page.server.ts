/**
 * Invitations admin — loads all invitations (newest first) + current
 * settings to check owner email for the disabled-state UI.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { listInvitations } from '$lib/db/repositories';
import { getSettings } from '$lib/services/node-settings';

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) {
		return { invitations: [], settings: null, dbAvailable: false };
	}
	const db = createDbClient(d1);
	const [invitations, settings] = await Promise.all([listInvitations(db), getSettings(db)]);
	return { invitations, settings, dbAvailable: true };
};
