/**
 * @swagger
 * /agentfacts/{id}:
 *   get:
 *     summary: Get agent facts
 *     description: Returns AgentFacts JSON for an agent. Use ?format=vc for a Verifiable Credential envelope.
 *     tags:
 *       - Registry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [vc]
 *         description: Return VC-wrapped facts if set to "vc"
 *     responses:
 *       200:
 *         description: AgentFacts data (plain JSON or VC envelope)
 *       404:
 *         description: Agent not found
 *   put:
 *     summary: Store or update agent facts
 *     description: Store AgentFacts metadata for an agent.
 *     tags:
 *       - Registry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: AgentFacts JSON payload
 *     responses:
 *       200:
 *         description: Facts stored
 *       400:
 *         description: Invalid payload
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAgentFacts, storeAgentFacts, storeAgentFactsV2 } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { getOrIssueAgentFactsVC } from '$lib/services/agentfacts-vc';

const log = createLogger(undefined, 'agentfacts');

/**
 * GET /agentfacts/:id — returns facts JSON, or VC envelope with ?format=vc
 */
export const GET: RequestHandler = async ({ params, platform, url }) => {
	const db = createDbClient(platform!.env.DB);
	const agentId = decodeURIComponent(params.id);
	const format = url.searchParams.get('format');

	if (format === 'vc') {
		const vc = await getOrIssueAgentFactsVC(platform!.env, db, agentId);
		if (!vc) return json({ error: 'AgentFacts not found' }, { status: 404 });
		return json(vc, {
			headers: { 'Content-Type': 'application/vc+ld+json' }
		});
	}

	const facts = await getAgentFacts(db, agentId);
	if (!facts) return json({ error: 'AgentFacts not found' }, { status: 404 });
	return json(facts);
};

/**
 * PUT /agentfacts/:id — stores facts (auto-detects v1 vs v2 schema)
 */
export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
	// Soft enforcement: log API key presence for transition period
	if (locals.apiKey) {
		log.info('PUT', `agentfacts update with API key for ${params.id}`, {
			keyId: locals.apiKey.id,
			tier: locals.apiKey.tier
		});
	} else {
		log.info(
			'PUT',
			`agentfacts update without API key for ${params.id} (transition period — key will be required in future)`
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	try {
		const db = createDbClient(platform!.env.DB);
		const agentId = decodeURIComponent(params.id);

		// Auto-detect v2 and use the v2-aware store path
		const result = await storeAgentFactsV2(db, agentId, body);
		if (!result.ok)
			return json({ error: 'Validation failed', details: result.errors }, { status: 400 });
		return json({ status: 'stored', schema_version: result.schema_version });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('PUT', `storeAgentFacts failed for ${params.id}`, { error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
