/**
 * Admin Audit Log Repository — operator-mutation journal.
 *
 * Every mutation performed through the admin control surface (settings,
 * invitations, branding, waitlist approvals) appends a row here. Kept
 * separate from telemetry_events, which is agent-centric and nullable on
 * actor fields. Backs the /admin/settings/audit UI.
 */

import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbClient } from '../client';
import { adminAuditLog, type AdminAuditLogRecord } from '../schema';

export interface AppendAuditInput {
	eventType: string;
	actorUserId?: string | null;
	actorEmail?: string | null;
	targetType?: string | null;
	targetId?: string | null;
	metadata?: Record<string, unknown> | null;
	ip?: string | null;
	userAgent?: string | null;
}

export interface ListAuditFilter {
	limit?: number;
	offset?: number;
	eventType?: string;
	actorEmail?: string;
}

/** Append a single audit row. Serialises `metadata` to JSON. */
export async function appendAudit(
	db: DbClient,
	input: AppendAuditInput
): Promise<AdminAuditLogRecord> {
	const id = `aud-${nanoid()}`;
	const now = Math.floor(Date.now() / 1000);
	const metadataJson =
		input.metadata === null || input.metadata === undefined ? null : JSON.stringify(input.metadata);

	const result = await db
		.insert(adminAuditLog)
		.values({
			id,
			eventType: input.eventType,
			actorUserId: input.actorUserId ?? null,
			actorEmail: input.actorEmail ?? null,
			targetType: input.targetType ?? null,
			targetId: input.targetId ?? null,
			metadata: metadataJson,
			ip: input.ip ?? null,
			userAgent: input.userAgent ?? null,
			createdAt: now
		})
		.returning();

	const row = result[0];
	if (!row) throw new Error('Failed to append audit row');
	return row;
}

/**
 * List audit rows newest-first with optional filters. `limit` defaults to
 * 50 and is capped at 500 to keep payload sizes reasonable.
 */
export async function listAudit(
	db: DbClient,
	filter: ListAuditFilter = {}
): Promise<AdminAuditLogRecord[]> {
	const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
	const offset = Math.max(filter.offset ?? 0, 0);

	const conditions = [] as ReturnType<typeof eq>[];
	if (filter.eventType) {
		conditions.push(eq(adminAuditLog.eventType, filter.eventType));
	}
	if (filter.actorEmail) {
		conditions.push(eq(adminAuditLog.actorEmail, filter.actorEmail.trim().toLowerCase()));
	}

	const where =
		conditions.length === 0
			? undefined
			: conditions.length === 1
				? conditions[0]
				: and(...conditions);

	return db.query.adminAuditLog.findMany({
		where,
		orderBy: [desc(adminAuditLog.createdAt)],
		limit,
		offset
	});
}

/** Total-count helper for pagination UI. */
export async function countAudit(db: DbClient, filter: ListAuditFilter = {}): Promise<number> {
	const conditions = [] as ReturnType<typeof eq>[];
	if (filter.eventType) conditions.push(eq(adminAuditLog.eventType, filter.eventType));
	if (filter.actorEmail) {
		conditions.push(eq(adminAuditLog.actorEmail, filter.actorEmail.trim().toLowerCase()));
	}
	const where =
		conditions.length === 0
			? undefined
			: conditions.length === 1
				? conditions[0]
				: and(...conditions);
	const rows = await db.query.adminAuditLog.findMany({ where });
	return rows.length;
}
