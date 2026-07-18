/**
 * Switchboard Service — Protocol Bridge Orchestrator
 * Phase 6 — Agent California
 *
 * Coordinates cross-protocol interop:
 *   - autoRegister(url): detect protocols → register adapters → import as AgentFacts
 *   - exportAs(agentId, protocol): export AgentFacts → target protocol format
 *   - resync(agentId): re-probe and update protocol adapters
 *   - listAdapters(): list registered protocol adapters
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase E
 * @see nanda-repos/nanda-index/switchboard/switchboard_routes.py
 */

import type { DbClient } from '$lib/db/client';
import type {
	ProtocolType,
	RegistryAdapter,
	SwitchboardLookupResult
} from '$lib/types/switchboard';
import type { AgentFactsV2Placeholder } from '$lib/types/resolver';
import {
	upsertProtocolAdapter,
	getProtocolAdapters,
	deleteProtocolAdapters
} from '$lib/db/repositories/resolution-log';
import { detectProtocols, isSafeUrl } from './protocol-detector';
import { A2AAdapter } from './a2a-adapter';
import { McpAdapter } from './mcp-adapter';
import { NLWebAdapter } from './nlweb-adapter';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'switchboard');

export class SwitchboardService {
	private db: DbClient;
	private adapters: Map<string, RegistryAdapter>;

	constructor(db: DbClient) {
		this.db = db;
		this.adapters = new Map();

		// Register built-in adapters
		const a2a = new A2AAdapter();
		const mcp = new McpAdapter();
		const nlweb = new NLWebAdapter();
		this.adapters.set(a2a.registryId, a2a);
		this.adapters.set(mcp.registryId, mcp);
		this.adapters.set(nlweb.registryId, nlweb);
	}

	/**
	 * Auto-register an agent from a URL:
	 * 1. Detect supported protocols
	 * 2. Query the first adapter that matches
	 * 3. Persist protocol adapter records
	 * 4. Return AgentFacts v2
	 */
	async autoRegister(
		agentUrl: string,
		environment?: string
	): Promise<SwitchboardLookupResult | null> {
		if (!isSafeUrl(agentUrl, environment)) {
			log.warn('autoRegister', `SSRF blocked: ${agentUrl}`);
			return null;
		}

		const start = Date.now();
		const detected = await detectProtocols(agentUrl, environment);

		if (detected.length === 0) {
			log.info('autoRegister', `No protocols detected at ${agentUrl}`);
			return null;
		}

		log.info('autoRegister', `Detected ${detected.length} protocol(s) at ${agentUrl}`, {
			protocols: detected.map((d) => `${d.protocol}(${d.confidence})`)
		});

		// Try each detected protocol in confidence order
		for (const proto of detected) {
			const adapter = this.adapters.get(proto.protocol);
			if (!adapter) continue;

			const record = await adapter.queryAgent(agentUrl);
			if (!record) continue;

			const facts = adapter.translateToNanda(record.rawData ?? record);

			// Persist protocol adapter records for all detected protocols
			for (const d of detected) {
				await upsertProtocolAdapter(this.db, {
					id: `${record.agentId}:${d.protocol}`,
					agentId: record.agentId,
					protocol: d.protocol,
					metadataJson: d.metadata ? JSON.stringify(d.metadata) : null
				});
			}

			return {
				agentId: record.agentId,
				source: proto.protocol,
				facts,
				detectedProtocols: detected,
				lookupDurationMs: Date.now() - start
			};
		}

		log.warn('autoRegister', `No adapter could query ${agentUrl}`);
		return null;
	}

	/**
	 * Export AgentFacts to target protocol format.
	 */
	exportAs(facts: AgentFactsV2Placeholder, targetProtocol: ProtocolType): unknown {
		const adapter = this.adapters.get(targetProtocol);
		if (!adapter) {
			throw new Error(`No adapter registered for protocol: ${targetProtocol}`);
		}
		return adapter.translateFromNanda(facts);
	}

	/**
	 * Re-probe and update protocol adapters for an agent.
	 */
	async resync(agentId: string, agentUrl: string, environment?: string): Promise<void> {
		await deleteProtocolAdapters(this.db, agentId);
		const detected = await detectProtocols(agentUrl, environment);
		for (const d of detected) {
			await upsertProtocolAdapter(this.db, {
				id: `${agentId}:${d.protocol}`,
				agentId,
				protocol: d.protocol,
				metadataJson: d.metadata ? JSON.stringify(d.metadata) : null
			});
		}
		log.info('resync', `Updated ${detected.length} adapter(s) for ${agentId}`);
	}

	/** List registered protocol adapters for an agent */
	async listAdapters(agentId: string) {
		return getProtocolAdapters(this.db, agentId);
	}

	/** Get all available adapter types */
	getAvailableAdapters(): Array<{ registryId: string; adapterType: string; status: string }> {
		return Array.from(this.adapters.values()).map((a) => a.getRegistryInfo());
	}
}
