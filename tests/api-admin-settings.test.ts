/**
 * Admin Settings API — unit tests that exercise the handlers directly.
 *
 * Bypasses the auth hook by constructing synthetic RequestEvents; the
 * handlers themselves enforce requireAdmin + requireOwner.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { GET, PATCH } from '../src/routes/api/admin/settings/+server';
import { createDbClient } from '../src/lib/db/client';
import { ensureNodeSettings, updateNodeSettings } from '../src/lib/db/repositories/node-settings';
import { listAudit } from '../src/lib/db/repositories/admin-audit-log';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const SETTINGS_DDL = `CREATE TABLE IF NOT EXISTS node_settings (
	id TEXT PRIMARY KEY DEFAULT 'default', auth_mode TEXT NOT NULL DEFAULT 'solo',
	waitlist_enabled INTEGER NOT NULL DEFAULT 0, default_role TEXT NOT NULL DEFAULT 'developer',
	owner_email TEXT, node_name TEXT, support_email TEXT,
	welcome_headline TEXT, welcome_body TEXT, brand_logo_url TEXT, brand_primary_color TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`;

const AUDIT_DDL = `CREATE TABLE IF NOT EXISTS admin_audit_log (
	id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL,
	actor_user_id TEXT, actor_email TEXT, target_type TEXT, target_id TEXT,
	metadata TEXT, ip TEXT, user_agent TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()))`;

const OWNER_EMAIL = 'owner@example.com';

async function seed() {
	await env.DB.prepare(SETTINGS_DDL).run();
	await env.DB.prepare(AUDIT_DDL).run();
	await env.DB.prepare('DELETE FROM node_settings').run();
	await env.DB.prepare('DELETE FROM admin_audit_log').run();
	const db = createDbClient(env.DB);
	await ensureNodeSettings(db);
	await updateNodeSettings(db, { ownerEmail: OWNER_EMAIL, authMode: 'solo' });
}

function buildEvent(overrides: {
	user: { id: string; email: string; roles: string[] } | null;
	method: string;
	body?: unknown;
	url?: string;
}) {
	const url = overrides.url ?? 'https://fake.host/api/admin/settings';
	const req = new Request(url, {
		method: overrides.method,
		headers: {
			'Content-Type': 'application/json',
			'CF-Connecting-IP': '10.0.0.1',
			'User-Agent': 'vitest/1.0'
		},
		body: overrides.body ? JSON.stringify(overrides.body) : undefined
	});
	return {
		platform: { env },
		locals: {
			user: overrides.user ? { isAuthenticated: true, ...overrides.user } : null
		},
		request: req,
		url: new URL(url),
		params: {}
	} as unknown;
}

beforeAll(async () => {
	await seed();
});

describe('/api/admin/settings', () => {
	it('GET returns settings for admin', async () => {
		const ev = buildEvent({
			user: { id: 'u1', email: 'admin@example.com', roles: ['admin'] },
			method: 'GET'
		});
		const res = await GET(ev as Parameters<typeof GET>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { settings: { ownerEmail: string; authMode: string } };
		expect(body.settings.ownerEmail).toBe(OWNER_EMAIL);
	});

	it('GET returns 403 for non-admin user', async () => {
		const ev = buildEvent({
			user: { id: 'u2', email: 'viewer@example.com', roles: ['viewer'] },
			method: 'GET'
		});
		await expect(GET(ev as Parameters<typeof GET>[0])).rejects.toMatchObject({ status: 403 });
	});

	it('PATCH returns 403 when admin is not owner', async () => {
		const ev = buildEvent({
			user: { id: 'u3', email: 'other-admin@example.com', roles: ['admin'] },
			method: 'PATCH',
			body: { authMode: 'invite' }
		});
		await expect(PATCH(ev as Parameters<typeof PATCH>[0])).rejects.toMatchObject({ status: 403 });
	});

	it('PATCH persists changes + emits settings.updated audit row (owner)', async () => {
		const ev = buildEvent({
			user: { id: 'u4', email: OWNER_EMAIL, roles: ['admin'] },
			method: 'PATCH',
			body: { nodeName: 'My Node', defaultRole: 'viewer' }
		});
		const res = await PATCH(ev as Parameters<typeof PATCH>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { changed: string[]; settings: { nodeName: string } };
		expect(body.settings.nodeName).toBe('My Node');
		expect(body.changed).toEqual(expect.arrayContaining(['nodeName', 'defaultRole']));

		const db = createDbClient(env.DB);
		const audit = await listAudit(db, { eventType: 'settings.updated', limit: 5 });
		expect(audit.length).toBeGreaterThan(0);
		expect(audit[0].actorEmail).toBe(OWNER_EMAIL);
		expect(audit[0].ip).toBe('10.0.0.1');
	});

	it('PATCH emits settings.auth_mode_changed when authMode changes', async () => {
		const ev = buildEvent({
			user: { id: 'u4', email: OWNER_EMAIL, roles: ['admin'] },
			method: 'PATCH',
			body: { authMode: 'invite' }
		});
		const res = await PATCH(ev as Parameters<typeof PATCH>[0]);
		expect(res.status).toBe(200);

		const db = createDbClient(env.DB);
		const audit = await listAudit(db, { eventType: 'settings.auth_mode_changed', limit: 5 });
		expect(audit.length).toBeGreaterThan(0);
		const meta = JSON.parse(audit[0].metadata ?? '{}');
		expect(meta.from).toBe('solo');
		expect(meta.to).toBe('invite');
	});

	it('PATCH rejects invalid authMode with 400', async () => {
		const ev = buildEvent({
			user: { id: 'u4', email: OWNER_EMAIL, roles: ['admin'] },
			method: 'PATCH',
			body: { authMode: 'bogus' }
		});
		const res = await PATCH(ev as Parameters<typeof PATCH>[0]);
		expect(res.status).toBe(400);
	});
});
