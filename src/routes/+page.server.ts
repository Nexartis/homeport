/**
 * Home-page loader for the open-source Homeport landing.
 *
 * Reads the Yanez toggle for the flagship interop panel and the environment
 * label for footer / diagnostics. Legacy signup behaviour has been
 * removed for the OSS release as part of the OSS release.
 */

import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { isYanezEnabled } from '$lib/services/yanez/service';

export const load: PageServerLoad = async ({ platform }) => {
	const env = platform?.env;
	const d1 = env?.DB;
	let yanezEnabled = false;
	if (d1) {
		try {
			const db = createDbClient(d1);
			yanezEnabled = await isYanezEnabled(db);
		} catch {
			yanezEnabled = false;
		}
	}
	return {
		yanezEnabled,
		envLabel: env?.ENVIRONMENT === 'production' ? 'prod' : (env?.ENVIRONMENT ?? 'dev')
	};
};
