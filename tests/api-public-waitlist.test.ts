/**
 * POST /api/public/waitlist — public waitlist intake.
 *
 * Covers mode gating (404 when disabled), email validation (400), and the
 * happy path (200 + invitations row with status='waitlisted'). Email delivery
 * and audit logging are best-effort and tolerated as failures in tests.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { POST } from '../src/routes/api/public/waitlist/+server';
import { createDbClient } from '../src/lib/db/client';
import { ensureNodeSettings, updateNodeSettings } from '../src/lib/db/repositories/node-settings';
import { getInvitationByEmail } from '../src/lib/db/repositories/invitations';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
	}
}

const DDL = [
	`CREATE TABLE IF NOT EXISTS node_settings (
		id TEXT PRIMARY KEY DEFAULT 'default', auth_mode TEXT NOT NULL DEFAULT 'solo',
		waitlist_enabled INTEGER NOT NULL DEFAULT 0, default_role TEXT NOT NULL DEFAULT 'developer',
		owner_email TEXT, node_name TEXT, support_email TEXT,
		welcome_headline TEXT, welcome_body TEXT, brand_logo_url TEXT, brand_primary_color TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS invitations (
		id TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'developer',
		status TEXT NOT NULL DEFAULT 'invited', invited_by TEXT, invited_by_email TEXT,
		note TEXT, expires_at INTEGER, last_sent_at INTEGER, send_count INTEGER NOT NULL DEFAULT 0,
		accepted_at INTEGER, accepted_user_id TEXT, revoked_at INTEGER,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_email ON invitations(email)`,
	`CREATE TABLE IF NOT EXISTS admin_audit_log (
		id TEXT PRIMARY KEY NOT NULL, event_type TEXT NOT NULL,
		actor_user_id TEXT, actor_email TEXT, target_type TEXT, target_id TEXT,
		metadata TEXT, ip TEXT, user_agent TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()))`
];

function buildEvent(body: unknown, opts: { ip?: string } = {}) {
	const url = 'https://fake.host/api/public/waitlist';
	const req = new Request(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'CF-Connecting-IP': opts.ip ?? '10.0.0.99',
			'User-Agent': 'vitest/1.0'
		},
		body: JSON.stringify(body)
	});
	// Minimal cookie jar — welcome_ack issuance tolerates missing HMAC; we
	// don't assert on it here (covered in welcome-ack.test.ts).
	const store = new Map<string, string>();
	return {
		platform: { env },
		request: req,
		url: new URL(url),
		params: {},
		locals: {},
		cookies: {
			get: (n: string) => store.get(n),
			set: (n: string, v: string) => store.set(n, v),
			delete: (n: string) => store.delete(n),
			getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
			serialize: () => [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
		}
	};
}

async function resetDb() {
	for (const stmt of DDL) await env.DB.prepare(stmt).run();
	await env.DB.prepare('DELETE FROM invitations').run();
	await env.DB.prepare('DELETE FROM admin_audit_log').run();
	await env.DB.prepare('DELETE FROM node_settings').run();
	const db = createDbClient(env.DB);
	await ensureNodeSettings(db);
}

describe('POST /api/public/waitlist', () => {
	beforeAll(resetDb);
	beforeEach(resetDb);

	it('returns 404 when authMode!=invite (solo default)', async () => {
		const ev = buildEvent({ email: 'alice@example.com' }, { ip: '10.0.1.1' });
		const res = await POST(ev as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('waitlist_not_enabled');
	});

	it('returns 404 when authMode=invite but waitlistEnabled=false', async () => {
		const db = createDbClient(env.DB);
		await updateNodeSettings(db, { authMode: 'invite', waitlistEnabled: false });
		const ev = buildEvent({ email: 'alice@example.com' }, { ip: '10.0.1.2' });
		const res = await POST(ev as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(404);
	});

	it('returns 400 for an invalid email', async () => {
		const db = createDbClient(env.DB);
		await updateNodeSettings(db, { authMode: 'invite', waitlistEnabled: true });
		const ev = buildEvent({ email: 'not-an-email' }, { ip: '10.0.1.3' });
		const res = await POST(ev as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('invalid_email');
	});

	it('returns 400 for a malformed body', async () => {
		const db = createDbClient(env.DB);
		await updateNodeSettings(db, { authMode: 'invite', waitlistEnabled: true });
		const req = new Request('https://fake.host/api/public/waitlist', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'CF-Connecting-IP': '10.0.1.4'
			},
			body: '{not-json'
		});
		const ev = { ...buildEvent({}, { ip: '10.0.1.4' }), request: req };
		const res = await POST(ev as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
	});

	it('creates a waitlisted invitation on the happy path', async () => {
		const db = createDbClient(env.DB);
		await updateNodeSettings(db, { authMode: 'invite', waitlistEnabled: true });
		const ev = buildEvent({ email: 'HAPPY@Example.com', note: 'hi there' }, { ip: '10.0.1.5' });
		const res = await POST(ev as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe('waitlisted');

		const row = await getInvitationByEmail(db, 'happy@example.com');
		expect(row).not.toBeNull();
		expect(row?.status).toBe('waitlisted');
		expect(row?.note).toBe('hi there');
	});

	it('is idempotent — returns existing status without duplicating the row', async () => {
		const db = createDbClient(env.DB);
		await updateNodeSettings(db, { authMode: 'invite', waitlistEnabled: true });
		const first = await POST(
			buildEvent({ email: 'dup@example.com' }, { ip: '10.0.1.6' }) as unknown as Parameters<
				typeof POST
			>[0]
		);
		expect(first.status).toBe(200);
		const second = await POST(
			buildEvent({ email: 'dup@example.com' }, { ip: '10.0.1.6' }) as unknown as Parameters<
				typeof POST
			>[0]
		);
		expect(second.status).toBe(200);
		const body = (await second.json()) as { status: string };
		expect(body.status).toBe('waitlisted');
	});
});
