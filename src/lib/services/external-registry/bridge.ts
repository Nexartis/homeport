/**
 * External Registry Bridge — Cross-Network Federation
 *
 * Pulls agents from external NANDA-compatible registries and imports them
 * into the local agents table with source tagging. Supports multiple adapter
 * types for different API formats (MIT NANDA Index, HOL Broker, etc.).
 */
import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentAddrs, agentFacts, externalRegistries } from '$lib/db/schema';
import type { ExternalRegistryRecord } from '$lib/db/schema';
import { createLogger } from '$lib/utils/logger';
import { fetchNandaAgents, previewNandaAgents, registerOnNandaIndex } from './adapters/nanda';
import { fetchHolAgents } from './adapters/hol';
import { signAgentAddr } from '$lib/crypto/sign-agent';

const log = createLogger(undefined, 'external-registry-bridge');

export interface ExternalAgent {
	agent_id: string;
	agent_url: string;
	api_url?: string;
	facts_url?: string;
	name?: string;
	description?: string;
	capabilities?: string[];
	protocols?: string[];
	tags?: string[];
	provider?: string;
	trustScore?: number;
	availabilityStatus?: string;
	certification?: {
		level?: string;
		issuer?: string;
		expirationDate?: string;
	};
	skills?: Array<{
		id: string;
		description: string;
		inputModes: string[];
		outputModes: string[];
	}>;
	rawMetadata?: Record<string, unknown>;
}

export interface SyncResult {
	registryId: string;
	registryName: string;
	imported: number;
	updated: number;
	errors: number;
	durationMs: number;
}

/**
 * Fetch agents from an external registry using the appropriate adapter.
 */
export async function fetchFromRegistry(
	registry: ExternalRegistryRecord
): Promise<ExternalAgent[]> {
	const config = registry.configJson ? JSON.parse(registry.configJson) : {};

	switch (registry.adapterType) {
		case 'nanda':
			return fetchNandaAgents(registry.baseUrl, config);
		case 'hol':
			return fetchHolAgents(registry.baseUrl, config);
		default:
			throw new Error(`Unknown adapter type: ${registry.adapterType}`);
	}
}

/**
 * Sync agents from a single external registry into the local agents table.
 */
export async function syncExternalRegistry(
	db: DbClient,
	registry: ExternalRegistryRecord,
	signingKey?: CryptoKey
): Promise<SyncResult> {
	const start = Date.now();
	const result: SyncResult = {
		registryId: registry.id,
		registryName: registry.name,
		imported: 0,
		updated: 0,
		errors: 0,
		durationMs: 0
	};

	const sourceTag = `external:${registry.id}`;

	try {
		const externalAgents = await fetchFromRegistry(registry);
		log.info(
			'syncExternalRegistry',
			`Fetched ${externalAgents.length} agents from ${registry.name}`
		);

		// Process agents in batches
		const BATCH_SIZE = 50;
		for (let i = 0; i < externalAgents.length; i += BATCH_SIZE) {
			const batch = externalAgents.slice(i, i + BATCH_SIZE);
			for (const agent of batch) {
				try {
					const localId = `${registry.id}:${agent.agent_id}`;

					// Detect insert-vs-update BEFORE the upsert so we can
					// accurately bump result.imported vs result.updated
					// (previously always `imported++`, misreporting sync stats).
					const existing = await db.query.agentAddrs.findFirst({
						where: eq(agentAddrs.agentId, localId),
						columns: { agentId: true }
					});

					// Build enriched tags array with protocols and provider
					const enrichedTags = [...(agent.tags ?? [])];
					if (agent.protocols) enrichedTags.push(...agent.protocols.map((p) => `proto:${p}`));
					if (agent.provider) enrichedTags.push(`provider:${agent.provider}`);
					if (agent.availabilityStatus) enrichedTags.push(`avail:${agent.availabilityStatus}`);

					// Upsert into agent_addrs table
					// Sign with our Ed25519 key if available, otherwise fail loudly
					const agentSig = signingKey
						? await signAgentAddr(localId, signingKey)
						: (() => {
								throw new Error('Ed25519 signing key required for external registry sync');
							})();
					await db
						.insert(agentAddrs)
						.values({
							agentId: localId,
							agentUrl: agent.agent_url,
							apiUrl: agent.api_url ?? null,
							factsUrl: agent.facts_url ?? null,
							capabilities: agent.capabilities ? JSON.stringify(agent.capabilities) : null,
							tags: enrichedTags.length ? JSON.stringify(enrichedTags) : null,
							source: sourceTag,
							status: 'alive',
							publicKeyHex: agentSig.publicKeyHex,
							signatureHex: agentSig.signatureHex,
							signerId: agentSig.signerId
						})
						.onConflictDoUpdate({
							target: agentAddrs.agentId,
							set: {
								agentUrl: agent.agent_url,
								apiUrl: agent.api_url ?? null,
								factsUrl: agent.facts_url ?? null,
								capabilities: agent.capabilities ? JSON.stringify(agent.capabilities) : null,
								tags: enrichedTags.length ? JSON.stringify(enrichedTags) : null,
								source: sourceTag,
								status: 'alive',
								updatedAt: sql`(unixepoch())`
							}
						});

					// Upsert rich metadata into agent_facts for searchability
					if (agent.name || agent.description || agent.provider) {
						const factsBlob = JSON.stringify({
							agent_name: agent.name ?? agent.agent_id,
							description: agent.description,
							provider: agent.provider ? { name: agent.provider } : undefined,
							capabilities: {
								modalities: agent.capabilities ?? []
							},
							certification: agent.certification,
							skills: agent.skills,
							protocols: agent.protocols,
							trustScore: agent.trustScore,
							availabilityStatus: agent.availabilityStatus,
							sourceRegistry: registry.name,
							...(agent.rawMetadata ?? {})
						});
						await db
							.insert(agentFacts)
							.values({
								agentId: localId,
								factsJson: factsBlob,
								agentName: agent.name ?? agent.agent_id,
								providerDid: agent.provider ? `did:external:${agent.provider}` : null,
								trustScore: agent.trustScore ?? null,
								schemaVersion: '1.0.0'
							})
							.onConflictDoUpdate({
								target: agentFacts.agentId,
								set: {
									factsJson: factsBlob,
									agentName: agent.name ?? agent.agent_id,
									trustScore: agent.trustScore ?? null,
									updatedAt: sql`(unixepoch())`
								}
							});
					}

					if (existing) {
						result.updated++;
					} else {
						result.imported++;
					}
				} catch (err) {
					result.errors++;
					log.warn('syncExternalRegistry', `Failed to import agent ${agent.agent_id}`, {
						error: err instanceof Error ? err.message : String(err)
					});
				}
			}
		}

		// Update registry sync metadata
		await db
			.update(externalRegistries)
			.set({
				lastSyncAt: sql`(unixepoch())`,
				lastSyncStatus: result.errors > 0 ? 'partial' : 'success',
				lastSyncAgentCount: result.imported + result.updated,
				lastSyncError: null,
				totalAgentsSynced: sql`total_agents_synced + ${result.imported + result.updated}`,
				updatedAt: sql`(unixepoch())`
			})
			.where(eq(externalRegistries.id, registry.id));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error('syncExternalRegistry', `Sync failed for ${registry.name}`, { error: message });
		result.errors++;

		await db
			.update(externalRegistries)
			.set({
				lastSyncAt: sql`(unixepoch())`,
				lastSyncStatus: 'error',
				lastSyncError: message,
				updatedAt: sql`(unixepoch())`
			})
			.where(eq(externalRegistries.id, registry.id));
	}

	result.durationMs = Date.now() - start;
	return result;
}

/**
 * Sync all enabled external registries.
 */
export async function syncAllExternalRegistries(
	db: DbClient,
	signingKey?: CryptoKey
): Promise<SyncResult[]> {
	const enabledRegistries = await db.query.externalRegistries.findMany({
		where: eq(externalRegistries.enabled, true)
	});

	if (enabledRegistries.length === 0) {
		log.info('syncAllExternalRegistries', 'No enabled external registries');
		return [];
	}

	const results: SyncResult[] = [];
	for (const registry of enabledRegistries) {
		const result = await syncExternalRegistry(db, registry, signingKey);
		results.push(result);
		log.info(
			'syncAllExternalRegistries',
			`${registry.name}: +${result.imported} imported, ${result.updated} updated, ${result.errors} errors (${result.durationMs}ms)`
		);
	}

	return results;
}

/**
 * Get all external registries with their sync status.
 */
export async function getAllExternalRegistries(db: DbClient): Promise<ExternalRegistryRecord[]> {
	return db.query.externalRegistries.findMany({
		orderBy: (er, { desc }) => [desc(er.createdAt)]
	});
}

/**
 * Add a new external registry.
 */
export async function addExternalRegistry(
	db: DbClient,
	registry: {
		id: string;
		name: string;
		baseUrl: string;
		adapterType: string;
		syncIntervalMin?: number;
		config?: Record<string, unknown>;
	}
): Promise<void> {
	await db.insert(externalRegistries).values({
		id: registry.id,
		name: registry.name,
		baseUrl: registry.baseUrl,
		adapterType: registry.adapterType,
		syncIntervalMin: registry.syncIntervalMin ?? 60,
		configJson: registry.config ? JSON.stringify(registry.config) : '{}'
	});
}

/**
 * Preview agents from an external registry without importing.
 * Returns the raw agent list for admin review.
 */
export async function previewExternalRegistry(
	registry: ExternalRegistryRecord
): Promise<{ agents: ExternalAgent[]; total: number; registryHealth?: string }> {
	const config = registry.configJson ? JSON.parse(registry.configJson) : {};

	switch (registry.adapterType) {
		case 'nanda':
			return previewNandaAgents(registry.baseUrl, config);
		case 'hol': {
			// HOL adapter doesn't have a dedicated preview — fetch first page
			const agents = await fetchHolAgents(registry.baseUrl, {
				...config,
				maxAgents: config.previewLimit ?? 50
			});
			return { agents, total: agents.length };
		}
		default:
			throw new Error(`Unknown adapter type: ${registry.adapterType}`);
	}
}

/**
 * Register a local agent on a remote NANDA-compatible registry.
 */
export async function registerAgentOnExternal(
	registry: ExternalRegistryRecord,
	agent: { agent_id: string; agent_url: string; api_url?: string }
): Promise<{ success: boolean; message?: string }> {
	switch (registry.adapterType) {
		case 'nanda':
			return registerOnNandaIndex(registry.baseUrl, agent);
		case 'hol':
			return {
				success: false,
				message: 'HOL registration requires SDK integration (not yet supported)'
			};
		default:
			return {
				success: false,
				message: `Registration not supported for adapter type: ${registry.adapterType}`
			};
	}
}

/**
 * Remove an external registry and optionally its imported agents.
 */
export async function removeExternalRegistry(
	db: DbClient,
	registryId: string,
	removeAgents = false
): Promise<{ removed: boolean; agentsRemoved: number }> {
	let agentsRemoved = 0;
	if (removeAgents) {
		const sourceTag = `external:${registryId}`;
		// Remove agent_facts for these agents first (FK constraint)
		const agentsToRemove = await db.query.agentAddrs.findMany({
			where: eq(agentAddrs.source, sourceTag),
			columns: { agentId: true }
		});
		for (const a of agentsToRemove) {
			await db.delete(agentFacts).where(eq(agentFacts.agentId, a.agentId));
		}
		const deleted = await db.delete(agentAddrs).where(eq(agentAddrs.source, sourceTag)).returning();
		agentsRemoved = deleted.length;
		log.info('removeExternalRegistry', `Removed ${agentsRemoved} agents from ${registryId}`);
	}

	await db.delete(externalRegistries).where(eq(externalRegistries.id, registryId));
	return { removed: true, agentsRemoved };
}
