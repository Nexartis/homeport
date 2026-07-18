/**
 * Type declarations for the cloudflare:test virtual module.
 *
 * This module is provided at runtime by @cloudflare/vitest-pool-workers
 * but has no standalone type definitions. This declaration file establishes
 * the base module so that:
 *   1. `import { env, SELF } from 'cloudflare:test'` resolves
 *   2. `declare module 'cloudflare:test'` augmentations in test files are valid
 */
declare module 'cloudflare:test' {
	import type { ProvidedEnv } from 'cloudflare:test';

	const env: ProvidedEnv;
	const SELF: {
		fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	};

	// Base interface — test files augment this with their own bindings

	interface ProvidedEnv {}
}
