/**
 * Trust Graph Service
 *
 * Manages directed trust relationships between DIDs, supporting:
 * - Edge creation and retrieval
 * - Full graph queries for a DID (both inbound and outbound)
 * - BFS-based trust path computation between two DIDs
 * - Aggregate trust level along the shortest path
 *
 * Phase 3 — Agent Gamma
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import { upsertTrustEdge, getTrustEdgesForDid, getAllTrustEdges } from '$lib/db/repositories';
import type { NewTrustGraphEdge, TrustGraphEdge } from '$lib/db/schema';

// ===================================================================
// Types
// ===================================================================

export interface TrustEdgeInput {
	fromDid: string;
	toDid: string;
	relationship: string;
	trustLevel?: number;
	evidenceUri?: string;
	frameworkId?: string;
	validFrom?: number;
	validUntil?: number;
}

export interface TrustPath {
	from: string;
	to: string;
	edges: TrustGraphEdge[];
	hops: number;
	aggregateTrust: number;
}

// ===================================================================
// Service Functions
// ===================================================================

/**
 * Add a trust relationship edge to the graph.
 * If an edge with the same (fromDid, toDid, relationship) already exists, it is updated.
 */
export async function addTrustEdge(db: DbClient, edge: TrustEdgeInput): Promise<void> {
	const record: NewTrustGraphEdge = {
		id: nanoid(),
		fromDid: edge.fromDid,
		toDid: edge.toDid,
		relationship: edge.relationship,
		trustLevel: edge.trustLevel ?? 0,
		evidenceUri: edge.evidenceUri ?? null,
		frameworkId: edge.frameworkId ?? null,
		validFrom: edge.validFrom ?? null,
		validUntil: edge.validUntil ?? null
	};
	await upsertTrustEdge(db, record);
}

/**
 * Get all trust edges for a DID (both directions — inbound and outbound).
 */
export async function getTrustGraph(
	db: DbClient,
	did: string
): Promise<{ incoming: TrustGraphEdge[]; outgoing: TrustGraphEdge[] }> {
	const edges = await getTrustEdgesForDid(db, did);
	return {
		incoming: edges.filter((e) => e.toDid === did),
		outgoing: edges.filter((e) => e.fromDid === did)
	};
}

/**
 * BFS to find the shortest trust chain between two DIDs.
 *
 * Traverses outgoing edges from `fromDid` until `toDid` is reached or
 * the graph is exhausted. Returns null if no path exists.
 *
 * Max depth is capped at 10 to prevent runaway traversals.
 */
export async function computeTrustPath(
	db: DbClient,
	fromDid: string,
	toDid: string
): Promise<TrustPath | null> {
	if (fromDid === toDid) {
		return { from: fromDid, to: toDid, edges: [], hops: 0, aggregateTrust: 1.0 };
	}

	const MAX_DEPTH = 10;

	// Build adjacency map from all edges (we load the full graph for BFS)
	const allEdges = await getAllTrustEdges(db);

	// Filter out expired or not-yet-valid edges
	const now = Math.floor(Date.now() / 1000);
	const validEdges = allEdges.filter((e) => {
		if (e.validFrom && e.validFrom > now) return false; // not yet valid
		if (e.validUntil && e.validUntil < now) return false; // expired
		return true;
	});

	const adjacency = new Map<string, TrustGraphEdge[]>();
	for (const edge of validEdges) {
		const existing = adjacency.get(edge.fromDid) ?? [];
		existing.push(edge);
		adjacency.set(edge.fromDid, existing);
	}

	// BFS
	const visited = new Set<string>([fromDid]);
	// Each queue entry: [currentDid, pathEdges[]]
	const queue: Array<[string, TrustGraphEdge[]]> = [[fromDid, []]];

	while (queue.length > 0) {
		const [current, path] = queue.shift()!;

		if (path.length >= MAX_DEPTH) continue;

		const neighbors = adjacency.get(current) ?? [];
		for (const edge of neighbors) {
			if (edge.toDid === toDid) {
				const fullPath = [...path, edge];
				return {
					from: fromDid,
					to: toDid,
					edges: fullPath,
					hops: fullPath.length,
					aggregateTrust: computeAggregateTrust(fullPath)
				};
			}
			if (!visited.has(edge.toDid)) {
				visited.add(edge.toDid);
				queue.push([edge.toDid, [...path, edge]]);
			}
		}
	}

	return null; // No path found
}

/**
 * Get the aggregate trust level along the shortest path between two DIDs.
 * Returns 0 if no path exists.
 *
 * Trust is multiplicative along the path: each hop's trustLevel is multiplied.
 */
export async function getTrustLevel(db: DbClient, fromDid: string, toDid: string): Promise<number> {
	const path = await computeTrustPath(db, fromDid, toDid);
	return path?.aggregateTrust ?? 0;
}

/**
 * Compute aggregate trust as the product of individual edge trust levels.
 * Multiplicative model: trust diminishes with each hop.
 */
function computeAggregateTrust(edges: TrustGraphEdge[]): number {
	if (edges.length === 0) return 1.0;
	return edges.reduce((acc, e) => acc * (e.trustLevel ?? 0), 1.0);
}
