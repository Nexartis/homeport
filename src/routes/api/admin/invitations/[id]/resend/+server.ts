/**
 * Admin Invitation Resend API — POST /api/admin/invitations/:id/resend
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { resendInvitation } from '$lib/services/invitations';
import { getSettings } from '$lib/services/node-settings';
import { appendAudit } from '$lib/db/repositories';
import { getActor, requireAdminRole, requireSiteOwner } from '$lib/server/auth-lanes';
import { auditContext, resolveBaseUrl } from '$lib/server/audit-helpers';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-invitations-resend');

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

	const baseUrl = resolveBaseUrl(event);
	const ctx = auditContext(event);

	try {
		const result = await resendInvitation(db, platform!.env, id, baseUrl);
		await appendAudit(db, {
			eventType: 'invitation.resent',
			...ctx,
			targetType: 'invitation',
			targetId: id,
			metadata: {
				email: result.invitation.email,
				emailSent: result.emailSent,
				emailError: result.emailError ?? null,
				sendCount: result.invitation.sendCount
			}
		});
		return json({
			invitation: result.invitation,
			emailSent: result.emailSent,
			emailError: result.emailError
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg === 'invitation_not_found') {
			return json({ error: 'Invitation not found' }, { status: 404 });
		}
		if (msg.startsWith('invitation_not_resendable:')) {
			return json(
				{ error: 'Invitation is not in a resendable state', status: msg.split(':')[1] },
				{ status: 409 }
			);
		}
		log.error('POST', 'Failed to resend invitation', { error: msg });
		return json({ error: 'Failed to resend invitation' }, { status: 500 });
	}
};
