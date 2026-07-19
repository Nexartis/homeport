/**
 * A2A Adapter — Maps A2A Agent Card ↔ AgentFacts v2
 * Phase 6 — Agent California
 *
 * Implements RegistryAdapter for A2A-protocol agents:
 *   - queryAgent: fetches /.well-known/agent-card.json
 *   - translateToNanda: maps A2A AgentCard → AgentFacts v2
 *   - translateFromNanda: maps AgentFacts v2 → A2A AgentCard
 *
 * @see A2A Protocol v1.0 Section 8.2 — Agent Card
 */

import type {
	RegistryAdapter,
	A2AAgentCard,
	AgentRecord,
	AdapterInfo
} from '$lib/types/switchboard';
import type { AgentFactsV2Placeholder } from '$lib/types/resolver';
import { isSafeUrl } from './protocol-detector';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'a2a-adapter');

const FETCH_TIMEOUT_MS = 8000;

export class A2AAdapter implements RegistryAdapter {
	readonly registryId = 'a2a';

	async queryAgent(agentUrl: string): Promise<AgentRecord | null> {
		if (!isSafeUrl(agentUrl)) {
			log.warn('queryAgent', `SSRF blocked: ${agentUrl}`);
			return null;
		}

		const baseUrl = agentUrl.replace(/\/+$/, '');
		try {
			const res = await fetch(`${baseUrl}/.well-known/agent-card.json`, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { Accept: 'application/json' }
			});

			if (!res.ok) return null;

			const card = (await res.json()) as A2AAgentCard;
			if (!card.name) return null;

			return {
				agentId: `@a2a:${card.name}`,
				registryId: 'a2a',
				agentName: card.name,
				version: card.version ?? 'v1.0.0',
				description: card.description ?? '',
				capabilities: card.skills?.map((s) => s.id) ?? [],
				agentUrl: baseUrl,
				apiUrl: card.supportedInterfaces?.[0]?.url,
				schemaVersion: 'a2a-v1',
				sourceSchema: 'a2a',
				rawData: card as unknown as Record<string, unknown>
			};
		} catch (err) {
			log.error('queryAgent', `Failed to fetch A2A card from ${agentUrl}`, {
				error: err instanceof Error ? err.message : String(err)
			});
			return null;
		}
	}

	translateToNanda(sourceData: unknown): AgentFactsV2Placeholder {
		const card = sourceData as A2AAgentCard;
		return {
			agent_name: card.name,
			description: card.description,
			version: card.version,
			provider: card.provider
				? { name: card.provider.organization, url: card.provider.url }
				: undefined,
			endpoints: {
				static: card.supportedInterfaces?.map((iface) => ({
					url: iface.url,
					protocol: 'a2a'
				}))
			},
			capabilities: {
				streaming: card.capabilities?.streaming,
				modalities: [...(card.defaultInputModes ?? []), ...(card.defaultOutputModes ?? [])]
			},
			skills: card.skills?.map((s) => ({
				id: s.id,
				name: s.name,
				description: s.description,
				inputModes: s.inputModes,
				outputModes: s.outputModes
			}))
		};
	}

	translateFromNanda(facts: AgentFactsV2Placeholder): A2AAgentCard {
		return {
			name: facts.agent_name,
			description: facts.description ?? '',
			version: facts.version ?? '1.0.0',
			protocolVersions: ['1.0'],
			supportedInterfaces:
				facts.endpoints?.static?.map((ep) => ({
					url: ep.url,
					protocolBinding: 'HTTP+JSON',
					protocolVersion: '1.0'
				})) ?? [],
			defaultInputModes: ['application/json'],
			defaultOutputModes: ['application/json'],
			capabilities: {
				streaming: facts.capabilities?.streaming ?? false,
				pushNotifications: false,
				stateTransitionHistory: false,
				extendedAgentCard: false
			},
			skills:
				facts.skills?.map((s) => ({
					id: s.id,
					name: s.name ?? s.id,
					description: s.description ?? '',
					inputModes: s.inputModes,
					outputModes: s.outputModes
				})) ?? [],
			provider: facts.provider
				? { organization: facts.provider.name, url: facts.provider.url ?? '' }
				: undefined
		};
	}

	getRegistryInfo(): AdapterInfo {
		return {
			registryId: 'a2a',
			adapterType: 'A2AAdapter',
			status: 'active',
			supportedProtocols: ['a2a']
		};
	}
}
