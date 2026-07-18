/**
 * ⚠️  CUBESTORE SDK FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 * To extend functionality, create wrapper modules that import from this file.
 *
 * Sentinel Auth Client
 *
 * Provides authentication utilities using Nexartis Sentinel SDK.
 * This cube wraps the @nexartis/sentinel-sdk for easy integration.
 */

import {
	SentinelClient,
	decodeTokenLocally,
	isTokenExpired,
	validateToken,
	SentinelError,
	ErrorCode,
	SentinelCode,
	type SentinelConfig,
	type SentinelResponse,
	type DecodedToken,
	type UserLocals
} from '@nexartis/sentinel-sdk/core';

// Re-export SDK core utilities for convenience
// Consumers should import from '$lib/auth/client' instead of '@nexartis/sentinel-sdk/core'
export {
	SentinelClient,
	decodeTokenLocally,
	isTokenExpired,
	validateToken,
	SentinelError,
	ErrorCode,
	SentinelCode
};
export type { SentinelConfig, SentinelResponse, DecodedToken, UserLocals };

/**
 * Configuration for creating a Sentinel client from platform environment
 */
export interface SentinelPlatformConfig {
	/** Override API URL (defaults to SENTINEL_API_URL from env) */
	apiUrl?: string;
	/** Override base URL (defaults to VITE_BASE_URL from env) */
	baseUrl?: string;
}

/**
 * Safely get a string value from environment
 * Handles both string values and Secrets Store binding objects
 */
function getEnvString(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}
	// Secrets Store bindings are objects with get() method - not supported here
	// Use wrangler vars for SENTINEL_API_URL, not secrets
	if (value && typeof value === 'object') {
		console.warn(
			'Environment value appears to be a Secrets Store binding. Use vars instead of secrets for URL configuration.'
		);
		return undefined;
	}
	return undefined;
}

/**
 * Create a Sentinel client from platform environment.
 *
 * Supports two call signatures for backward compatibility:
 *   createSentinelFromPlatform(platform, config?, fetchFn?)  — full form
 *   createSentinelFromPlatform(platform, fetchFn)            — shorthand (no config)
 *
 * @param platform - SvelteKit platform object with env bindings
 * @param configOrFetch - Optional configuration overrides OR fetch function (auto-detected)
 * @param fetchFn - Optional fetch function for SSR (when config is provided)
 * @returns Configured SentinelClient instance
 */
export function createSentinelFromPlatform(
	platform: { env?: Record<string, unknown> } | undefined,
	configOrFetch?: SentinelPlatformConfig | typeof fetch,
	fetchFn?: typeof fetch
): SentinelClient {
	// Auto-detect: if second arg is a function, it's the shorthand form
	let config: SentinelPlatformConfig | undefined;
	let actualFetch: typeof fetch | undefined;

	if (typeof configOrFetch === 'function') {
		config = undefined;
		actualFetch = configOrFetch;
	} else {
		config = configOrFetch;
		actualFetch = fetchFn;
	}

	const apiUrl = config?.apiUrl || getEnvString(platform?.env?.SENTINEL_API_URL);
	const baseUrl = config?.baseUrl || getEnvString(platform?.env?.VITE_BASE_URL);

	if (!apiUrl) {
		throw new Error(
			'SENTINEL_API_URL not configured in environment (must be a string var, not a Secrets Store binding)'
		);
	}

	if (!baseUrl) {
		throw new Error('VITE_BASE_URL not configured in environment');
	}

	// Normalize API URL - handle trailing slashes and /api suffix properly
	// Avoid producing /api/api if URL already contains /api
	let normalizedApiUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
	if (!normalizedApiUrl.endsWith('/api')) {
		normalizedApiUrl = normalizedApiUrl + '/api';
	}

	return new SentinelClient({ apiUrl: normalizedApiUrl, baseUrl }, actualFetch);
}

/**
 * Create a Sentinel client from a SvelteKit request event
 *
 * @param event - SvelteKit request event
 * @param config - Optional configuration overrides
 * @returns Configured SentinelClient instance
 */
export function createSentinelFromEvent(
	event: { platform?: { env?: Record<string, unknown> }; fetch: typeof fetch },
	config?: SentinelPlatformConfig
): SentinelClient {
	return createSentinelFromPlatform(event.platform, config, event.fetch);
}
