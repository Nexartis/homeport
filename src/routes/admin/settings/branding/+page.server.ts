/**
 * Admin Branding — loads current node_settings for branding form.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { getSettings } from '$lib/services/node-settings';

export const load: PageServerLoad = async ({ platform }) => {
	const d1 = platform?.env?.DB;
	if (!d1) return { settings: null, dbAvailable: false };
	const db = createDbClient(d1);
	return { settings: await getSettings(db), dbAvailable: true };
};
