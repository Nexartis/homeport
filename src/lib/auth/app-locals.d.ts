/**
 * ⚠️  CUBESTORE SDK FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 *
 * Ambient Type Declaration — App.Locals
 *
 * Augments SvelteKit's App.Locals interface with the properties set by
 * the Sentinel authentication middleware (createSentinelHandle).
 * TypeScript declaration merging ensures these types are available in
 * all +page.server.ts and +server.ts route handlers.
 *
 * These properties are intentionally non-optional: the Sentinel handle
 * middleware always initialises both `user` and `accessToken` on every
 * request (set to `null` when unauthenticated), so downstream route
 * handlers can safely access them without an `undefined` guard.
 */

import type { UserLocals } from '@nexartis/sentinel-sdk/core';

declare global {
	namespace App {
		interface Locals {
			/** Authenticated user object, or null if not authenticated */
			user: UserLocals | null;
			/** JWT access token for downstream API calls, or null if not authenticated */
			accessToken: string | null;
		}
	}
}

export {};
