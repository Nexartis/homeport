/**
 * ⚠️  CUBESTORE ROUTE FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 *
 * Email Verification Handler
 *
 * Handles the /auth/verify?token=... callback from Sentinel verification emails.
 * Uses the SDK's built-in handler which validates the verification token.
 */
import { handleVerifyEmail } from '@nexartis/sentinel-sdk/sveltekit/pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return handleVerifyEmail(event);
};
