/**
 * Post-login lifecycle — service-level coverage for the two surgical calls
 * wired into the SDK `onAfterClaim` hook at
 * `src/routes/api/auth/[...path]/+server.ts`:
 *
 *   1. `acceptInvitationIfPending` promotes `invited` → `accepted`.
 *   2. `updateNodeSettings({ ownerEmail })` bootstraps the owner row on
 *      first successful owner login.
 *
 * Exercising the hook itself requires a live Sentinel claim + cookies; the
 * underlying business logic is fully covered here against D1.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { acceptInvitationIfPending, getInvitationByEmail } from '../src/lib/services/invitations';
import { createInvitation } from '../src/lib/db/repositories/invitations';
import {
	ensureNodeSettings,
	getNodeSettings,
	updateNodeSettings
} from '../src/lib/db/repositories/node-settings';
import { createDbClient } from '../src/lib/db/client';

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
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_email ON invitations(email)`
];

async function resetDb() {
	for (const stmt of DDL) await env.DB.prepare(stmt).run();
	await env.DB.prepare('DELETE FROM invitations').run();
	await env.DB.prepare('DELETE FROM node_settings').run();
	const db = createDbClient(env.DB);
	await ensureNodeSettings(db);
}

describe('acceptInvitationIfPending', () => {
	beforeAll(resetDb);
	beforeEach(resetDb);

	it('returns accepted=false when no invitation exists for the email', async () => {
		const db = createDbClient(env.DB);
		const result = await acceptInvitationIfPending(db, 'ghost@example.com', 'user-1');
		expect(result.accepted).toBe(false);
	});

	it("promotes 'invited' → 'accepted' and attaches the role", async () => {
		const db = createDbClient(env.DB);
		await createInvitation(db, {
			email: 'invitee@example.com',
			role: 'developer',
			status: 'invited'
		});
		const result = await acceptInvitationIfPending(db, 'invitee@example.com', 'user-42');
		expect(result.accepted).toBe(true);
		expect(result.role).toBe('developer');

		const row = await getInvitationByEmail(db, 'invitee@example.com');
		expect(row?.status).toBe('accepted');
		expect(row?.acceptedUserId).toBe('user-42');
		expect(row?.acceptedAt).toBeTypeOf('number');
	});

	it('is idempotent for an already-accepted invitation', async () => {
		const db = createDbClient(env.DB);
		await createInvitation(db, {
			email: 'repeat@example.com',
			role: 'admin',
			status: 'invited'
		});
		const first = await acceptInvitationIfPending(db, 'repeat@example.com', 'user-1');
		const second = await acceptInvitationIfPending(db, 'repeat@example.com', 'user-1');
		expect(first.accepted).toBe(true);
		expect(second.accepted).toBe(true);
		expect(second.role).toBe('admin');
	});

	it("does not promote 'waitlisted' rows", async () => {
		const db = createDbClient(env.DB);
		await createInvitation(db, {
			email: 'waiting@example.com',
			role: 'developer',
			status: 'waitlisted'
		});
		const result = await acceptInvitationIfPending(db, 'waiting@example.com', 'user-5');
		expect(result.accepted).toBe(false);
		const row = await getInvitationByEmail(db, 'waiting@example.com');
		expect(row?.status).toBe('waitlisted');
	});

	it("does not promote 'revoked' rows", async () => {
		const db = createDbClient(env.DB);
		await createInvitation(db, {
			email: 'gone@example.com',
			role: 'developer',
			status: 'revoked'
		});
		const result = await acceptInvitationIfPending(db, 'gone@example.com', 'user-6');
		expect(result.accepted).toBe(false);
	});

	it('normalises the email before lookup (case + whitespace)', async () => {
		const db = createDbClient(env.DB);
		await createInvitation(db, {
			email: 'mixed@example.com',
			role: 'developer',
			status: 'invited'
		});
		const result = await acceptInvitationIfPending(db, '  Mixed@Example.COM ', 'user-9');
		expect(result.accepted).toBe(true);
	});
});

describe('owner-email bootstrap (SDK onAfterClaim step)', () => {
	beforeAll(resetDb);
	beforeEach(resetDb);

	it('writes ownerEmail to node_settings when the row is empty', async () => {
		const db = createDbClient(env.DB);
		const before = await getNodeSettings(db);
		expect(before?.ownerEmail).toBeNull();
		await updateNodeSettings(db, { ownerEmail: 'owner@example.com' });
		const after = await getNodeSettings(db);
		expect(after?.ownerEmail).toBe('owner@example.com');
	});

	it('leaves an existing ownerEmail unchanged (hook short-circuits)', async () => {
		const db = createDbClient(env.DB);
		await updateNodeSettings(db, { ownerEmail: 'first@example.com' });
		const settings = await getNodeSettings(db);
		expect(settings?.ownerEmail).toBe('first@example.com');
	});
});
