/**
 * Admin Audit Log Repository — unit tests for appendAudit + listAudit.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { appendAudit, listAudit, countAudit } from '../src/lib/db/repositories/admin-audit-log';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const DDL = `CREATE TABLE IF NOT EXISTS admin_audit_log (
	id TEXT PRIMARY KEY NOT NULL,
	event_type TEXT NOT NULL,
	actor_user_id TEXT,
	actor_email TEXT,
	target_type TEXT,
	target_id TEXT,
	metadata TEXT,
	ip TEXT,
	user_agent TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`;

beforeAll(async () => {
	await env.DB.prepare(DDL).run();
	await env.DB.prepare('DELETE FROM admin_audit_log').run();
});

describe('admin_audit_log repository', () => {
	it('appendAudit inserts a row with auto id and serialised metadata', async () => {
		const db = createDbClient(env.DB);
		const row = await appendAudit(db, {
			eventType: 'test.event',
			actorEmail: 'owner@example.com',
			targetType: 'invitation',
			targetId: 'inv-1',
			metadata: { from: 'a', to: 'b' },
			ip: '1.2.3.4',
			userAgent: 'vitest'
		});
		expect(row.id).toMatch(/^aud-/);
		expect(row.eventType).toBe('test.event');
		expect(row.metadata).toBe(JSON.stringify({ from: 'a', to: 'b' }));
		expect(row.createdAt).toBeGreaterThan(0);
	});

	it('listAudit returns newest first', async () => {
		const db = createDbClient(env.DB);
		await appendAudit(db, { eventType: 'test.a', actorEmail: 'one@example.com' });
		await new Promise((r) => setTimeout(r, 10));
		await appendAudit(db, { eventType: 'test.b', actorEmail: 'two@example.com' });
		const rows = await listAudit(db, { limit: 10 });
		expect(rows.length).toBeGreaterThanOrEqual(2);
		// first row should have >= createdAt of the next
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i - 1].createdAt).toBeGreaterThanOrEqual(rows[i].createdAt);
		}
	});

	it('listAudit filters by eventType', async () => {
		const db = createDbClient(env.DB);
		await appendAudit(db, { eventType: 'settings.auth_mode_changed' });
		await appendAudit(db, { eventType: 'invitation.created' });
		const rows = await listAudit(db, { eventType: 'settings.auth_mode_changed', limit: 50 });
		expect(rows.every((r) => r.eventType === 'settings.auth_mode_changed')).toBe(true);
		expect(rows.length).toBeGreaterThanOrEqual(1);
	});

	it('listAudit filters by actorEmail case-insensitively', async () => {
		const db = createDbClient(env.DB);
		await appendAudit(db, { eventType: 'x.match', actorEmail: 'match@example.com' });
		const rows = await listAudit(db, { actorEmail: 'MATCH@example.com', limit: 50 });
		expect(rows.some((r) => r.eventType === 'x.match')).toBe(true);
	});

	it('listAudit respects limit + offset', async () => {
		const db = createDbClient(env.DB);
		for (let i = 0; i < 5; i++) {
			await appendAudit(db, { eventType: 'pagination.test' });
		}
		const page1 = await listAudit(db, { eventType: 'pagination.test', limit: 2, offset: 0 });
		const page2 = await listAudit(db, { eventType: 'pagination.test', limit: 2, offset: 2 });
		expect(page1.length).toBe(2);
		expect(page2.length).toBe(2);
		expect(page1[0].id).not.toBe(page2[0].id);
	});

	it('countAudit returns totals matching filters', async () => {
		const db = createDbClient(env.DB);
		const totalAll = await countAudit(db);
		const totalFiltered = await countAudit(db, { eventType: 'pagination.test' });
		expect(totalAll).toBeGreaterThan(totalFiltered);
		expect(totalFiltered).toBeGreaterThanOrEqual(5);
	});

	it('appendAudit handles null metadata + optional fields', async () => {
		const db = createDbClient(env.DB);
		const row = await appendAudit(db, { eventType: 'minimal.event' });
		expect(row.metadata).toBeNull();
		expect(row.actorEmail).toBeNull();
		expect(row.ip).toBeNull();
	});
});
