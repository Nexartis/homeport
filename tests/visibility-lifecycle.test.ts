/**
 * Set C — Visibility Lifecycle Tests (proof surface)
 *
 * Registers one agent in each of the four visibility states and proves the
 * discovery matrix:
 *  - /search and /list return ONLY public + for_hire
 *  - /lookup serves unlisted by exact id, 404s private
 *  - invalid visibility on /register → 400
 *  - capability_manifest / mcp_metadata / pricing round-trip register → lookup
 *  - NULL/missing visibility is treated as 'public'
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SELF } from 'cloudflare:test';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		ENVIRONMENT: string;
	}
}

const VISIBILITY_FIXTURES = [
	{ agent_id: 'vis-private', agent_url: 'https://vis-private.example.com', visibility: 'private' },
	{
		agent_id: 'vis-unlisted',
		agent_url: 'https://vis-unlisted.example.com',
		visibility: 'unlisted'
	},
	{ agent_id: 'vis-public', agent_url: 'https://vis-public.example.com', visibility: 'public' },
	{
		agent_id: 'vis-for-hire',
		agent_url: 'https://vis-for-hire.example.com',
		visibility: 'for_hire'
	}
];

beforeAll(async () => {
	for (const agent of VISIBILITY_FIXTURES) {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(agent)
		});
		if (res.status !== 200) throw new Error(`fixture register failed: ${res.status}`);
	}
});

describe('Set C visibility lifecycle', () => {
	it('GET /search returns only public and for_hire agents', async () => {
		const res = await SELF.fetch('https://fake.host/search?q=vis-');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>[];
		const ids = body.map((a) => a.agent_id);
		expect(ids).toContain('vis-public');
		expect(ids).toContain('vis-for-hire');
		expect(ids).not.toContain('vis-private');
		expect(ids).not.toContain('vis-unlisted');
	});

	it('GET /list returns only public and for_hire agents', async () => {
		const res = await SELF.fetch('https://fake.host/list');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>[];
		const ids = body.map((a) => a.agent_id);
		expect(ids).toContain('vis-public');
		expect(ids).toContain('vis-for-hire');
		expect(ids).not.toContain('vis-private');
		expect(ids).not.toContain('vis-unlisted');
	});

	it('GET /lookup/:id serves unlisted agents by exact id', async () => {
		const res = await SELF.fetch('https://fake.host/lookup/vis-unlisted');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.agent_id).toBe('vis-unlisted');
		expect(body.visibility).toBe('unlisted');
	});

	it('GET /lookup/:id serves public and for_hire agents', async () => {
		const pub = await SELF.fetch('https://fake.host/lookup/vis-public');
		expect(pub.status).toBe(200);
		expect(((await pub.json()) as Record<string, unknown>).visibility).toBe('public');

		const hire = await SELF.fetch('https://fake.host/lookup/vis-for-hire');
		expect(hire.status).toBe(200);
		expect(((await hire.json()) as Record<string, unknown>).visibility).toBe('for_hire');
	});

	it('GET /lookup/:id returns 404 for private agents', async () => {
		const res = await SELF.fetch('https://fake.host/lookup/vis-private');
		expect(res.status).toBe(404);
	});

	it('POST /register rejects an invalid visibility with 400', async () => {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'vis-invalid',
				agent_url: 'https://vis-invalid.example.com',
				visibility: 'hidden'
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(String(body.error)).toContain('visibility');
	});

	it('POST /register rejects malformed capability_manifest, mcp_metadata, and pricing', async () => {
		const badManifest = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'vis-bad-manifest',
				agent_url: 'https://x.example.com',
				capability_manifest: [{ name: 'missing id' }]
			})
		});
		expect(badManifest.status).toBe(400);

		const badMcp = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'vis-bad-mcp',
				agent_url: 'https://x.example.com',
				mcp_metadata: { transport: 'carrier-pigeon' }
			})
		});
		expect(badMcp.status).toBe(400);

		const badPricing = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'vis-bad-pricing',
				agent_url: 'https://x.example.com',
				pricing: { model: 'exposure' }
			})
		});
		expect(badPricing.status).toBe(400);
	});

	it('treats missing visibility as public', async () => {
		const reg = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'vis-default',
				agent_url: 'https://vis-default.example.com'
			})
		});
		expect(reg.status).toBe(200);

		const res = await SELF.fetch('https://fake.host/lookup/vis-default');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.visibility).toBe('public');
	});

	it('round-trips capability_manifest, mcp_metadata, and pricing through register → lookup', async () => {
		const payload = {
			agent_id: 'vis-meta',
			agent_url: 'https://vis-meta.example.com',
			visibility: 'for_hire',
			capability_manifest: [
				{
					id: 'summarize',
					name: 'Summarize',
					description: 'Summarizes text',
					auth: 'bearer',
					pricing: { model: 'per_request', currency: 'USD', price: 0.01, unit: 'request' }
				},
				{ id: 'translate' }
			],
			mcp_metadata: {
				endpoint: 'https://vis-meta.example.com/mcp',
				transport: 'streamable-http',
				authentication: 'bearer',
				tools: [
					{
						name: 'do_thing',
						description: 'Does a thing',
						auth_required: true,
						pricing: { model: 'usage', currency: 'USD', price: 0.5, unit: '1k_tokens' }
					}
				]
			},
			pricing: { model: 'subscription', currency: 'USD', price: 9.99, unit: 'month' }
		};

		const reg = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		expect(reg.status).toBe(200);

		const res = await SELF.fetch('https://fake.host/lookup/vis-meta');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.visibility).toBe('for_hire');
		expect(body.capability_manifest).toEqual(payload.capability_manifest);
		expect(body.mcp_metadata).toEqual(payload.mcp_metadata);
		expect(body.pricing).toEqual(payload.pricing);
	});
});
