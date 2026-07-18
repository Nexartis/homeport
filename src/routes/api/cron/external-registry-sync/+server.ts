/**
 * POST /api/cron/external-registry-sync — Sync agents from external NANDA registries
 *
 * Called by the injected scheduled handler. Pulls agents from all enabled
 * external registries (HOL, MIT NANDA, etc.) and imports them into the local
 * agents table with source tagging.
 *
 * @swagger
 * /api/cron/external-registry-sync:
 *   post:
 *     summary: Cron external registry sync
 *     description: Syncs agents from all enabled external registries. Internal cron endpoint.
 *     tags:
 *       - Internal
 *     security:
 *       - CronAuth: []
 *     responses:
 *       200:
 *         description: Sync results
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { requireCronAuth } from '$lib/middleware/auth-guards';
import { syncAllExternalRegistries } from '$lib/services/external-registry/bridge';
import { importSigningKey } from '$lib/crypto/sign-agent';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'cron-external-registry-sync');

export const POST: RequestHandler = async ({ request, platform }) => {
	const denied = await requireCronAuth(request, platform);
	if (denied) return denied;

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	try {
		const db = createDbClient(platform.env.DB);
		const signingKey = await importSigningKey(platform.env);
		const results = await syncAllExternalRegistries(db, signingKey);

		const summary = {
			registries: results.length,
			totalImported: results.reduce((s, r) => s + r.imported, 0),
			totalUpdated: results.reduce((s, r) => s + r.updated, 0),
			totalErrors: results.reduce((s, r) => s + r.errors, 0),
			results
		};

		log.info('POST', 'External registry sync complete', {
			registries: summary.registries,
			imported: summary.totalImported,
			updated: summary.totalUpdated,
			errors: summary.totalErrors
		});

		return json(summary);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'External registry sync failed', { error: message });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
