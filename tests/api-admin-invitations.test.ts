/**
 * Admin Invitations API — end-to-end lifecycle + audit assertions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { GET as listGET, POST as createPOST } from '../src/routes/api/admin/invitations/+server';
import {
	PATCH as patchPATCH,
	DELETE as deleteDELETE
} from '../src/routes/api/admin/invitations/[id]/+server';
import { POST as resendPOST } from '../src/routes/api/admin/invitations/[id]/resend/+server';
import { POST as revokePOST } from '../src/routes/api/admin/invitations/[id]/revoke/+server';
import { createDbClient } from '../src/lib/db/client';
import { ensureNodeSettings, updateNodeSettings } from '../src/lib/db/repositories/node-settings';
import { listAudit } from '../src/lib/db/repositories/admin-audit-log';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
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

const OWNER_EMAIL = 'owner@example.com';

function buildEvent(opts: {
	user: { id: string; email: string; roles: string[] } | null;
	method: string;
	body?: unknown;
	params?: Record<string, string>;
	url?: string;
}) {
	const url = opts.url ?? 'https://fake.host/api/admin/invitations';
	const req = new Request(url, {
		method: opts.method,
		headers: {
			'Content-Type': 'application/json',
			'CF-Connecting-IP': '10.0.0.1',
			'User-Agent': 'vitest'
		},
		body: opts.body ? JSON.stringify(opts.body) : undefined
	});
	return {
		platform: { env },
		locals: {
			user: opts.user ? { isAuthenticated: true, ...opts.user } : null
		},
		request: req,
		url: new URL(url),
		params: opts.params ?? {}
	} as unknown;
}

const ownerUser = { id: 'owner-1', email: OWNER_EMAIL, roles: ['admin'] };
const nonOwnerUser = { id: 'stranger', email: 'stranger@example.com', roles: ['admin'] };

beforeAll(async () => {
	for (const stmt of DDL) await env.DB.prepare(stmt).run();
	await env.DB.prepare('DELETE FROM invitations').run();
	await env.DB.prepare('DELETE FROM admin_audit_log').run();
	await env.DB.prepare('DELETE FROM node_settings').run();
	const db = createDbClient(env.DB);
	await ensureNodeSettings(db);
	await updateNodeSettings(db, { ownerEmail: OWNER_EMAIL });
});

describe('/api/admin/invitations lifecycle', () => {
	let inviteId = '';

	it('POST rejects non-owner with 403', async () => {
		const ev = buildEvent({
			user: nonOwnerUser,
			method: 'POST',
			body: { email: 'someone@example.com' }
		});
		await expect(createPOST(ev as Parameters<typeof createPOST>[0])).rejects.toMatchObject({
			status: 403
		});
	});

	it('POST creates an invitation + emits invitation.created audit row', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'POST',
			body: { email: 'new-user@example.com', role: 'developer', skipEmail: true }
		});
		const res = await createPOST(ev as Parameters<typeof createPOST>[0]);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { invitation: { id: string; email: string } };
		expect(body.invitation.email).toBe('new-user@example.com');
		inviteId = body.invitation.id;

		const audit = await listAudit(createDbClient(env.DB), {
			eventType: 'invitation.created',
			limit: 5
		});
		expect(audit[0].targetId).toBe(inviteId);
		expect(audit[0].actorEmail).toBe(OWNER_EMAIL);
	});

	it('POST duplicate email returns 409', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'POST',
			body: { email: 'new-user@example.com', skipEmail: true }
		});
		const res = await createPOST(ev as Parameters<typeof createPOST>[0]);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { existingId: string };
		expect(body.existingId).toBe(inviteId);
	});

	it('GET lists invitations for admin', async () => {
		const ev = buildEvent({ user: ownerUser, method: 'GET' });
		const res = await listGET(ev as Parameters<typeof listGET>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { invitations: Array<{ id: string }> };
		expect(body.invitations.some((i) => i.id === inviteId)).toBe(true);
	});

	it('PATCH updates role + emits invitation.updated audit row', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'PATCH',
			body: { role: 'viewer', note: 'demoted to viewer' },
			params: { id: inviteId }
		});
		const res = await patchPATCH(ev as Parameters<typeof patchPATCH>[0]);
		expect(res.status).toBe(200);
		const audit = await listAudit(createDbClient(env.DB), {
			eventType: 'invitation.updated',
			limit: 5
		});
		expect(audit[0].targetId).toBe(inviteId);
	});

	it('POST /resend emits invitation.resent audit row', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'POST',
			params: { id: inviteId }
		});
		const res = await resendPOST(ev as Parameters<typeof resendPOST>[0]);
		expect(res.status).toBe(200);
		const audit = await listAudit(createDbClient(env.DB), {
			eventType: 'invitation.resent',
			limit: 5
		});
		expect(audit[0].targetId).toBe(inviteId);
	});

	it('POST /revoke emits invitation.revoked audit row + flips status', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'POST',
			params: { id: inviteId }
		});
		const res = await revokePOST(ev as Parameters<typeof revokePOST>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { invitation: { status: string } };
		expect(body.invitation.status).toBe('revoked');
		const audit = await listAudit(createDbClient(env.DB), {
			eventType: 'invitation.revoked',
			limit: 5
		});
		expect(audit[0].targetId).toBe(inviteId);
	});

	it('DELETE removes the invitation + emits invitation.deleted audit row', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'DELETE',
			params: { id: inviteId }
		});
		const res = await deleteDELETE(ev as Parameters<typeof deleteDELETE>[0]);
		expect(res.status).toBe(200);
		const audit = await listAudit(createDbClient(env.DB), {
			eventType: 'invitation.deleted',
			limit: 5
		});
		expect(audit[0].targetId).toBe(inviteId);
		const meta = JSON.parse(audit[0].metadata ?? '{}');
		expect(meta.email).toBe('new-user@example.com');
	});

	it('DELETE on a missing id returns 404', async () => {
		const ev = buildEvent({
			user: ownerUser,
			method: 'DELETE',
			params: { id: 'inv-missing' }
		});
		const res = await deleteDELETE(ev as Parameters<typeof deleteDELETE>[0]);
		expect(res.status).toBe(404);
	});
});
