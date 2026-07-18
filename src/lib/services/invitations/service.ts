/**
 * Invitations Service — create, list, revoke, and accept invitations.
 *
 * The invitation row itself is the allowlist entry; there is no signed
 * token. Creating an invitation optionally triggers a Resend email that
 * points the invitee at /auth (standard Sentinel magic-link flow).
 */

import type { DbClient } from '$lib/db/client';
import {
	createInvitation,
	getInvitationByEmail,
	getInvitationById,
	listInvitations,
	updateInvitation,
	revokeInvitation,
	deleteInvitation,
	countInvitationsByStatus,
	normalizeEmail,
	type CreateInvitationInput,
	type InvitationStatus
} from '$lib/db/repositories';
import type { InvitationRecord } from '$lib/db/schema';
import { getSettings } from '$lib/services/node-settings';
import { sendInvitationEmail } from '$lib/email';
import { createLogger } from '$lib/utils/logger';
import type { AcceptInvitationResult, UserRole } from '$lib/services/node-settings/types';

const log = createLogger(undefined, 'invitations');

export interface CreateAndSendInput extends CreateInvitationInput {
	/** Absolute base URL (used to build the /auth link). */
	baseUrl: string;
	/** When true, skip the Resend email dispatch (operator will copy-share). */
	skipEmail?: boolean;
}

export interface CreateAndSendResult {
	invitation: InvitationRecord;
	emailSent: boolean;
	emailError?: string;
}

/**
 * Create a new invitation and optionally send the Resend email.
 * Returns the row + whether the email was dispatched.
 */
export async function createAndSend(
	db: DbClient,
	env: App.Platform['env'],
	input: CreateAndSendInput
): Promise<CreateAndSendResult> {
	const existing = await getInvitationByEmail(db, input.email);
	if (existing) {
		throw new Error(`invitation_exists:${existing.id}`);
	}

	const invitation = await createInvitation(db, input);

	if (input.skipEmail) {
		return { invitation, emailSent: false };
	}

	const settings = await getSettings(db);
	const result = await sendInvitationEmail(env, {
		to: invitation.email,
		baseUrl: input.baseUrl,
		nodeName: settings.nodeName ?? undefined,
		invitedByEmail: invitation.invitedByEmail ?? undefined,
		note: invitation.note ?? undefined,
		supportEmail: settings.supportEmail ?? undefined
	});

	const now = Math.floor(Date.now() / 1000);
	await updateInvitation(db, invitation.id, {
		lastSentAt: now,
		sendCount: invitation.sendCount + (result.sent ? 1 : 0)
	});

	if (!result.sent) {
		log.warn('createAndSend', 'Invitation created but email delivery failed', {
			invitationId: invitation.id,
			error: result.error
		});
	}

	return { invitation, emailSent: result.sent, emailError: result.error };
}

/** Re-send the invitation email for an existing row. */
export async function resendInvitation(
	db: DbClient,
	env: App.Platform['env'],
	id: string,
	baseUrl: string
): Promise<CreateAndSendResult> {
	const invitation = await getInvitationById(db, id);
	if (!invitation) throw new Error('invitation_not_found');
	if (invitation.status !== 'invited' && invitation.status !== 'waitlisted') {
		throw new Error(`invitation_not_resendable:${invitation.status}`);
	}

	const settings = await getSettings(db);
	const result = await sendInvitationEmail(env, {
		to: invitation.email,
		baseUrl,
		nodeName: settings.nodeName ?? undefined,
		invitedByEmail: invitation.invitedByEmail ?? undefined,
		note: invitation.note ?? undefined,
		supportEmail: settings.supportEmail ?? undefined
	});

	const now = Math.floor(Date.now() / 1000);
	const updated = await updateInvitation(db, id, {
		lastSentAt: now,
		sendCount: invitation.sendCount + (result.sent ? 1 : 0)
	});

	return { invitation: updated ?? invitation, emailSent: result.sent, emailError: result.error };
}

/**
 * Called from hooks.server.ts after a successful magic-link claim. If the
 * email matches a pending invitation, promote it to 'accepted' and return
 * the associated role so the hook can attach it to the session.
 */
export async function acceptInvitationIfPending(
	db: DbClient,
	email: string,
	userId: string
): Promise<AcceptInvitationResult> {
	const normalized = normalizeEmail(email);
	const invitation = await getInvitationByEmail(db, normalized);
	if (!invitation) return { accepted: false };

	if (invitation.status === 'accepted') {
		return {
			accepted: true,
			invitationId: invitation.id,
			role: invitation.role as UserRole
		};
	}
	if (invitation.status !== 'invited') {
		return { accepted: false };
	}

	const now = Math.floor(Date.now() / 1000);
	const updated = await updateInvitation(db, invitation.id, {
		status: 'accepted',
		acceptedAt: now,
		acceptedUserId: userId
	});

	return {
		accepted: !!updated,
		invitationId: invitation.id,
		role: (updated?.role ?? invitation.role) as UserRole
	};
}

// Re-export the base CRUD helpers that admin UIs need.
export {
	listInvitations,
	revokeInvitation,
	deleteInvitation,
	countInvitationsByStatus,
	updateInvitation,
	getInvitationById,
	getInvitationByEmail,
	type InvitationStatus
};
