/**
 * ⚠️  CUBESTORE ROUTE FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 *
 * Magic Link Handler
 *
 * Handles the /auth/magic?token=... callback from Sentinel magic link emails.
 * Uses the SDK's built-in handler which validates the token, completes passwordless
 * login, and redirects appropriately.
 */
import { handleMagicLink } from '@nexartis/sentinel-sdk/sveltekit/pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return handleMagicLink(event);
};
