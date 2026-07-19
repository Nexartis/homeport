/**
 * AgentAddr Repository — typed CRUD for the agent_addrs table (Phase 6 — Agent Bali).
 *
 * All functions take a DbClient as their first argument.
 */

import { eq, sql, lt, and } from 'drizzle-orm';
import type { DbClient } from '../client';
import { agentAddrs, type NewAgentAddrRecord } from '../schema';

// ── Upsert ──────────────────────────────────────────────────────

/** Insert or update an AgentAddr record. */
export async function upsertAgentAddr(db: DbClient, record: NewAgentAddrRecord) {
	const result = await db
		.insert(agentAddrs)
		.values(record)
		.onConflictDoUpdate({
			target: agentAddrs.agentId,
			set: {
				publicKeyHex: sql`excluded.public_key_hex`,
				factsUrl: sql`excluded.facts_url`,
				privateUrl: sql`excluded.private_url`,
				resolverUrl: sql`excluded.resolver_url`,
				ttlSeconds: sql`excluded.ttl_seconds`,
				signatureHex: sql`excluded.signature_hex`,
				signerId: sql`excluded.signer_id`,
				expiresAt: sql`excluded.expires_at`,
				source: sql`excluded.source`,
				quiltType: sql`excluded.quilt_type`,
				contentId: sql`excluded.content_id`,
				updatedAt: sql`(unixepoch())`
			}
		})
		.returning();
	return result[0];
}

// ── Read ────────────────────────────────────────────────────────

/** Get a single AgentAddr by agent_id. */
export async function getAgentAddr(db: DbClient, agentId: string) {
	return (
		(await db.query.agentAddrs.findFirst({
			where: eq(agentAddrs.agentId, agentId)
		})) ?? null
	);
}

/** List AgentAddrs with optional filters. */
export async function listAgentAddrs(
	db: DbClient,
	options?: {
		source?: string;
		quiltType?: string;
		limit?: number;
		offset?: number;
	}
) {
	const conditions = [];
	if (options?.source) {
		conditions.push(eq(agentAddrs.source, options.source));
	}
	if (options?.quiltType) {
		conditions.push(eq(agentAddrs.quiltType, options.quiltType));
	}

	let query = db
		.select()
		.from(agentAddrs)
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	if (options?.limit) {
		query = query.limit(options.limit) as typeof query;
	}
	if (options?.offset) {
		query = query.offset(options.offset) as typeof query;
	}

	return await query;
}

/** Get all AgentAddrs from a specific source (peer). */
export async function getAgentAddrsBySource(db: DbClient, source: string) {
	return await db.select().from(agentAddrs).where(eq(agentAddrs.source, source));
}

// ── Delete ──────────────────────────────────────────────────────

/** Delete an AgentAddr by agent_id. */
export async function deleteAgentAddr(db: DbClient, agentId: string) {
	return await db.delete(agentAddrs).where(eq(agentAddrs.agentId, agentId));
}

// ── Aggregate / Expiry ──────────────────────────────────────────

/** Count total AgentAddr records. */
export async function countAgentAddrs(db: DbClient) {
	const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(agentAddrs);
	return row?.count ?? 0;
}

/** Get records past their expires_at (for cleanup). */
export async function getExpiredAgentAddrs(db: DbClient) {
	const now = Math.floor(Date.now() / 1000);
	return await db
		.select()
		.from(agentAddrs)
		.where(and(lt(agentAddrs.expiresAt, now), sql`${agentAddrs.expiresAt} IS NOT NULL`));
}
