/**
 * Admin Invitation Revoke API — POST /api/admin/invitations/:id/revoke
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { revokeInvitation, getInvitationById, appendAudit } from '$lib/db/repositories';
import { getSettings } from '$lib/services/node-settings';
import { getActor, requireAdminRole, requireSiteOwner } from '$lib/server/auth-lanes';
import { auditContext } from '$lib/server/audit-helpers';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-invitations-revoke');

export const POST: RequestHandler = async (event) => {
	const { platform, locals, params } = event;
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'POST' });
	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const db = createDbClient(d1);
	const settings = await getSettings(db);
	const envOwnerEmail = (platform?.env as { SITE_OWNER_EMAIL?: string } | undefined)
		?.SITE_OWNER_EMAIL;
	requireSiteOwner(actor, settings.ownerEmail, envOwnerEmail, { log, fn: 'POST' });

	const { id } = params;
	if (!id) return json({ error: 'Missing invitation id' }, { status: 400 });

	const existing = await getInvitationById(db, id);
	if (!existing) return json({ error: 'Invitation not found' }, { status: 404 });

	try {
		const updated = await revokeInvitation(db, id);
		if (!updated) {
			// Already revoked, accepted, etc. — treat as 409.
			return json(
				{ error: 'Invitation is not in a revokable state', status: existing.status },
				{ status: 409 }
			);
		}
		const ctx = auditContext(event);
		await appendAudit(db, {
			eventType: 'invitation.revoked',
			...ctx,
			targetType: 'invitation',
			targetId: id,
			metadata: { email: updated.email, role: updated.role, priorStatus: existing.status }
		});
		return json({ invitation: updated });
	} catch (err) {
		log.error('POST', 'Failed to revoke invitation', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to revoke invitation' }, { status: 500 });
	}
};
