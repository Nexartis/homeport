/**
 * Registry Service — Drizzle ORM operations for NANDA agent registry.
 * Reference: nanda-index/registry.py
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { clients } from '$lib/db/schema';
import {
	upsertAgent,
	getAgentById,
	listAllAgents,
	searchAgents as repoSearchAgents,
	deleteAgent as repoDeleteAgent,
	updateAgentStatus as repoUpdateAgentStatus,
	getAgentStats,
	upsertAgentFacts,
	getAgentFacts as repoGetAgentFacts,
	upsertAgentFactsV2
} from '$lib/db/repositories';
import { detectSchemaVersion, validateAgentFactsV2 } from '$lib/types/agentfacts-v2';

// Required fields for AgentFacts v1 validation
const AGENTFACTS_REQUIRED = [
	'id',
	'agent_name',
	'label',
	'description',
	'version',
	'provider',
	'endpoints',
	'capabilities',
	'skills'
] as const;

// ---------- Helpers ----------

export function safeParseTags(raw: unknown): string[] {
	if (!raw || typeof raw !== 'string') return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
}

/** Convert a Drizzle agent row (camelCase) to the snake_case Record callers expect */
export function toAgentRecord(row: {
	agentId: string;
	agentUrl: string | null;
	apiUrl: string | null;
	factsUrl: string | null;
	capabilities: string | null;
	tags: string | null;
	source: string | null;
	status: string | null;
	registeredAt: number | null;
	updatedAt: number | null;
}): Record<string, unknown> {
	return {
		agent_id: row.agentId,
		agent_url: row.agentUrl,
		api_url: row.apiUrl,
		facts_url: row.factsUrl,
		capabilities: safeParseTags(row.capabilities),
		tags: safeParseTags(row.tags),
		source: row.source,
		status: row.status,
		registered_at: row.registeredAt,
		updated_at: row.updatedAt
	};
}

// ---------- Agent CRUD ----------

export async function registerAgent(
	db: DbClient,
	agent: {
		agent_id: string;
		agent_url: string;
		api_url?: string;
		facts_url?: string;
		capabilities?: string[];
		tags?: string[];
		source?: string;
		/** Lifecycle status override. Defaults to 'alive' for new registrations. */
		status?: string;
		/** Ed25519 signing fields — REQUIRED, no fallbacks */
		publicKeyHex: string;
		signatureHex: string;
		signerId: string;
	}
): Promise<void> {
	await upsertAgent(db, {
		agentId: agent.agent_id,
		agentUrl: agent.agent_url,
		apiUrl: agent.api_url ?? null,
		factsUrl: agent.facts_url ?? null,
		capabilities: agent.capabilities ? JSON.stringify(agent.capabilities) : null,
		tags: agent.tags ? JSON.stringify(agent.tags) : null,
		source: agent.source ?? 'local',
		status: agent.status ?? 'alive',
		publicKeyHex: agent.publicKeyHex,
		signatureHex: agent.signatureHex,
		signerId: agent.signerId
	});
}

export async function lookupAgent(
	db: DbClient,
	agentId: string
): Promise<Record<string, unknown> | null> {
	const row = await getAgentById(db, agentId);
	if (!row) return null;
	return toAgentRecord(row);
}

export async function listAgents(db: DbClient): Promise<Record<string, string>> {
	const rows = await listAllAgents(db);
	const flat: Record<string, string> = {};
	for (const r of rows) {
		flat[r.agentId] = r.agentUrl ?? '';
	}
	return flat;
}

export async function searchAgents(
	db: DbClient,
	query?: string,
	capabilities?: string[],
	tags?: string[]
): Promise<Record<string, unknown>[]> {
	// Use repo for SQL-level query filter
	const rows = await repoSearchAgents(db, { query });

	let agents = rows.map(toAgentRecord);

	// In-memory multi-value capability/tag filtering (JSON arrays stored as TEXT)
	if (capabilities?.length) {
		agents = agents.filter((a) => {
			const caps = Array.isArray(a.capabilities) ? (a.capabilities as string[]) : [];
			return capabilities.some((c) => caps.includes(c));
		});
	}
	if (tags?.length) {
		agents = agents.filter((a) => {
			const t = Array.isArray(a.tags) ? (a.tags as string[]) : [];
			return tags.some((tag) => t.includes(tag));
		});
	}

	return agents;
}

export async function deleteAgent(db: DbClient, agentId: string): Promise<boolean> {
	const existing = await getAgentById(db, agentId);
	if (!existing) return false;
	await repoDeleteAgent(db, agentId);
	return true;
}

export async function updateAgentStatus(
	db: DbClient,
	agentId: string,
	status: string,
	capabilities?: string[]
): Promise<boolean> {
	const existing = await getAgentById(db, agentId);
	if (!existing) return false;
	await repoUpdateAgentStatus(
		db,
		agentId,
		status,
		capabilities ? JSON.stringify(capabilities) : undefined
	);
	return true;
}

export async function getStats(db: DbClient) {
	const agentStats = await getAgentStats(db);
	const [clientRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(clients);
	return {
		total_agents: agentStats.total,
		alive_agents: agentStats.alive,
		total_clients: clientRow?.count ?? 0
	};
}

// ---------- AgentFacts v1 ----------

export function validateAgentFacts(facts: Record<string, unknown>): string[] {
	const errors: string[] = [];
	for (const field of AGENTFACTS_REQUIRED) {
		if (facts[field] === undefined || facts[field] === null) {
			errors.push(`Missing required field: ${field}`);
		}
	}
	return errors;
}

export async function storeAgentFacts(
	db: DbClient,
	agentId: string,
	factsJson: Record<string, unknown>
): Promise<{ ok: boolean; errors?: string[] }> {
	const errors = validateAgentFacts(factsJson);
	if (errors.length) return { ok: false, errors };

	await upsertAgentFacts(db, agentId, JSON.stringify(factsJson), {
		agentName: (factsJson.agent_name as string) ?? undefined,
		providerDid: ((factsJson.provider as Record<string, unknown>)?.did as string) ?? undefined,
		jurisdiction: (factsJson.jurisdiction as string) ?? undefined,
		certLevel: (factsJson.cert_level as string) ?? undefined,
		schemaVersion: (factsJson.version as string) ?? '1.0.0'
	});
	return { ok: true };
}

export async function getAgentFacts(
	db: DbClient,
	agentId: string
): Promise<Record<string, unknown> | null> {
	const row = await repoGetAgentFacts(db, agentId);
	if (!row) return null;
	return JSON.parse(row.factsJson);
}

// ---------- AgentFacts v2 (Phase 6 — Agent Bali) ----------

/** Store AgentFacts with v2 support — auto-detects schema version. */
export async function storeAgentFactsV2(
	db: DbClient,
	agentId: string,
	factsJson: Record<string, unknown>
): Promise<{ ok: boolean; errors?: string[]; schema_version: string }> {
	const version = detectSchemaVersion(factsJson);

	if (version === '2.0.0') {
		const errors = validateAgentFactsV2(factsJson);
		if (errors.length) return { ok: false, errors, schema_version: version };
	} else {
		// v1 validation
		const errors = validateAgentFacts(factsJson);
		if (errors.length) return { ok: false, errors, schema_version: version };
	}

	await upsertAgentFactsV2(db, agentId, JSON.stringify(factsJson), {
		agentName: (factsJson.agent_name as string) ?? undefined,
		providerDid: ((factsJson.provider as Record<string, unknown>)?.did as string) ?? undefined,
		jurisdiction: (factsJson.jurisdiction as string) ?? undefined,
		certLevel: (factsJson.cert_level as string) ?? undefined,
		schemaVersion: version,
		trustScore: (factsJson.trust_score as number) ?? undefined,
		complianceStatus: (factsJson.compliance_status as string) ?? undefined,
		complianceCheckedAt: (factsJson.compliance_checked_at as string) ?? undefined,
		disclosurePolicy: (factsJson.disclosure_policy as string) ?? undefined
	});
	return { ok: true, schema_version: version };
}
