/**
 * Invitations Repository — operator-managed allowlist.
 *
 * Each row is both the invite record and the allowlist entry (no tokens).
 * The hooks.server.ts login gate checks for an `invited` or `accepted`
 * row matching the login email when auth_mode='invite'.
 */

import { eq, desc, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbClient } from '../client';
import { invitations, type InvitationRecord } from '../schema';

export type InvitationRole = 'developer' | 'viewer' | 'admin';
export type InvitationStatus = 'invited' | 'waitlisted' | 'accepted' | 'revoked' | 'expired';

export interface CreateInvitationInput {
	email: string;
	role?: InvitationRole;
	status?: InvitationStatus;
	invitedBy?: string | null;
	invitedByEmail?: string | null;
	note?: string | null;
	expiresAt?: number | null;
}

/** Normalize an email for comparison + storage (lowercase + trim). */
export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase();
}

/**
 * Insert a new invitation. Fails with a SQLite UNIQUE violation if the
 * email already exists — callers should catch and return a 409.
 */
export async function createInvitation(
	db: DbClient,
	input: CreateInvitationInput
): Promise<InvitationRecord> {
	const id = `inv-${nanoid()}`;
	const email = normalizeEmail(input.email);
	const now = Math.floor(Date.now() / 1000);

	const result = await db
		.insert(invitations)
		.values({
			id,
			email,
			role: input.role ?? 'developer',
			status: input.status ?? 'invited',
			invitedBy: input.invitedBy ?? null,
			invitedByEmail: input.invitedByEmail ?? null,
			note: input.note ?? null,
			expiresAt: input.expiresAt ?? null,
			sendCount: 0,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	const row = result[0];
	if (!row) throw new Error('Failed to create invitation');
	return row;
}

/** Find a single invitation by email (case-insensitive). */
export async function getInvitationByEmail(
	db: DbClient,
	email: string
): Promise<InvitationRecord | null> {
	const row = await db.query.invitations.findFirst({
		where: eq(invitations.email, normalizeEmail(email))
	});
	return row ?? null;
}

/** Find a single invitation by id. */
export async function getInvitationById(
	db: DbClient,
	id: string
): Promise<InvitationRecord | null> {
	const row = await db.query.invitations.findFirst({
		where: eq(invitations.id, id)
	});
	return row ?? null;
}

/** List invitations sorted newest-first, optionally filtered by status. */
export async function listInvitations(
	db: DbClient,
	filter?: { status?: InvitationStatus[] }
): Promise<InvitationRecord[]> {
	if (filter?.status?.length) {
		return db.query.invitations.findMany({
			where: inArray(invitations.status, filter.status),
			orderBy: [desc(invitations.createdAt)]
		});
	}
	return db.query.invitations.findMany({
		orderBy: [desc(invitations.createdAt)]
	});
}

/** Update status / role / note / send-tracking. Returns updated row. */
export async function updateInvitation(
	db: DbClient,
	id: string,
	patch: Partial<
		Pick<
			InvitationRecord,
			| 'role'
			| 'status'
			| 'note'
			| 'expiresAt'
			| 'lastSentAt'
			| 'sendCount'
			| 'acceptedAt'
			| 'acceptedUserId'
			| 'revokedAt'
		>
	>
): Promise<InvitationRecord | null> {
	const now = Math.floor(Date.now() / 1000);
	const result = await db
		.update(invitations)
		.set({ ...patch, updatedAt: now })
		.where(eq(invitations.id, id))
		.returning();
	return result[0] ?? null;
}

/** Soft-revoke an invitation. Preserves the row for audit. */
export async function revokeInvitation(db: DbClient, id: string): Promise<InvitationRecord | null> {
	const now = Math.floor(Date.now() / 1000);
	const result = await db
		.update(invitations)
		.set({ status: 'revoked', revokedAt: now, updatedAt: now })
		.where(and(eq(invitations.id, id), eq(invitations.status, 'invited')))
		.returning();
	return result[0] ?? null;
}

/** Delete an invitation permanently. Use sparingly. */
export async function deleteInvitation(db: DbClient, id: string): Promise<void> {
	await db.delete(invitations).where(eq(invitations.id, id));
}

/** Count invitations by status (for admin overview widgets). */
export async function countInvitationsByStatus(
	db: DbClient
): Promise<Record<InvitationStatus, number>> {
	const rows = await db.query.invitations.findMany();
	const counts: Record<InvitationStatus, number> = {
		invited: 0,
		waitlisted: 0,
		accepted: 0,
		revoked: 0,
		expired: 0
	};
	for (const r of rows) {
		const s = r.status as InvitationStatus;
		if (s in counts) counts[s]++;
	}
	return counts;
}
