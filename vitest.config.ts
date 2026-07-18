import path from 'node:path';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib')
		}
	},
	test: {
		include: ['tests/**/*.test.ts'],
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		poolOptions: {
			workers: {
				singleWorker: true,
				isolatedStorage: false,
				// Use a test-specific wrangler config that replaces secrets_store_secrets
				// with plain vars. Miniflare merges configs rather than replacing them, so
				// providing overrides in miniflare.bindings can't override SecretsStoreSecret
				// objects from the main wrangler.jsonc.
				wrangler: { configPath: './wrangler.test.jsonc' }
			}
		}
	}
});
