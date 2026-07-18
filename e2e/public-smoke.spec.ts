import { expect, test } from '@playwright/test';

const publicPages = [
	{ path: '/', heading: 'A self-hostable NANDA node for the agentic web.' },
	{ path: '/docs', heading: 'Documentation' },
	{ path: '/docs/quickstart', heading: 'Quickstart' },
	{ path: '/docs/nanda', heading: 'Project NANDA' },
	{ path: '/developers/getting-started', heading: 'Your first NANDA agent query in 60 seconds' },
	{ path: '/privacy', heading: 'Privacy Policy' },
	{ path: '/terms', heading: 'Terms of Service' },
	{ path: '/contact', heading: "Let's Talk" }
];

test.describe('public pages', () => {
	for (const { path, heading } of publicPages) {
		test(`${path} renders public content`, async ({ page }) => {
			await page.goto(path);

			await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
			await expect(page.getByRole('main')).toBeVisible();
			await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
		});
	}

	test('landing page exposes quickstart and managed-Cubicube calls to action', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('link', { name: /^Quickstart$/i }).first()).toHaveAttribute(
			'href',
			'/docs/quickstart'
		);
		await expect(
			page.getByRole('link', { name: /Get a managed Homeport/i }).first()
		).toHaveAttribute('href', 'https://cubicube.com');
	});
});

test.describe('public status contract', () => {
	test('health endpoint returns a public status payload', async ({ request }) => {
		const response = await request.get('/health');
		expect([200, 503]).toContain(response.status());

		const body = await response.json();
		expect(['ok', 'degraded']).toContain(body.status);
		expect(body.checks).toEqual(expect.objectContaining({}));
	});

	test('docs route is reachable without Sentinel auth', async ({ request }) => {
		const response = await request.get('/docs');
		expect(response.status()).toBe(200);
	});
});

test.describe('public accessibility smoke', () => {
	test('keyboard focus reaches an accessible public control', async ({ page }) => {
		await page.goto('/docs');
		await page.keyboard.press('Tab');

		const focused = page.locator(':focus');
		await expect(focused).toBeVisible();
		expect(
			await focused.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent?.trim())
		).toBeTruthy();
	});
});
