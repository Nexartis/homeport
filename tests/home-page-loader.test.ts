/**
 * Home page loader — smoke test for the OSS Homeport landing.
 *
 * The public landing loader must return a benign shape even when the D1 node
 * settings row is missing (fresh install), and must reflect the environment
 * label configured in wrangler.jsonc test env.
 */
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { load } from '../src/routes/+page.server';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		ENVIRONMENT: string;
	}
}

type LoadResult = Exclude<Awaited<ReturnType<typeof load>>, void>;

async function callLoad(): Promise<LoadResult> {
	// The loader only touches `platform.env`; other RequestEvent fields are
	// unused, so we pass a minimal shape and cast at the boundary.
	return (await load({ platform: { env } } as Parameters<typeof load>[0])) as LoadResult;
}

describe('home page loader', () => {
	it('returns a benign shape on a fresh install (no yanez row)', async () => {
		const data = await callLoad();
		expect(data).toEqual(
			expect.objectContaining({
				yanezEnabled: expect.any(Boolean),
				envLabel: expect.any(String)
			})
		);
	});

	it('reflects the ENVIRONMENT binding in envLabel', async () => {
		const data = await callLoad();
		const raw = env.ENVIRONMENT;
		const expected = raw === 'production' ? 'prod' : (raw ?? 'dev');
		expect(data.envLabel).toBe(expected);
	});
});
