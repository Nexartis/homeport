/**
 * POST /register — Register or update an agent in the NANDA registry
 *
 * @swagger
 * /register:
 *   post:
 *     summary: Register or update an agent
 *     description: Upsert an agent registration. Auto-creates a Lean Index AgentAddr for DNS-like resolution.
 *     tags:
 *       - Registry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agent_id
 *               - agent_url
 *             properties:
 *               agent_id:
 *                 type: string
 *                 description: Unique agent identifier
 *               agent_url:
 *                 type: string
 *                 format: uri
 *                 description: Primary URL of the agent
 *               api_url:
 *                 type: string
 *                 format: uri
 *               facts_url:
 *                 type: string
 *                 format: uri
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               auto_discover:
 *                 type: boolean
 *                 description: When true, auto-discover protocols at agent_url
 *               visibility:
 *                 type: string
 *                 enum: [private, unlisted, public, for_hire]
 *                 description: Discovery visibility (default public)
 *               capability_manifest:
 *                 type: array
 *                 description: Array of capability manifest entries
 *               mcp_metadata:
 *                 type: object
 *                 description: MCP server metadata
 *               pricing:
 *                 type: object
 *                 description: Pricing descriptor
 *     responses:
 *       200:
 *         description: Agent registered successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registerAgent } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { resolveAndSign } from '$lib/crypto/sign-agent';
import { SwitchboardService } from '$lib/services/switchboard';
import {
	AGENT_VISIBILITIES,
	normalizeVisibility,
	validateCapabilityManifest,
	validateMcpMetadata,
	validatePricingDescriptor,
	type CapabilityManifestEntry,
	type McpMetadata,
	type PricingDescriptor
} from '$lib/types/agent-visibility';

const log = createLogger(undefined, 'register');

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const env = platform!.env;
	const db = createDbClient(env.DB);

	// Soft enforcement: log API key presence for transition period
	if (locals.apiKey) {
		log.info('POST', 'register with API key', {
			keyId: locals.apiKey.id,
			tier: locals.apiKey.tier
		});
	} else {
		log.info(
			'POST',
			'register without API key (transition period — key will be required in future)'
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	try {
		// Auto-discover mode: probe URL for protocols and register automatically
		if (body.auto_discover === true) {
			if (typeof body.agent_url !== 'string' || !body.agent_url) {
				return json(
					{ error: 'agent_url must be a non-empty string for auto_discover' },
					{ status: 400 }
				);
			}
			const service = new SwitchboardService(db);
			const result = await service.autoRegister(body.agent_url, env.ENVIRONMENT);
			if (!result) {
				return json(
					{ error: 'No supported protocols detected at the provided URL' },
					{ status: 404 }
				);
			}

			// Sign and register in the main agent registry
			const sig = await resolveAndSign(result.agentId, env);
			await registerAgent(db, {
				agent_id: result.agentId,
				agent_url: body.agent_url,
				capabilities: result.facts.capabilities?.modalities ?? [],
				tags: [],
				source: `switchboard:${result.source}`,
				...sig
			});

			log.info('POST', 'Agent auto-discovered and registered', {
				agentId: result.agentId,
				source: result.source,
				protocols: result.detectedProtocols.map((d) => d.protocol)
			});

			return json(
				{
					status: 'success',
					message: `Agent ${result.agentId} auto-discovered and registered`,
					discovery: result
				},
				{ status: 201 }
			);
		}

		if (typeof body.agent_id !== 'string' || typeof body.agent_url !== 'string') {
			return json({ error: 'agent_id and agent_url must be non-empty strings' }, { status: 400 });
		}
		if (!body.agent_id || !body.agent_url) {
			return json({ error: 'agent_id and agent_url must be non-empty strings' }, { status: 400 });
		}
		if (body.api_url !== undefined && typeof body.api_url !== 'string') {
			return json({ error: 'api_url must be a string' }, { status: 400 });
		}
		if (body.facts_url !== undefined && typeof body.facts_url !== 'string') {
			return json({ error: 'facts_url must be a string' }, { status: 400 });
		}
		if (body.capabilities !== undefined) {
			if (
				!Array.isArray(body.capabilities) ||
				!body.capabilities.every((c: unknown) => typeof c === 'string')
			) {
				return json({ error: 'capabilities must be an array of strings' }, { status: 400 });
			}
		}
		if (body.tags !== undefined) {
			if (!Array.isArray(body.tags) || !body.tags.every((t: unknown) => typeof t === 'string')) {
				return json({ error: 'tags must be an array of strings' }, { status: 400 });
			}
		}
		if (body.visibility !== undefined && normalizeVisibility(body.visibility) === null) {
			return json(
				{ error: `visibility must be one of: ${AGENT_VISIBILITIES.join(', ')}` },
				{ status: 400 }
			);
		}
		if (body.capability_manifest !== undefined) {
			const err = validateCapabilityManifest(body.capability_manifest);
			if (err) return json({ error: err }, { status: 400 });
		}
		if (body.mcp_metadata !== undefined) {
			const err = validateMcpMetadata(body.mcp_metadata);
			if (err) return json({ error: err }, { status: 400 });
		}
		if (body.pricing !== undefined) {
			const err = validatePricingDescriptor(body.pricing);
			if (err) return json({ error: err }, { status: 400 });
		}
		// Sign with Ed25519 — throws if key is not configured
		const sig = await resolveAndSign(body.agent_id as string, env);

		await registerAgent(db, {
			agent_id: body.agent_id,
			agent_url: body.agent_url,
			api_url: body.api_url as string | undefined,
			facts_url: body.facts_url as string | undefined,
			capabilities: body.capabilities as string[] | undefined,
			tags: body.tags as string[] | undefined,
			visibility: normalizeVisibility(body.visibility) ?? 'public',
			capability_manifest: body.capability_manifest as CapabilityManifestEntry[] | undefined,
			mcp_metadata: body.mcp_metadata as McpMetadata | undefined,
			pricing: body.pricing as PricingDescriptor | undefined,
			source: 'local',
			...sig
		});

		return json({
			status: 'success',
			message: `Agent ${body.agent_id} registered successfully`
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('POST', 'register failed', { error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
