/**
 * Admin Node Settings API — GET / PATCH
 *
 * GET   → return the singleton node_settings row (admin).
 * PATCH → update node_settings (owner-only). Diffs old vs new, appends
 *         matching rows to admin_audit_log.
 *
 * Protected by /api/admin auth guard in hooks.server.ts (401 if no session).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getSettings, updateSettings } from '$lib/services/node-settings';
import type { UpdatableSettings } from '$lib/db/repositories';
import { appendAudit } from '$lib/db/repositories';
import { getActor, requireAdminRole, requireSiteOwner } from '$lib/server/auth-lanes';
import { auditContext } from '$lib/server/audit-helpers';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-admin-settings');

const ALLOWED_AUTH_MODES = new Set(['solo', 'invite', 'open']);
const ALLOWED_ROLES = new Set(['developer', 'viewer']);

const UPDATABLE_KEYS: (keyof UpdatableSettings)[] = [
	'authMode',
	'waitlistEnabled',
	'defaultRole',
	'yanezEnabled',
	'ownerEmail',
	'nodeName',
	'supportEmail',
	'welcomeHeadline',
	'welcomeBody',
	'brandLogoUrl',
	'brandPrimaryColor'
];

export const GET: RequestHandler = async ({ platform, locals }) => {
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'GET' });
	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });
	try {
		const db = createDbClient(d1);
		const settings = await getSettings(db);
		return json({ settings });
	} catch (err) {
		log.error('GET', 'Failed to load settings', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to load settings' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	const { platform, locals, request } = event;
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'PATCH' });

	const d1 = platform?.env?.DB;
	if (!d1) return json({ error: 'Database not available' }, { status: 503 });

	const db = createDbClient(d1);
	const current = await getSettings(db);
	const envOwnerEmail = (platform?.env as { SITE_OWNER_EMAIL?: string } | undefined)
		?.SITE_OWNER_EMAIL;
	requireSiteOwner(actor, current.ownerEmail, envOwnerEmail, { log, fn: 'PATCH' });

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// Whitelist the patch to UPDATABLE_KEYS + validate enums.
	const patch: UpdatableSettings = {};
	for (const key of UPDATABLE_KEYS) {
		if (!(key in body)) continue;
		const value = body[key];
		if (key === 'authMode') {
			if (typeof value !== 'string' || !ALLOWED_AUTH_MODES.has(value)) {
				return json({ error: `Invalid authMode: ${value}` }, { status: 400 });
			}
			patch.authMode = value;
		} else if (key === 'defaultRole') {
			if (typeof value !== 'string' || !ALLOWED_ROLES.has(value)) {
				return json({ error: `Invalid defaultRole: ${value}` }, { status: 400 });
			}
			patch.defaultRole = value;
		} else if (key === 'waitlistEnabled') {
			patch.waitlistEnabled = Boolean(value);
		} else if (key === 'yanezEnabled') {
			patch.yanezEnabled = Boolean(value);
		} else if (value === null || typeof value === 'string') {
			(patch as Record<string, unknown>)[key] = value;
		} else {
			return json({ error: `Invalid value for ${key}` }, { status: 400 });
		}
	}

	if (Object.keys(patch).length === 0) {
		return json({ error: 'No updatable fields provided' }, { status: 400 });
	}

	try {
		const updated = await updateSettings(db, patch);
		if (!updated) return json({ error: 'Settings row missing' }, { status: 500 });

		// Build a field-level diff for the audit metadata.
		const changed: Record<string, { from: unknown; to: unknown }> = {};
		for (const key of Object.keys(patch) as (keyof UpdatableSettings)[]) {
			const before = (current as Record<string, unknown>)[key];
			const after = (updated as Record<string, unknown>)[key];
			if (before !== after) changed[key] = { from: before, to: after };
		}

		const ctx = auditContext(event);
		await appendAudit(db, {
			eventType: 'settings.updated',
			...ctx,
			targetType: 'node_settings',
			targetId: updated.id,
			metadata: { changed: Object.keys(changed), diff: changed }
		});

		if (changed.authMode) {
			await appendAudit(db, {
				eventType: 'settings.auth_mode_changed',
				...ctx,
				targetType: 'node_settings',
				targetId: updated.id,
				metadata: { from: changed.authMode.from, to: changed.authMode.to }
			});
		}
		if (
			changed.brandLogoUrl ||
			changed.brandPrimaryColor ||
			changed.welcomeHeadline ||
			changed.welcomeBody ||
			changed.nodeName
		) {
			await appendAudit(db, {
				eventType: 'settings.branding_updated',
				...ctx,
				targetType: 'node_settings',
				targetId: updated.id,
				metadata: {
					fields: Object.keys(changed).filter((k) =>
						[
							'brandLogoUrl',
							'brandPrimaryColor',
							'welcomeHeadline',
							'welcomeBody',
							'nodeName'
						].includes(k)
					)
				}
			});
		}

		return json({ settings: updated, changed: Object.keys(changed) });
	} catch (err) {
		log.error('PATCH', 'Failed to update settings', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Failed to update settings' }, { status: 500 });
	}
};
