/**
 * Resolution Log Repository — typed data access for resolution_log
 * and protocol_adapters tables.
 * Phase 6 — Agent California
 */

import { eq, desc, sql, and } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	resolutionLog,
	protocolAdapters,
	type NewResolutionLogRecord,
	type NewProtocolAdapterRecord
} from '../schema';

// ===================================================================
// Resolution Log
// ===================================================================

/** Insert a resolution log entry */
export async function insertResolutionLog(db: DbClient, data: NewResolutionLogRecord) {
	await db.insert(resolutionLog).values(data);
	return data.id;
}

/** Get recent resolution logs for an agent */
export async function getResolutionLogs(db: DbClient, agentId: string, limit = 50) {
	return await db
		.select()
		.from(resolutionLog)
		.where(eq(resolutionLog.agentId, agentId))
		.orderBy(desc(resolutionLog.createdAt))
		.limit(limit);
}

/** Get resolution stats for an agent */
export async function getResolutionStats(db: DbClient, agentId: string) {
	const [total] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(resolutionLog)
		.where(eq(resolutionLog.agentId, agentId));
	const [cached] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(resolutionLog)
		.where(and(eq(resolutionLog.agentId, agentId), eq(resolutionLog.cacheHit, 1)));
	return {
		total: total?.count ?? 0,
		cached: cached?.count ?? 0,
		cacheHitRate: (total?.count ?? 0) > 0 ? (cached?.count ?? 0) / (total?.count ?? 1) : 0
	};
}

// ===================================================================
// Protocol Adapters
// ===================================================================

/** Upsert a protocol adapter record for an agent */
export async function upsertProtocolAdapter(db: DbClient, data: NewProtocolAdapterRecord) {
	await db
		.insert(protocolAdapters)
		.values(data)
		.onConflictDoUpdate({
			target: protocolAdapters.id,
			set: {
				protocol: sql`excluded.protocol`,
				metadataJson: sql`excluded.metadata_json`,
				lastSyncedAt: sql`(unixepoch())`
			}
		});
	return data.id;
}

/** Get protocol adapters for an agent */
export async function getProtocolAdapters(db: DbClient, agentId: string) {
	return await db.select().from(protocolAdapters).where(eq(protocolAdapters.agentId, agentId));
}

/** Get protocol adapter by protocol type for an agent */
export async function getProtocolAdapter(db: DbClient, agentId: string, protocol: string) {
	return (
		(await db.query.protocolAdapters.findFirst({
			where: and(eq(protocolAdapters.agentId, agentId), eq(protocolAdapters.protocol, protocol))
		})) ?? null
	);
}

/** Delete protocol adapters for an agent */
export async function deleteProtocolAdapters(db: DbClient, agentId: string) {
	return await db.delete(protocolAdapters).where(eq(protocolAdapters.agentId, agentId));
}
