/**
 * Deprecation Repository — typed data access for agent deprecation lifecycle.
 *
 * Queries the agent_addrs table (columns: status, deprecated_at, sunset_at).
 */

import { eq, and, sql, lte } from 'drizzle-orm';
import type { DbClient } from '../client';
import { agentAddrs } from '../schema';

// ===================================================================
// Read Queries
// ===================================================================

/** Get all agents with status = 'deprecated', ordered by sunset_at ASC */
export async function getDeprecatedAgents(db: DbClient) {
	return await db
		.select()
		.from(agentAddrs)
		.where(eq(agentAddrs.status, 'deprecated'))
		.orderBy(agentAddrs.sunsetAt);
}

/** Get deprecated agents past their sunset date (ready to tombstone) */
export async function getSunsetExpiredAgents(db: DbClient) {
	const now = Math.floor(Date.now() / 1000);
	return await db
		.select()
		.from(agentAddrs)
		.where(and(eq(agentAddrs.status, 'deprecated'), lte(agentAddrs.sunsetAt, now)));
}

/** Get deprecation info for a specific agent */
export async function getAgentDeprecationInfo(db: DbClient, agentId: string) {
	const [row] = await db
		.select({
			agentId: agentAddrs.agentId,
			status: agentAddrs.status,
			version: agentAddrs.version,
			deprecatedAt: agentAddrs.deprecatedAt,
			sunsetAt: agentAddrs.sunsetAt
		})
		.from(agentAddrs)
		.where(eq(agentAddrs.agentId, agentId));
	return row ?? null;
}

/** Get all agents with status 'deprecated' or 'tombstoned' for admin view */
export async function getDeprecatedAndTombstonedAgents(db: DbClient) {
	return await db
		.select({
			agentId: agentAddrs.agentId,
			agentUrl: agentAddrs.agentUrl,
			status: agentAddrs.status,
			version: agentAddrs.version,
			deprecatedAt: agentAddrs.deprecatedAt,
			sunsetAt: agentAddrs.sunsetAt,
			updatedAt: agentAddrs.updatedAt
		})
		.from(agentAddrs)
		.where(sql`${agentAddrs.status} IN ('deprecated', 'tombstoned')`)
		.orderBy(
			sql`CASE WHEN ${agentAddrs.status} = 'deprecated' THEN 0 ELSE 1 END`,
			agentAddrs.sunsetAt
		);
}

// ===================================================================
// Write Operations
// ===================================================================

/** Mark an agent as deprecated with a sunset date */
export async function markAgentDeprecated(
	db: DbClient,
	agentId: string,
	deprecatedAt: number,
	sunsetAt: number
) {
	return await db
		.update(agentAddrs)
		.set({
			status: 'deprecated',
			deprecatedAt,
			sunsetAt,
			updatedAt: sql`(unixepoch())`
		})
		.where(eq(agentAddrs.agentId, agentId));
}

/** Mark an agent as tombstoned */
export async function tombstoneAgentRecord(db: DbClient, agentId: string) {
	return await db
		.update(agentAddrs)
		.set({
			status: 'tombstoned',
			updatedAt: sql`(unixepoch())`
		})
		.where(eq(agentAddrs.agentId, agentId));
}
