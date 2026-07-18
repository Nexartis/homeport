#!/usr/bin/env node
/**
 * Post-Build Script: Inject Cache Shim for Workers for Platforms
 *
 * This script patches the generated _worker.js file to inject cache setup code
 * BEFORE the worktop library tries to access caches.default.
 *
 * Problem:
 * - Line ~34 of _worker.js: `var s = caches.default;`
 * - This runs at module initialization time
 * - Workers in dispatch namespace don't have global `caches`
 * - They receive DEFAULT_CACHE binding from dispatcher
 *
 * Solution:
 * - Inject code after the cloudflare:workers import that sets up globalThis.caches
 * - Use the DEFAULT_CACHE binding if available
 * - Provide no-op cache if not available
 *
 * Robustness:
 * - Multiple pattern matching for different import styles
 * - Fallback injection at file start with own import
 * - Idempotent - won't double-patch
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const workerPath = join(projectRoot, '.svelte-kit/cloudflare/_worker.js');

console.log('[Cache Shim] Injecting cache setup into _worker.js...');

// Check if the file exists
if (!existsSync(workerPath)) {
	console.log('[Cache Shim] _worker.js not found (build may not have run yet), skipping...');
	process.exit(0);
}

/**
 * The cache shim code that sets up globalThis.caches
 * IMPORTANT: Must ALWAYS set up globalThis.caches to prevent worktop from
 * accessing the native caches.default which throws in dispatch namespace workers.
 * @param {boolean} needsImport - Whether to include the env import
 */
function getCacheShimCode(needsImport = false) {
	const importLine = needsImport ? 'import { env as __wfp_env } from "cloudflare:workers";\n' : '';
	const envVar = needsImport ? '__wfp_env' : 'env';

	return `${importLine}
// CACHE SHIM INJECTED FOR WORKERS FOR PLATFORMS
// Set up globalThis.caches before worktop library initializes (line ~68)
// MUST always override caches - Workers in dispatch namespace don't have direct cache access
if (${envVar}.DEFAULT_CACHE) {
	// Use the cache binding provided by the dispatcher
	globalThis.caches = {
		default: ${envVar}.DEFAULT_CACHE,
		open: async (cacheName) => ${envVar}.DEFAULT_CACHE,
		match: async (request, options) => ${envVar}.DEFAULT_CACHE.match(request, options),
		delete: async () => false,
		has: async (cacheName) => cacheName === 'default',
		keys: async () => ['default']
	};
	console.log('[Cache Shim] Using DEFAULT_CACHE binding from dispatcher');
} else {
	// No cache binding - provide no-op cache to prevent errors
	// This is required because dispatch namespace workers cannot access caches.default directly
	const noOpCache = {
		match: async () => undefined,
		put: async () => {},
		delete: async () => false,
		keys: async () => []
	};
	globalThis.caches = {
		default: noOpCache,
		open: async () => noOpCache,
		match: async () => undefined,
		delete: async () => false,
		has: async () => false,
		keys: async () => []
	};
	console.log('[Cache Shim] No DEFAULT_CACHE binding, using no-op cache');
}
// END CACHE SHIM

`;
}

/**
 * Try multiple patterns to find the env import from cloudflare:workers
 * Returns the match and index, or null if not found
 */
function findEnvImport(code) {
	// Patterns in order of preference (most specific to least)
	const patterns = [
		// Standard named import with double quotes
		/import\s*{\s*env\s*}\s*from\s*"cloudflare:workers"\s*;?/,
		// Standard named import with single quotes
		/import\s*{\s*env\s*}\s*from\s*'cloudflare:workers'\s*;?/,
		// Named import with other items (env could be anywhere in the list)
		/import\s*{[^}]*\benv\b[^}]*}\s*from\s*["']cloudflare:workers["']\s*;?/,
		// Any import from cloudflare:workers (we'll inject after it)
		/import\s*[^;]+\s*from\s*["']cloudflare:workers["']\s*;?/
	];

	for (const pattern of patterns) {
		const match = code.match(pattern);
		if (match) {
			const index = code.indexOf(match[0]);
			return { match: match[0], index, endIndex: index + match[0].length };
		}
	}

	return null;
}

try {
	// Read the generated worker file
	let workerCode = readFileSync(workerPath, 'utf-8');

	// Check if already patched
	if (workerCode.includes('// CACHE SHIM INJECTED')) {
		console.log('[Cache Shim] Already patched, skipping...');
		process.exit(0);
	}

	// Try to find the env import
	const envImport = findEnvImport(workerCode);

	let patchedCode;

	if (envImport) {
		// Found an import from cloudflare:workers - inject after it
		console.log('[Cache Shim] Found cloudflare:workers import, injecting after...');
		patchedCode =
			workerCode.slice(0, envImport.endIndex) +
			getCacheShimCode(false) +
			workerCode.slice(envImport.endIndex);
	} else {
		// Fallback: Inject at the very beginning with our own import
		console.log('[Cache Shim] No cloudflare:workers import found, using fallback injection...');
		patchedCode = getCacheShimCode(true) + workerCode;
	}

	// Write back
	writeFileSync(workerPath, patchedCode, 'utf-8');

	console.log('[Cache Shim] ✅ Successfully injected cache shim');
	console.log('[Cache Shim] Worker will now work in Workers for Platforms dispatch namespace');
} catch (error) {
	console.error('[Cache Shim] ❌ Failed to inject cache shim:', error.message);
	process.exit(1);
}
