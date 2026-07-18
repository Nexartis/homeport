/**
 * Developer Dashboard — Page Data Loader
 *
 * Loads the authenticated user's API keys from D1.
 * Redirects to /auth if not signed in.
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { listDevApiKeys } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'developer-dashboard');

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user?.isAuthenticated) {
		throw redirect(302, `/auth?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const d1 = platform?.env?.DB;
	if (!d1) {
		return { keys: [], user: locals.user };
	}

	const db = createDbClient(d1);

	try {
		const keys = await listDevApiKeys(db, locals.user.id);
		return {
			keys: keys.map((k) => ({
				id: k.id,
				keyPrefix: k.keyPrefix,
				name: k.name,
				status: k.status,
				tier: k.tier,
				rateLimitMonthly: k.rateLimitMonthly,
				usageCountMonthly: k.usageCountMonthly,
				lastUsedAt: k.lastUsedAt,
				createdAt: k.createdAt,
				revokedAt: k.revokedAt,
				expiresAt: k.expiresAt
			})),
			user: locals.user
		};
	} catch (error) {
		log.error('load', 'Failed to load developer keys', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { keys: [], user: locals.user };
	}
};
