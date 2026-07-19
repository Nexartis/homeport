/**
 * ToIP Alignment Service
 *
 * Manages trust framework metadata aligned with DIF/ToIP Trust Spanning Protocol.
 * Provides framework registration, listing, and agent alignment checks.
 *
 * Frameworks describe governance and trust policies that agents operate under.
 * Alignment indicates which standard a framework follows (e.g. toip-tswg, dif-trust-graph).
 *
 * Phase 3 — Agent Gamma
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import {
	upsertTrustFramework,
	getAllTrustFrameworks,
	getTrustFrameworkById,
	getTrustEdgesForDid
} from '$lib/db/repositories';
import type { NewTrustFrameworkMeta, TrustFrameworkMeta, TrustGraphEdge } from '$lib/db/schema';
import { KYM_TRUST_FRAMEWORK_DEFAULT_GOVERNANCE_URL } from '$lib/protocol-constants';

// ===================================================================
// Constants
// ===================================================================

/**
 * Pre-seeded KYM trust framework.
 *
 * `governanceUrl` defaults to the Nexartis-owned KYM governance page (a
 * stable framework-identity pointer, not a tenant service endpoint — see
 * `src/lib/protocol-constants.ts`). Operators can override at runtime by
 * setting `env.TRUST_FRAMEWORK_GOVERNANCE_URL` and passing it to
 * `seedDefaultFramework()`.
 */
export const KYM_FRAMEWORK: Omit<NewTrustFrameworkMeta, 'id'> = {
	frameworkId: 'kym-trust-v1',
	name: 'KnowYourModel Trust Framework',
	version: '1.0',
	governanceUrl: KYM_TRUST_FRAMEWORK_DEFAULT_GOVERNANCE_URL,
	alignment: 'toip-tswg'
};

/** Known alignment standards */
export const ALIGNMENT_STANDARDS = ['toip-tswg', 'dif-trust-graph', 'w3c-vc'] as const;
export type AlignmentStandard = (typeof ALIGNMENT_STANDARDS)[number];

// ===================================================================
// Types
// ===================================================================

export interface AlignmentResult {
	agentDid: string;
	frameworks: TrustFrameworkMeta[];
	edges: TrustGraphEdge[];
	aligned: boolean;
	alignedFrameworks: string[];
}

// ===================================================================
// Service Functions
// ===================================================================

/**
 * Register a trust framework.
 * Upserts by framework_id — safe to call repeatedly.
 */
export async function registerFramework(
	db: DbClient,
	framework: Omit<NewTrustFrameworkMeta, 'id'>
): Promise<TrustFrameworkMeta> {
	const id = nanoid();
	await upsertTrustFramework(db, { id, ...framework });
	// Return the stored framework
	const stored = await getTrustFrameworkById(db, framework.frameworkId);
	if (!stored) {
		throw new Error(
			`Framework upsert succeeded but read-back failed for '${framework.frameworkId}'`
		);
	}
	return stored;
}

/**
 * List all registered trust frameworks.
 */
export async function getFrameworks(db: DbClient): Promise<TrustFrameworkMeta[]> {
	return await getAllTrustFrameworks(db);
}

/**
 * Check an agent's alignment with registered trust frameworks.
 *
 * An agent is considered "aligned" if:
 * 1. They have trust edges referencing a framework_id that exists in trust_framework_meta
 * 2. At least one edge has a non-zero trust_level
 *
 * Returns the list of frameworks the agent is aligned with.
 */
export async function alignWithToIP(db: DbClient, agentDid: string): Promise<AlignmentResult> {
	const [frameworks, edges] = await Promise.all([
		getAllTrustFrameworks(db),
		getTrustEdgesForDid(db, agentDid)
	]);

	const frameworkIds = new Set(frameworks.map((f) => f.frameworkId));

	// Find edges that reference a registered framework with trust_level > 0
	const alignedEdges = edges.filter(
		(e) => e.frameworkId && frameworkIds.has(e.frameworkId) && (e.trustLevel ?? 0) > 0
	);

	const alignedFrameworkIds = [...new Set(alignedEdges.map((e) => e.frameworkId!))];

	return {
		agentDid,
		frameworks,
		edges,
		aligned: alignedFrameworkIds.length > 0,
		alignedFrameworks: alignedFrameworkIds
	};
}

/**
 * Seed the default KYM trust framework if not already present.
 *
 * Pass `{ governanceUrl }` to override the framework's governance URL from
 * an env var (`env.TRUST_FRAMEWORK_GOVERNANCE_URL`). Callers that don't need
 * to override may omit the second argument and inherit the stable default.
 */
export async function seedDefaultFramework(
	db: DbClient,
	overrides?: { governanceUrl?: string }
): Promise<TrustFrameworkMeta> {
	const existing = await getTrustFrameworkById(db, KYM_FRAMEWORK.frameworkId);
	if (existing) {
		// Honour a runtime governanceUrl override even after the first seed —
		// otherwise env.TRUST_FRAMEWORK_GOVERNANCE_URL would never take effect
		// on nodes whose framework row already exists.
		const override = overrides?.governanceUrl?.trim();
		if (override && override !== existing.governanceUrl) {
			return await registerFramework(db, {
				frameworkId: existing.frameworkId,
				name: existing.name,
				version: existing.version,
				governanceUrl: override,
				alignment: existing.alignment
			});
		}
		return existing;
	}
	const framework: Omit<NewTrustFrameworkMeta, 'id'> = {
		...KYM_FRAMEWORK,
		governanceUrl: overrides?.governanceUrl?.trim() || KYM_FRAMEWORK.governanceUrl
	};
	return await registerFramework(db, framework);
}
