/**
 * Versioning Service — Agent version management for NANDA registry.
 *
 * Handles creating, listing, resolving versioned agent references.
 * Pattern: import from repositories, validate inputs, return typed results.
 *
 * Phase 4 — Agent Alpha
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { AgentVersion } from '$lib/db/schema';
import {
	insertAgentVersion,
	getAgentVersion,
	listAgentVersions as repoListVersions,
	getActiveVersions as repoGetActiveVersions,
	getAgentById,
	updateAgentVersion as repoUpdateAgentVersion
} from '$lib/db/repositories';

// ===================================================================
// Version ID Parsing
// ===================================================================

/**
 * Parse a versioned agent ID string.
 * "agent_id@1.2.0" → { agentId: "agent_id", version: "1.2.0" }
 * "agent_id"       → { agentId: "agent_id", version: undefined }
 */
export function parseVersionedId(input: string): { agentId: string; version?: string } {
	const atIdx = input.lastIndexOf('@');
	if (atIdx === -1 || atIdx === 0) {
		return { agentId: input };
	}
	const agentId = input.substring(0, atIdx);
	const version = input.substring(atIdx + 1);
	// Basic semver-like check: must contain at least one dot
	if (!version || !version.includes('.')) {
		return { agentId: input };
	}
	return { agentId, version };
}

// ===================================================================
// Version CRUD
// ===================================================================

/**
 * Create a new version record for an agent.
 * Also updates the main agents table to point to the new version.
 *
 * Note: Only the `version` field on the base agent row is updated.
 * The base agent's `agent_url` is intentionally invariant across versions —
 * it serves as the canonical endpoint for "latest" resolution.
 * Version-specific URLs are stored in the `agent_versions` table.
 */
export async function createVersion(
	db: DbClient,
	agentId: string,
	version: string,
	data: {
		agentUrl: string;
		apiUrl?: string | null;
		factsUrl?: string | null;
		capabilities?: string | null;
		changelog?: string | null;
	}
): Promise<AgentVersion> {
	// Verify agent exists
	const agent = await getAgentById(db, agentId);
	if (!agent) {
		throw new Error(`Agent not found: ${agentId}`);
	}

	// Check for duplicate version
	const existing = await getAgentVersion(db, agentId, version);
	if (existing) {
		throw new Error(`Version ${version} already exists for agent ${agentId}`);
	}

	// Insert version record
	const record = await insertAgentVersion(db, {
		id: nanoid(),
		agentId,
		version,
		agentUrl: data.agentUrl,
		apiUrl: data.apiUrl ?? null,
		factsUrl: data.factsUrl ?? null,
		capabilities: data.capabilities ?? null,
		changelog: data.changelog ?? null,
		status: 'alive'
	});

	// Update the main agent table to the latest version
	await repoUpdateAgentVersion(db, agentId, version);

	return record;
}

/** List all versions for an agent, newest first */
export async function listVersions(db: DbClient, agentId: string): Promise<AgentVersion[]> {
	return repoListVersions(db, agentId);
}

/** Get a specific version of an agent */
export async function getVersion(
	db: DbClient,
	agentId: string,
	version: string
): Promise<AgentVersion | null> {
	return getAgentVersion(db, agentId, version);
}

/** Get all active (alive) versions for an agent */
export async function getActiveVersions(db: DbClient, agentId: string): Promise<AgentVersion[]> {
	return repoGetActiveVersions(db, agentId);
}

/**
 * Resolve an agent address from a potentially versioned ID.
 * Supports "agent_id" (latest) or "agent_id@1.2.0" (specific version).
 *
 * Returns the resolved agentId, version, and URL.
 */
export async function resolveAgentAddress(
	db: DbClient,
	agentIdOrVersioned: string
): Promise<{ agentId: string; version: string; url: string | null } | null> {
	const { agentId, version } = parseVersionedId(agentIdOrVersioned);

	if (version) {
		// Look up specific version in agent_versions table
		const versionRecord = await getAgentVersion(db, agentId, version);
		if (!versionRecord) return null;
		return { agentId, version: versionRecord.version, url: versionRecord.agentUrl };
	}

	// No version specified — resolve to current agent entry
	const agent = await getAgentById(db, agentId);
	if (!agent) return null;
	return {
		agentId,
		version: agent.version ?? '1.0.0',
		url: agent.agentUrl
	};
}
