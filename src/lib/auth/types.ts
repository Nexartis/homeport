/**
 * ⚠️  CUBESTORE SDK FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 * To extend functionality, create wrapper modules that import from this file.
 *
 * Auth Types
 *
 * Re-export types from the Sentinel SDK
 */

export type {
	SentinelConfig,
	SentinelResponse,
	DecodedToken,
	UserLocals,
	SentinelHandleOptions
} from '@nexartis/sentinel-sdk/core';

export type { SentinelPlatformConfig } from './client';

/**
 * User object available in event.locals after authentication
 *
 * Add this to your app.d.ts:
 *
 * ```typescript
 * // src/app.d.ts
 * import type { UserLocals } from '@nexartis/sentinel-sdk/core';
 *
 * declare global {
 *   namespace App {
 *     interface Locals {
 *       user: UserLocals | null;
 *     }
 *     interface Platform {
 *       env?: {
 *         SENTINEL_API_URL?: string;
 *         VITE_BASE_URL?: string;
 *       };
 *     }
 *   }
 * }
 * ```
 */

/**
 * Required environment bindings for Sentinel authentication
 */
export interface SentinelEnvBindings {
	/** Sentinel API URL (e.g., https://sentinel.ocmeregistry.com/api) */
	SENTINEL_API_URL?: string;
	/** Application base URL for magic link redirects */
	VITE_BASE_URL?: string;
}
