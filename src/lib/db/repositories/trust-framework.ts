/**
 * Trust Framework Repository — typed data access for trust_framework_meta
 * and trust_graph_edges tables.
 *
 * Phase 3 — Agent Gamma
 */

import { eq, or, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	trustFrameworkMeta,
	trustGraphEdges,
	type NewTrustFrameworkMeta,
	type NewTrustGraphEdge
} from '../schema';

// ===================================================================
// Trust Framework Metadata
// ===================================================================

/**
 * Insert or update a trust framework registration.
 * Uses INSERT OR REPLACE on the framework_id unique constraint.
 */
export async function upsertTrustFramework(db: DbClient, framework: NewTrustFrameworkMeta) {
	return await db
		.insert(trustFrameworkMeta)
		.values(framework)
		.onConflictDoUpdate({
			target: trustFrameworkMeta.frameworkId,
			set: {
				name: framework.name,
				version: framework.version,
				governanceUrl: framework.governanceUrl,
				alignment: framework.alignment
			}
		});
}

/**
 * Get all registered trust frameworks.
 */
export async function getAllTrustFrameworks(db: DbClient) {
	return await db
		.select()
		.from(trustFrameworkMeta)
		.orderBy(sql`created_at DESC`);
}

/**
 * Get a trust framework by its framework_id.
 */
export async function getTrustFrameworkById(db: DbClient, frameworkId: string) {
	return (
		(await db.query.trustFrameworkMeta.findFirst({
			where: eq(trustFrameworkMeta.frameworkId, frameworkId)
		})) ?? null
	);
}

// ===================================================================
// Trust Graph Edges
// ===================================================================

/**
 * Insert or update a trust graph edge.
 * Uses INSERT OR REPLACE on the (from_did, to_did, relationship) unique constraint.
 */
export async function upsertTrustEdge(db: DbClient, edge: NewTrustGraphEdge) {
	return await db
		.insert(trustGraphEdges)
		.values(edge)
		.onConflictDoUpdate({
			target: [trustGraphEdges.fromDid, trustGraphEdges.toDid, trustGraphEdges.relationship],
			set: {
				trustLevel: edge.trustLevel,
				evidenceUri: edge.evidenceUri,
				frameworkId: edge.frameworkId,
				validFrom: edge.validFrom,
				validUntil: edge.validUntil
			}
		});
}

/**
 * Get all trust edges involving a DID (both directions).
 */
export async function getTrustEdgesForDid(db: DbClient, did: string) {
	return await db
		.select()
		.from(trustGraphEdges)
		.where(or(eq(trustGraphEdges.fromDid, did), eq(trustGraphEdges.toDid, did)));
}

/**
 * Get outgoing trust edges from a specific DID.
 */
export async function getOutgoingEdges(db: DbClient, fromDid: string) {
	return await db.select().from(trustGraphEdges).where(eq(trustGraphEdges.fromDid, fromDid));
}

/**
 * Get all trust graph edges (full graph).
 */
export async function getAllTrustEdges(db: DbClient) {
	return await db.select().from(trustGraphEdges);
}
