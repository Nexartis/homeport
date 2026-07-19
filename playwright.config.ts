import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: true,
	reporter: [['list']],
	use: {
		baseURL,
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'pnpm exec vite dev --host 127.0.0.1 --port 4173 --strictPort',
		url: baseURL,
		reuseExistingServer: true,
		timeout: 120_000
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
