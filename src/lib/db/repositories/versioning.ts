/**
 * Versioning Repository — typed data access for agent_versions table.
 *
 * Phase 4 — Agent Alpha
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { agentVersions, type NewAgentVersion, type AgentVersion } from '../schema';

// ===================================================================
// Agent Version CRUD
// ===================================================================

/** Insert a new agent version record */
export async function insertAgentVersion(
	db: DbClient,
	data: NewAgentVersion
): Promise<AgentVersion> {
	const result = await db.insert(agentVersions).values(data).returning();
	return result[0];
}

/** Get a specific version of an agent */
export async function getAgentVersion(
	db: DbClient,
	agentId: string,
	version: string
): Promise<AgentVersion | null> {
	return (
		(await db.query.agentVersions.findFirst({
			where: and(eq(agentVersions.agentId, agentId), eq(agentVersions.version, version))
		})) ?? null
	);
}

/** List all versions for an agent, newest first */
export async function listAgentVersions(db: DbClient, agentId: string): Promise<AgentVersion[]> {
	return await db
		.select()
		.from(agentVersions)
		.where(eq(agentVersions.agentId, agentId))
		.orderBy(sql`${agentVersions.createdAt} DESC`);
}

/** Update a version's status and optional deprecation/sunset timestamps */
export async function updateVersionStatus(
	db: DbClient,
	id: string,
	status: string,
	deprecatedAt?: number,
	sunsetAt?: number
): Promise<void> {
	const set: Record<string, unknown> = { status };
	if (deprecatedAt !== undefined) set.deprecatedAt = deprecatedAt;
	if (sunsetAt !== undefined) set.sunsetAt = sunsetAt;
	await db.update(agentVersions).set(set).where(eq(agentVersions.id, id));
}

/** Get all active (alive) versions for an agent */
export async function getActiveVersions(db: DbClient, agentId: string): Promise<AgentVersion[]> {
	return await db
		.select()
		.from(agentVersions)
		.where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.status, 'alive')))
		.orderBy(sql`${agentVersions.createdAt} DESC`);
}
