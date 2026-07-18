/**
 * ⚠️  CUBESTORE ROUTE FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 *
 * Verified Handler
 *
 * Handles the post-verification redirect after a user clicks their email
 * verification link. Uses the SDK's built-in handler.
 */
import { handleVerified } from '@nexartis/sentinel-sdk/sveltekit/pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return handleVerified(event);
};
