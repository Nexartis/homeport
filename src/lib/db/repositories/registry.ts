/**
 * Registry Repository — typed data access for agent_addrs and agent_facts tables.
 *
 * All agent data lives in the unified `agent_addrs` table.
 * JSON fields (capabilities, tags) are stored as TEXT and parsed on read.
 */

import { eq, sql, like, and, or, inArray } from 'drizzle-orm';
import type { DbClient } from '../client';
import { agentAddrs, agentFacts, agentVersions, type NewAgentAddrRecord } from '../schema';
import { DISCOVERABLE_VISIBILITIES } from '$lib/types/agent-visibility';

// ===================================================================
// Agent CRUD
// ===================================================================

/** Upsert agent — INSERT ON CONFLICT UPDATE (mirrors registerAgent) */
export async function upsertAgent(db: DbClient, agent: NewAgentAddrRecord) {
	const result = await db
		.insert(agentAddrs)
		.values(agent)
		.onConflictDoUpdate({
			target: agentAddrs.agentId,
			set: {
				agentUrl: sql`excluded.agent_url`,
				apiUrl: sql`excluded.api_url`,
				factsUrl: sql`excluded.facts_url`,
				capabilities: sql`excluded.capabilities`,
				tags: sql`excluded.tags`,
				source: sql`excluded.source`,
				status: sql`excluded.status`,
				visibility: sql`excluded.visibility`,
				capabilityManifest: sql`excluded.capability_manifest`,
				mcpMetadata: sql`excluded.mcp_metadata`,
				pricing: sql`excluded.pricing`,
				publicKeyHex: sql`excluded.public_key_hex`,
				signatureHex: sql`excluded.signature_hex`,
				signerId: sql`excluded.signer_id`,
				updatedAt: sql`(unixepoch())`
			}
		})
		.returning();
	return result[0];
}

/** Get agent by ID with parsed JSON fields */
export async function getAgentById(db: DbClient, agentId: string) {
	return (
		(await db.query.agentAddrs.findFirst({
			where: eq(agentAddrs.agentId, agentId)
		})) ?? null
	);
}

/** List all discoverable agents (visibility public/for_hire) with full columns */
export async function listAllAgents(db: DbClient) {
	return await db
		.select()
		.from(agentAddrs)
		.where(inArray(agentAddrs.visibility, [...DISCOVERABLE_VISIBILITIES]));
}

/** Search agents with optional query and capability filter.
 *  Searches agent_id, agent_url, tags, capabilities, and agent_facts.agent_name. */
export async function searchAgents(
	db: DbClient,
	opts?: { query?: string; capabilities?: string; tags?: string }
) {
	const conditions = [];

	if (opts?.query) {
		const q = `%${opts.query}%`;
		conditions.push(
			or(
				like(agentAddrs.agentId, q),
				like(agentAddrs.agentUrl, q),
				like(agentAddrs.tags, q),
				like(agentAddrs.capabilities, q)
			)!
		);
	}

	conditions.push(inArray(agentAddrs.visibility, [...DISCOVERABLE_VISIBILITIES]));

	let results = await db
		.select()
		.from(agentAddrs)
		.where(and(...conditions));

	// If query didn't match, also try searching agent_facts.agent_name
	if (opts?.query && results.length === 0) {
		const q = `%${opts.query}%`;
		const factsMatches = await db
			.select({ agentId: agentFacts.agentId })
			.from(agentFacts)
			.where(or(like(agentFacts.agentName, q), like(agentFacts.factsJson, q))!);

		if (factsMatches.length > 0) {
			const matchedIds = factsMatches.map((f) => f.agentId);
			const additionalResults = [];
			for (const id of matchedIds) {
				const row = await db.query.agentAddrs.findFirst({
					where: and(
						eq(agentAddrs.agentId, id),
						inArray(agentAddrs.visibility, [...DISCOVERABLE_VISIBILITIES])
					)
				});
				if (row) additionalResults.push(row);
			}
			results = [...results, ...additionalResults];
		}
	}

	// Post-filter capabilities and tags in memory (JSON fields)
	return results.filter((row) => {
		if (opts?.capabilities) {
			const caps = safeParseJsonArray(row.capabilities);
			if (!caps.includes(opts.capabilities)) return false;
		}
		if (opts?.tags) {
			const tagList = safeParseJsonArray(row.tags);
			if (!tagList.includes(opts.tags)) return false;
		}
		return true;
	});
}

/** Delete agent and its facts (facts first due to FK) */
export async function deleteAgent(db: DbClient, agentId: string) {
	await db.delete(agentFacts).where(eq(agentFacts.agentId, agentId));
	const result = await db.delete(agentAddrs).where(eq(agentAddrs.agentId, agentId));
	return result;
}

/** Update agent status and optionally capabilities */
export async function updateAgentStatus(
	db: DbClient,
	agentId: string,
	status: string,
	capabilities?: string
) {
	const set: Record<string, unknown> = {
		status,
		updatedAt: sql`(unixepoch())`
	};
	if (capabilities !== undefined) {
		set.capabilities = capabilities;
	}
	return await db.update(agentAddrs).set(set).where(eq(agentAddrs.agentId, agentId));
}

/** Get aggregate stats: total agents, alive count, federated count */
export async function getAgentStats(db: DbClient) {
	const [total] = await db.select({ count: sql<number>`COUNT(*)` }).from(agentAddrs);
	const [alive] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(agentAddrs)
		.where(eq(agentAddrs.status, 'alive'));
	const [federated] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(agentAddrs)
		.where(like(agentAddrs.source, 'federated:%'));
	return {
		total: total?.count ?? 0,
		alive: alive?.count ?? 0,
		federated: federated?.count ?? 0
	};
}

/** Get all alive agents (for scheduled probe runs) */
export async function getAliveAgents(db: DbClient) {
	return await db
		.select({ agentId: agentAddrs.agentId, agentUrl: agentAddrs.agentUrl })
		.from(agentAddrs)
		.where(eq(agentAddrs.status, 'alive'));
}

/** Get agent URL by ID (for inline processing) */
export async function getAgentUrl(db: DbClient, agentId: string) {
	return (
		(await db.query.agentAddrs.findFirst({
			columns: { agentUrl: true },
			where: eq(agentAddrs.agentId, agentId)
		})) ?? null
	);
}

// ===================================================================
// Agent Facts
// ===================================================================

/** Upsert agent facts — INSERT ON CONFLICT UPDATE */
export async function upsertAgentFacts(
	db: DbClient,
	agentId: string,
	factsJson: string,
	metadata?: {
		agentName?: string;
		providerDid?: string;
		jurisdiction?: string;
		certLevel?: string;
		schemaVersion?: string;
	}
) {
	return await db
		.insert(agentFacts)
		.values({ agentId, factsJson, ...metadata })
		.onConflictDoUpdate({
			target: agentFacts.agentId,
			set: {
				factsJson: sql`excluded.facts_json`,
				agentName: sql`excluded.agent_name`,
				providerDid: sql`excluded.provider_did`,
				jurisdiction: sql`excluded.jurisdiction`,
				certLevel: sql`excluded.cert_level`,
				schemaVersion: sql`excluded.schema_version`,
				updatedAt: sql`(unixepoch())`
			}
		});
}

/** Get agent facts JSON by agent ID */
export async function getAgentFacts(db: DbClient, agentId: string) {
	return (
		(await db.query.agentFacts.findFirst({
			where: eq(agentFacts.agentId, agentId)
		})) ?? null
	);
}

// ===================================================================
// Agent Facts v2 (Phase 6 — Agent Bali)
// ===================================================================

/** Upsert agent facts with v2 extensions — trust_score, compliance, VC envelope */
export async function upsertAgentFactsV2(
	db: DbClient,
	agentId: string,
	factsJson: string,
	metadata?: {
		agentName?: string;
		providerDid?: string;
		jurisdiction?: string;
		certLevel?: string;
		schemaVersion?: string;
		trustScore?: number;
		complianceStatus?: string;
		complianceCheckedAt?: string;
		vcJson?: string;
		vcIssuedAt?: number;
		vcExpiresAt?: number;
		disclosurePolicy?: string;
	}
) {
	return await db
		.insert(agentFacts)
		.values({ agentId, factsJson, ...metadata })
		.onConflictDoUpdate({
			target: agentFacts.agentId,
			set: {
				factsJson: sql`excluded.facts_json`,
				agentName: sql`excluded.agent_name`,
				providerDid: sql`excluded.provider_did`,
				jurisdiction: sql`excluded.jurisdiction`,
				certLevel: sql`excluded.cert_level`,
				schemaVersion: sql`excluded.schema_version`,
				trustScore: sql`excluded.trust_score`,
				complianceStatus: sql`excluded.compliance_status`,
				complianceCheckedAt: sql`excluded.compliance_checked_at`,
				vcJson: sql`excluded.vc_json`,
				vcIssuedAt: sql`excluded.vc_issued_at`,
				vcExpiresAt: sql`excluded.vc_expires_at`,
				disclosurePolicy: sql`excluded.disclosure_policy`,
				updatedAt: sql`(unixepoch())`
			}
		});
}

/** Update only the v2 extension columns (trust_score, compliance, VC) without touching facts_json */
export async function updateAgentFactsV2Metadata(
	db: DbClient,
	agentId: string,
	v2: {
		trustScore?: number;
		complianceStatus?: string;
		complianceCheckedAt?: string;
		vcJson?: string;
		vcIssuedAt?: number;
		vcExpiresAt?: number;
		disclosurePolicy?: string;
	}
) {
	const set: Record<string, unknown> = { updatedAt: sql`(unixepoch())` };
	if (v2.trustScore !== undefined) set.trustScore = v2.trustScore;
	if (v2.complianceStatus !== undefined) set.complianceStatus = v2.complianceStatus;
	if (v2.complianceCheckedAt !== undefined) set.complianceCheckedAt = v2.complianceCheckedAt;
	if (v2.vcJson !== undefined) set.vcJson = v2.vcJson;
	if (v2.vcIssuedAt !== undefined) set.vcIssuedAt = v2.vcIssuedAt;
	if (v2.vcExpiresAt !== undefined) set.vcExpiresAt = v2.vcExpiresAt;
	if (v2.disclosurePolicy !== undefined) set.disclosurePolicy = v2.disclosurePolicy;

	return await db.update(agentFacts).set(set).where(eq(agentFacts.agentId, agentId));
}

// ===================================================================
// Version-aware Queries (Phase 4 — Agent Alpha)
// ===================================================================

/** Get agent by composite ID (agentId@version) — looks up versioned record first, falls back to base agent */
export async function getAgentByVersion(db: DbClient, agentId: string, version: string) {
	// Look up the specific version in agent_versions table
	const versionRow = await db.query.agentVersions.findFirst({
		where: and(eq(agentVersions.agentId, agentId), eq(agentVersions.version, version))
	});
	if (versionRow) return versionRow;

	// Fall back to the base agent row if its current version matches
	const agentRow = await db.query.agentAddrs.findFirst({
		where: eq(agentAddrs.agentId, agentId)
	});
	if (agentRow && agentRow.version === version) return agentRow;

	return null;
}

/** Update version on the agent_addrs table */
export async function updateAgentVersion(db: DbClient, agentId: string, version: string) {
	return await db
		.update(agentAddrs)
		.set({ version, updatedAt: sql`(unixepoch())` })
		.where(eq(agentAddrs.agentId, agentId));
}

// ===================================================================
// Helpers
// ===================================================================

/** Safely parse a JSON array string, returning [] on failure */
function safeParseJsonArray(json: string | null): string[] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
