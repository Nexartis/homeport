/**
 * ⚠️  CUBESTORE ROUTE FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 *
 * Auth Page Guard
 *
 * Redirects authenticated users away from the login page.
 * The redirect target is configurable via SENTINEL_POST_AUTH_REDIRECT env var
 * (default: "/"). Set it in wrangler.jsonc to control where users land after login.
 * The AI-generated +page.svelte handles the login UI.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (locals.user?.isAuthenticated) {
		const target = platform?.env?.SENTINEL_POST_AUTH_REDIRECT || '/';
		throw redirect(303, target);
	}
	return {};
};
