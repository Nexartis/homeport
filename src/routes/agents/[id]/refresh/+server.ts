/**
 * POST /agents/:id/refresh — Re-crawl an agent's card and update facts.
 *
 * Fetches the agent's /.well-known/agent-card.json, updates the registration,
 * and refreshes AgentFacts if available.
 *
 * @swagger
 * /agents/{id}/refresh:
 *   post:
 *     summary: Refresh agent from card
 *     description: Re-crawls the agent's /.well-known/agent-card.json and updates registration and facts.
 *     tags:
 *       - Agents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent refreshed
 *       404:
 *         description: Agent not found
 *       401:
 *         description: Unauthorized
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lookupAgent, registerAgent, storeAgentFactsV2 } from '$lib/services/registry';
import { createDbClient } from '$lib/db/client';
import { createLogger } from '$lib/utils/logger';
import { requireFederationAdmin } from '$lib/middleware/auth-guards';
import { resolveAndSign } from '$lib/crypto/sign-agent';

const log = createLogger(undefined, 'agents-refresh');

const FETCH_TIMEOUT_MS = 10_000;

export const POST: RequestHandler = async ({ params, request, platform }) => {
	const denied = await requireFederationAdmin(request, platform);
	if (denied) return denied;

	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}

	let agentId: string;
	try {
		agentId = decodeURIComponent(params.id);
	} catch {
		return json({ error: 'Invalid agent ID encoding' }, { status: 400 });
	}
	const db = createDbClient(platform.env.DB);

	const existing = await lookupAgent(db, agentId);
	if (!existing) {
		return json({ error: 'Agent not found' }, { status: 404 });
	}

	const agentUrl = existing.agent_url as string;
	if (!agentUrl) {
		return json({ error: 'Agent has no URL to refresh from' }, { status: 400 });
	}

	// Attempt to fetch the agent card
	let cardUrl = agentUrl;
	if (!cardUrl.endsWith('/.well-known/agent-card.json')) {
		cardUrl = `${cardUrl.replace(/\/$/, '')}/.well-known/agent-card.json`;
	}

	let cardData: Record<string, unknown> | null = null;
	let fetchError: string | null = null;

	{
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const res = await fetch(cardUrl, {
				signal: controller.signal,
				headers: { Accept: 'application/json' }
			});

			if (res.ok) {
				const parsed = await res.json();
				// Validate card is a non-null object (not an array or primitive)
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					cardData = parsed as Record<string, unknown>;
				} else {
					fetchError = 'Agent card is not a valid JSON object';
				}
			} else {
				fetchError = `Agent card fetch returned ${res.status}`;
			}
		} catch (err) {
			fetchError = err instanceof Error ? err.message : String(err);
			log.warn('POST', `Failed to fetch agent card for ${agentId}`, { error: fetchError, cardUrl });
		} finally {
			clearTimeout(timeout);
		}
	}

	try {
		// Update the agent's updated_at timestamp (re-register triggers upsert).
		// Preserve the existing lifecycle status to avoid resurrecting deprecated/tombstoned agents.
		const sig = await resolveAndSign(agentId, platform.env);
		await registerAgent(db, {
			agent_id: agentId,
			agent_url: agentUrl,
			api_url: existing.api_url as string | undefined,
			facts_url: existing.facts_url as string | undefined,
			capabilities: existing.capabilities as string[] | undefined,
			tags: existing.tags as string[] | undefined,
			source: (existing.source as string) ?? 'local',
			status: (existing.status as string) ?? 'alive',
			...sig
		});

		// If we got agent card data, try to store it as AgentFacts
		let factsUpdated = false;
		if (cardData) {
			try {
				const result = await storeAgentFactsV2(db, agentId, cardData);
				factsUpdated = result.ok;
			} catch (err) {
				log.warn('POST', `Failed to store refreshed facts for ${agentId}`, {
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}

		const refreshedAgent = await lookupAgent(db, agentId);
		log.info('POST', `Agent refreshed: ${agentId}`, { factsUpdated, fetchError });

		return json({
			status: 'refreshed',
			message: fetchError
				? `Agent timestamp updated but card fetch failed: ${fetchError}`
				: 'Agent refreshed successfully',
			agent: refreshedAgent,
			facts_updated: factsUpdated
		});
	} catch (err) {
		log.error('POST', `Failed to refresh agent ${agentId}`, {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
