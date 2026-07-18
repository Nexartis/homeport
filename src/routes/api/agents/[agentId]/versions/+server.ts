/**
 * GET  /api/agents/:agentId/versions          → List all versions
 * POST /api/agents/:agentId/versions          → Create new version
 *
 * Authentication: X-Cron-Auth header (same pattern as other admin endpoints).
 *
 * Phase 4 — Agent Alpha
 
 * @swagger
 * /api/agents/{agentId}/versions:
 *   get:
 *     summary: List agent versions
 *     description: List all version history entries for an agent.
 *     tags:
 *       - Lifecycle
 *     security:
 *       - CronAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Version list
 *   post:
 *     summary: Create agent version
 *     description: Record a new version entry for an agent.
 *     tags:
 *       - Lifecycle
 *     security:
 *       - CronAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Version created
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireCronAuth } from '$lib/middleware/auth-guards';
import { createVersion, listVersions } from '$lib/services/versioning/service';

const log = createLogger(undefined, 'api-agent-versions');

export const GET: RequestHandler = async ({ request, params, platform }) => {
	// Auth required — admin-only endpoint
	const authErr = await requireCronAuth(request, platform);
	if (authErr) return authErr;

	const d1 = platform?.env?.DB;
	if (!d1) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const db = createDbClient(d1);
	const agentId = params.agentId;

	try {
		const versions = await listVersions(db, agentId);
		return json({ agent_id: agentId, count: versions.length, versions });
	} catch (err) {
		log.error('GET', 'Failed to list versions', {
			agentId,
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, params, platform }) => {
	// Auth required for writes
	const authErr = await requireCronAuth(request, platform);
	if (authErr) return authErr;

	const d1 = platform?.env?.DB;
	if (!d1) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { version, agent_url, changelog, api_url, facts_url, capabilities } = body;

	if (!version || typeof version !== 'string') {
		return json({ error: 'version is required (string)' }, { status: 400 });
	}
	if (!agent_url || typeof agent_url !== 'string') {
		return json({ error: 'agent_url is required (string)' }, { status: 400 });
	}

	// Validate optional fields' types before passing to createVersion
	// Accept null (treated as absent) or string for optional fields
	if (api_url !== undefined && api_url !== null && typeof api_url !== 'string') {
		return json({ error: 'api_url must be a string or null' }, { status: 400 });
	}
	if (facts_url !== undefined && facts_url !== null && typeof facts_url !== 'string') {
		return json({ error: 'facts_url must be a string or null' }, { status: 400 });
	}
	if (changelog !== undefined && changelog !== null && typeof changelog !== 'string') {
		return json({ error: 'changelog must be a string or null' }, { status: 400 });
	}
	if (capabilities !== undefined && !Array.isArray(capabilities)) {
		return json({ error: 'capabilities must be an array' }, { status: 400 });
	}

	const db = createDbClient(d1);
	const agentId = params.agentId;

	try {
		const record = await createVersion(db, agentId, version as string, {
			agentUrl: agent_url as string,
			apiUrl: (api_url as string) ?? null,
			factsUrl: (facts_url as string) ?? null,
			capabilities: capabilities ? JSON.stringify(capabilities) : null,
			changelog: (changelog as string) ?? null
		});

		log.info('POST', `Created version ${version} for agent ${agentId}`);
		return json({ status: 'created', version: record }, { status: 201 });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('POST', 'Failed to create version', { agentId, version, error: message });

		// Return controlled error messages — never expose raw error/stack details
		if (message.includes('not found')) {
			return json({ error: `Agent ${agentId} not found` }, { status: 404 });
		}
		if (message.includes('already exists')) {
			return json(
				{ error: `Version ${version} already exists for agent ${agentId}` },
				{ status: 409 }
			);
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
