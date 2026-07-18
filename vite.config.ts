import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import openapiPlugin from 'sveltekit-openapi-generator';

export default defineConfig({
	plugins: [
		openapiPlugin({
			info: {
				title: 'Nexartis NANDA Node API',
				version: '1.0.0',
				description:
					'REST API for the Nexartis NANDA Node — agent registration, certification, health probes, payments, and developer key management.'
			},
			outputPath: 'static/openapi.json',
			debounceMs: 100
		}),
		sveltekit()
	],
	css: {
		postcss: './postcss.config.js'
	},
	build: {
		// swagger-ui-dist is ~1.6MB (code-split, only loaded on /docs/api page).
		// This is expected for a full OpenAPI documentation UI.
		chunkSizeWarningLimit: 1700,
		rollupOptions: {
			onLog(level, log, handler) {
				// Suppress "Module 'path' has been externalized for browser compatibility"
				// from swagger-ui-dist/absolute-path.js — this file uses Node's path module
				// but is never called in the browser (swagger-ui-dist is loaded via dynamic
				// import in onMount for client-side rendering only).
				if (
					log.message?.includes('has been externalized for browser compatibility') &&
					log.message?.includes('swagger-ui-dist')
				) {
					return;
				}
				handler(level, log);
			}
		}
	}
});
