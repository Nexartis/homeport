/**
 * Admin Invitation API — PATCH / DELETE a single invitation by id.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import {
	getInvitationById,
	updateInvitation,
	deleteInvitation,
	appendAudit
} from '$lib/db/repositories';
import type { InvitationRole } from '$lib/db/repositories';
import { getSettings } from '$lib/services/node-settings';
import { getActor, requireAdminRole, requireSiteOwner } from '$lib/server/auth-lanes';
import { auditContext } from '$lib/server/audit-helpers';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-invitations-id');

const ALLOWED_ROLES = new Set<InvitationRole>(['developer', 'viewer', 'admin']);

export const PATCH: RequestHandler = async (event) => {
	const { platform, locals, request, params } = event;
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'PATCH' });
	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const db = createDbClient(d1);
	const settings = await getSettings(db);
	const envOwnerEmail = (platform?.env as { SITE_OWNER_EMAIL?: string } | undefined)
		?.SITE_OWNER_EMAIL;
	requireSiteOwner(actor, settings.ownerEmail, envOwnerEmail, { log, fn: 'PATCH' });

	const { id } = params;
	if (!id) return json({ error: 'Missing invitation id' }, { status: 400 });

	const existing = await getInvitationById(db, id);
	if (!existing) return json({ error: 'Invitation not found' }, { status: 404 });

	let body: { role?: string; note?: string | null; expiresAt?: number | null };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const patch: Parameters<typeof updateInvitation>[2] = {};
	if (body.role !== undefined) {
		if (!ALLOWED_ROLES.has(body.role as InvitationRole)) {
			return json({ error: `Invalid role: ${body.role}` }, { status: 400 });
		}
		patch.role = body.role;
	}
	if (body.note !== undefined) patch.note = body.note;
	if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt;

	if (Object.keys(patch).length === 0) {
		return json({ error: 'No updatable fields provided' }, { status: 400 });
	}

	try {
		const updated = await updateInvitation(db, id, patch);
		if (!updated) return json({ error: 'Invitation not found' }, { status: 404 });

		const ctx = auditContext(event);
		const diff: Record<string, { from: unknown; to: unknown }> = {};
		for (const key of Object.keys(patch)) {
			const before = (existing as Record<string, unknown>)[key];
			const after = (updated as Record<string, unknown>)[key];
			if (before !== after) diff[key] = { from: before, to: after };
		}
		await appendAudit(db, {
			eventType: 'invitation.updated',
			...ctx,
			targetType: 'invitation',
			targetId: id,
			metadata: { email: updated.email, changed: Object.keys(diff), diff }
		});

		return json({ invitation: updated });
	} catch (err) {
		log.error('PATCH', 'Failed to update invitation', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to update invitation' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { platform, locals, params } = event;
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'DELETE' });
	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const db = createDbClient(d1);
	const settings = await getSettings(db);
	const envOwnerEmail = (platform?.env as { SITE_OWNER_EMAIL?: string } | undefined)
		?.SITE_OWNER_EMAIL;
	requireSiteOwner(actor, settings.ownerEmail, envOwnerEmail, { log, fn: 'DELETE' });

	const { id } = params;
	if (!id) return json({ error: 'Missing invitation id' }, { status: 400 });

	const existing = await getInvitationById(db, id);
	if (!existing) return json({ error: 'Invitation not found' }, { status: 404 });

	try {
		await deleteInvitation(db, id);
		const ctx = auditContext(event);
		await appendAudit(db, {
			eventType: 'invitation.deleted',
			...ctx,
			targetType: 'invitation',
			targetId: id,
			metadata: {
				email: existing.email,
				role: existing.role,
				status: existing.status,
				prior: existing
			}
		});
		return json({ deleted: true, id });
	} catch (err) {
		log.error('DELETE', 'Failed to delete invitation', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to delete invitation' }, { status: 500 });
	}
};
