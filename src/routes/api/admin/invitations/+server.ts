/**
 * Admin Invitations API — GET (list) + POST (create & send).
 *
 * GET  ?status=invited,accepted  → list invitations (admin).
 * POST                          → create invitation + optionally send email
 *                                (owner-only). Conflict on duplicate email.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { listInvitations, createAndSend } from '$lib/services/invitations';
import { getSettings } from '$lib/services/node-settings';
import type { InvitationStatus, InvitationRole } from '$lib/db/repositories';
import { appendAudit } from '$lib/db/repositories';
import { getActor, requireAdminRole, requireSiteOwner } from '$lib/server/auth-lanes';
import { auditContext, resolveBaseUrl } from '$lib/server/audit-helpers';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-invitations');

const ALLOWED_STATUSES = new Set<InvitationStatus>([
	'invited',
	'waitlisted',
	'accepted',
	'revoked',
	'expired'
]);
const ALLOWED_ROLES = new Set<InvitationRole>(['developer', 'viewer', 'admin']);

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'GET' });
	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const statusParam = url.searchParams.get('status');
	const statusFilter: InvitationStatus[] = [];
	if (statusParam) {
		for (const raw of statusParam.split(',').map((s) => s.trim())) {
			if (ALLOWED_STATUSES.has(raw as InvitationStatus)) {
				statusFilter.push(raw as InvitationStatus);
			}
		}
	}

	try {
		const db = createDbClient(d1);
		const invitations = await listInvitations(
			db,
			statusFilter.length ? { status: statusFilter } : undefined
		);
		return json({ invitations });
	} catch (err) {
		log.error('GET', 'Failed to list invitations', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to list invitations' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const { platform, locals, request } = event;
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'POST' });

	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const db = createDbClient(d1);
	const settings = await getSettings(db);
	const envOwnerEmail = (platform?.env as { SITE_OWNER_EMAIL?: string } | undefined)
		?.SITE_OWNER_EMAIL;
	requireSiteOwner(actor, settings.ownerEmail, envOwnerEmail, { log, fn: 'POST' });

	let body: {
		email?: string;
		role?: string;
		note?: string;
		expiresAt?: number;
		skipEmail?: boolean;
	};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const email = typeof body.email === 'string' ? body.email.trim() : '';
	if (!email || !email.includes('@')) {
		return json({ error: 'Valid email is required' }, { status: 400 });
	}

	const role = body.role ?? 'developer';
	if (!ALLOWED_ROLES.has(role as InvitationRole)) {
		return json({ error: `Invalid role: ${role}` }, { status: 400 });
	}

	const ctx = auditContext(event);
	const baseUrl = resolveBaseUrl(event);

	try {
		const result = await createAndSend(db, platform!.env, {
			email,
			role: role as InvitationRole,
			note: body.note ?? null,
			expiresAt: body.expiresAt ?? null,
			invitedBy: locals.user?.id ?? null,
			invitedByEmail: locals.user?.email ?? null,
			skipEmail: body.skipEmail === true,
			baseUrl
		});

		await appendAudit(db, {
			eventType: 'invitation.created',
			...ctx,
			targetType: 'invitation',
			targetId: result.invitation.id,
			metadata: {
				email: result.invitation.email,
				role: result.invitation.role,
				skipEmail: body.skipEmail === true,
				emailSent: result.emailSent,
				emailError: result.emailError ?? null
			}
		});

		if (result.emailSent) {
			await appendAudit(db, {
				eventType: 'invitation.email_sent',
				...ctx,
				targetType: 'invitation',
				targetId: result.invitation.id,
				metadata: { email: result.invitation.email }
			});
		}

		return json(
			{ invitation: result.invitation, emailSent: result.emailSent, emailError: result.emailError },
			{ status: 201 }
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.startsWith('invitation_exists:')) {
			const existingId = msg.slice('invitation_exists:'.length);
			return json(
				{ error: 'Invitation already exists for this email', existingId },
				{ status: 409 }
			);
		}
		log.error('POST', 'Failed to create invitation', { error: msg });
		return json({ error: 'Failed to create invitation' }, { status: 500 });
	}
};
