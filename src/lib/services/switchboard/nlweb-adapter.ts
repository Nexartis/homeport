/**
 * NLWeb Adapter — Basic NLWeb detection and mapping
 * Phase 6 — Agent California
 *
 * NLWeb (Natural Language Web) uses schema.org metadata for discovery.
 * This adapter provides basic detection and AgentFacts mapping.
 *
 * @see https://github.com/nlweb-ai/NLWeb
 */

import type {
	RegistryAdapter,
	NLWebDescriptor,
	AgentRecord,
	AdapterInfo
} from '$lib/types/switchboard';
import type { AgentFactsV2Placeholder } from '$lib/types/resolver';
import { isSafeUrl } from './protocol-detector';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'nlweb-adapter');

const FETCH_TIMEOUT_MS = 8000;

export class NLWebAdapter implements RegistryAdapter {
	readonly registryId = 'nlweb';

	async queryAgent(agentUrl: string): Promise<AgentRecord | null> {
		if (!isSafeUrl(agentUrl)) {
			log.warn('queryAgent', `SSRF blocked: ${agentUrl}`);
			return null;
		}

		const baseUrl = agentUrl.replace(/\/+$/, '');

		try {
			const res = await fetch(`${baseUrl}/.well-known/nlweb.json`, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
				headers: { Accept: 'application/json' }
			});

			if (!res.ok) return null;

			const data = (await res.json()) as NLWebDescriptor;
			if (!data.url && !data.schemaOrgTypes) return null;

			const name = new URL(data.url || baseUrl).hostname;

			return {
				agentId: `@nlweb:${name}`,
				registryId: 'nlweb',
				agentName: name,
				version: 'v1.0.0',
				description: `NLWeb endpoint with schema.org types: ${(data.schemaOrgTypes ?? []).join(', ')}`,
				capabilities: data.capabilities ?? data.schemaOrgTypes ?? [],
				agentUrl: baseUrl,
				schemaVersion: 'nlweb-v1',
				sourceSchema: 'nlweb',
				rawData: data as unknown as Record<string, unknown>
			};
		} catch (err) {
			log.error('queryAgent', `Failed to probe NLWeb at ${agentUrl}`, {
				error: err instanceof Error ? err.message : String(err)
			});
			return null;
		}
	}

	translateToNanda(sourceData: unknown): AgentFactsV2Placeholder {
		const desc = sourceData as NLWebDescriptor;
		return {
			agent_name: desc.url ? new URL(desc.url).hostname : 'unknown',
			description: `NLWeb endpoint: ${(desc.schemaOrgTypes ?? []).join(', ')}`,
			endpoints: {
				static: [{ url: desc.url, protocol: 'nlweb' }]
			},
			capabilities: {
				modalities: desc.schemaOrgTypes ?? []
			},
			skills: desc.capabilities?.map((c) => ({
				id: c,
				name: c,
				description: `NLWeb capability: ${c}`
			}))
		};
	}

	translateFromNanda(facts: AgentFactsV2Placeholder): NLWebDescriptor {
		return {
			url: facts.endpoints?.static?.[0]?.url ?? '',
			schemaOrgTypes: facts.capabilities?.modalities ?? [],
			capabilities: facts.skills?.map((s) => s.id) ?? []
		};
	}

	getRegistryInfo(): AdapterInfo {
		return {
			registryId: 'nlweb',
			adapterType: 'NLWebAdapter',
			status: 'active',
			supportedProtocols: ['nlweb']
		};
	}
}
