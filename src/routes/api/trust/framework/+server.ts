/**
 * GET /api/trust/framework
 *
 * Public API endpoint for querying registered trust frameworks.
 * Requires a valid developer API key (nanda_ prefix, Bearer token).
 *
 * @swagger
 * /api/trust/framework:
 *   get:
 *     summary: Query trust frameworks
 *     description: List registered trust frameworks (ToIP-aligned). Filter by framework ID.
 *     tags:
 *       - Trust
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Filter to a single framework
 *     responses:
 *       200:
 *         description: Trust frameworks list
 *       401:
 *         description: Unauthorized
 */

/**
 * Query params:
 *   ?id=FRAMEWORK_ID  — Filter to a single framework by framework_id
 *
 * Response (list):   { frameworks, total, fetchedAt }
 * Response (single): { framework, fetchedAt }
 *
 * Phase 3 — Agent Gamma
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getFrameworks, seedDefaultFramework } from '$lib/services/trust-framework/toip-alignment';
import { getTrustFrameworkById } from '$lib/db/repositories';
import { getActor, requireAuthenticated } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'api-trust-framework');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	const db = createDbClient(platform.env.DB);
	const frameworkId = url.searchParams.get('id')?.trim() || null;

	try {
		// Ensure the default KYM framework is seeded. Pass the runtime env
		// override so operators can point the framework's governance URL at
		// their own hosted docs without forking the framework identifier.
		await seedDefaultFramework(db, {
			governanceUrl: platform.env.TRUST_FRAMEWORK_GOVERNANCE_URL
		});

		if (frameworkId) {
			const framework = await getTrustFrameworkById(db, frameworkId);
			if (!framework) {
				return json({ error: 'Framework not found' }, { status: 404 });
			}
			return json({ framework, fetchedAt: new Date().toISOString() });
		}

		const frameworks = await getFrameworks(db);
		return json({
			frameworks,
			total: frameworks.length,
			fetchedAt: new Date().toISOString()
		});
	} catch (err) {
		log.error('GET', 'Trust framework query failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
