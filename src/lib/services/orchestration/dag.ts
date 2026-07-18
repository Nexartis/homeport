/**
 * DAG Validation — Directed Acyclic Graph utilities for workflow orchestration.
 * Phase 6 — Sprint 13
 *
 * Validates workflow DAGs for:
 *  1. No cycles (topological sort)
 *  2. All dependencies exist
 *  3. At least one root node (no incoming edges)
 *  4. All nodes reachable from roots
 */

import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'dag-validator');

export interface DagNode {
	id: string;
	type: string;
	data?: Record<string, unknown>;
}

export interface DagEdge {
	source: string;
	target: string;
	label?: string;
}

export interface DagDefinition {
	nodes: DagNode[];
	edges: DagEdge[];
}

export interface DagValidationResult {
	valid: boolean;
	errors: string[];
	executionOrder: string[]; // topological sort result
	rootNodes: string[];
	leafNodes: string[];
}

/**
 * Validate a DAG definition.
 * Returns validation result with topological execution order.
 */
export function validateDag(dag: DagDefinition): DagValidationResult {
	const errors: string[] = [];
	const nodeIds = new Set(dag.nodes.map((n) => n.id));

	// Check for empty DAG
	if (dag.nodes.length === 0) {
		return {
			valid: false,
			errors: ['DAG has no nodes'],
			executionOrder: [],
			rootNodes: [],
			leafNodes: []
		};
	}

	// Check for duplicate node IDs
	if (nodeIds.size !== dag.nodes.length) {
		errors.push('DAG contains duplicate node IDs');
	}

	// Check edges reference valid nodes
	for (const edge of dag.edges) {
		if (!nodeIds.has(edge.source)) {
			errors.push(`Edge source "${edge.source}" does not exist in nodes`);
		}
		if (!nodeIds.has(edge.target)) {
			errors.push(`Edge target "${edge.target}" does not exist in nodes`);
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors, executionOrder: [], rootNodes: [], leafNodes: [] };
	}

	// Build adjacency list and in-degree map
	const adj = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	for (const id of nodeIds) {
		adj.set(id, []);
		inDegree.set(id, 0);
	}

	for (const edge of dag.edges) {
		adj.get(edge.source)!.push(edge.target);
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
	}

	// Kahn's algorithm for topological sort + cycle detection
	const queue: string[] = [];
	const rootNodes: string[] = [];

	for (const [id, deg] of inDegree) {
		if (deg === 0) {
			queue.push(id);
			rootNodes.push(id);
		}
	}

	const executionOrder: string[] = [];
	while (queue.length > 0) {
		const node = queue.shift()!;
		executionOrder.push(node);

		for (const neighbor of adj.get(node) ?? []) {
			const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
			inDegree.set(neighbor, newDeg);
			if (newDeg === 0) {
				queue.push(neighbor);
			}
		}
	}

	// If not all nodes are in the order, there's a cycle
	if (executionOrder.length !== nodeIds.size) {
		errors.push('DAG contains a cycle — topological sort incomplete');
		return { valid: false, errors, executionOrder: [], rootNodes, leafNodes: [] };
	}

	// Find leaf nodes (no outgoing edges)
	const leafNodes = [...nodeIds].filter((id) => (adj.get(id) ?? []).length === 0);

	if (rootNodes.length === 0) {
		errors.push('DAG has no root nodes (all nodes have incoming edges)');
	}

	log.info(
		'validateDag',
		`DAG validated: ${dag.nodes.length} nodes, ${dag.edges.length} edges, ${rootNodes.length} roots`
	);

	return {
		valid: errors.length === 0,
		errors,
		executionOrder,
		rootNodes,
		leafNodes
	};
}

/**
 * Get the dependencies (predecessors) for a given node.
 */
export function getDependencies(dag: DagDefinition, nodeId: string): string[] {
	return dag.edges.filter((e) => e.target === nodeId).map((e) => e.source);
}

/**
 * Get the dependents (successors) for a given node.
 */
export function getDependents(dag: DagDefinition, nodeId: string): string[] {
	return dag.edges.filter((e) => e.source === nodeId).map((e) => e.target);
}

/**
 * Parse a DAG JSON string safely.
 */
export function parseDagJson(json: string): DagDefinition | null {
	try {
		const parsed = JSON.parse(json);
		if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
			return null;
		}
		return parsed as DagDefinition;
	} catch {
		return null;
	}
}
