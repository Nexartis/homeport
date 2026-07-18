/**
 * AgentFacts VC Wrapping Service — W3C Verifiable Credential envelope for AgentFacts v2
 * (Phase 6 — Agent Bali)
 *
 * Wraps an AgentFacts v2 document in a signed W3C VC with Ed25519Signature2020 proof.
 * Uses the existing key-rotation infrastructure for signing.
 */

import type { Env } from '$lib/types';
import type { DbClient } from '$lib/db/client';
import type { AgentFactsVC, AgentFactsV2Document } from '$lib/types/agentfacts-v2';
import { detectSchemaVersion } from '$lib/types/agentfacts-v2';
import { buildVCProof } from '$lib/services/certifier/key-rotation';
import { getAgentFacts, updateAgentFactsV2Metadata } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';
import { AGENTFACTS_V2_CONTEXT_URI } from '$lib/protocol-constants';

const log = createLogger(undefined, 'agentfacts-vc');

// ── VC Builder ──────────────────────────────────────────────────

/**
 * Build a W3C VC envelope around an AgentFacts v2 document.
 * @param env    - Worker env bindings (for signing key access)
 * @param agentId - Agent identifier (used as credentialSubject.id)
 * @param facts  - The AgentFacts v2 document to wrap
 * @param ttlHours - VC TTL in hours (default: 24)
 */
export async function buildAgentFactsVC(
	env: Env,
	agentId: string,
	facts: AgentFactsV2Document,
	ttlHours: number = 24
): Promise<AgentFactsVC> {
	const now = new Date();
	const expiration = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
	const credentialId = `urn:uuid:${crypto.randomUUID()}`;
	const issuerDid = `did:web:${env.NANDA_REGISTRY_URL.replace('https://', '')}`;

	const vc: AgentFactsVC = {
		// AGENTFACTS_V2_CONTEXT_URI is a stable Nexartis-owned JSON-LD schema
		// namespace identifier, NOT a tenant-configurable service endpoint.
		// See src/lib/protocol-constants.ts for the full rationale.
		'@context': ['https://www.w3.org/2018/credentials/v1', AGENTFACTS_V2_CONTEXT_URI],
		type: ['VerifiableCredential', 'AgentFactsCredential'],
		id: credentialId,
		issuer: issuerDid,
		issuanceDate: now.toISOString(),
		expirationDate: expiration.toISOString(),
		credentialSubject: {
			id: agentId,
			...facts,
			schema_version:
				facts.schema_version ?? detectSchemaVersion(facts as unknown as Record<string, unknown>)
		},
		credentialStatus: {
			id: `${env.NANDA_REGISTRY_URL}/.well-known/vc-status/agentfacts-2026#${credentialId}`,
			type: 'StatusList2021Entry',
			statusPurpose: 'revocation',
			statusListIndex: '0',
			statusListCredential: `${env.NANDA_REGISTRY_URL}/.well-known/vc-status/agentfacts-2026`
		}
	};

	// Sign with Ed25519
	try {
		const proof = await buildVCProof(env, JSON.stringify(vc));
		vc.proof = proof as AgentFactsVC['proof'];
	} catch (err) {
		log.warn('buildAgentFactsVC', 'VC signing failed — marking as unsigned', {
			agentId,
			error: err instanceof Error ? err.message : String(err)
		});
		// Explicitly signal that this credential is unsigned so verifiers don't assume it's valid
		(vc as unknown as Record<string, unknown>)['x-unsigned'] = true;
		(vc as unknown as Record<string, unknown>)['x-unsigned-reason'] =
			err instanceof Error ? err.message : 'signing_failed';
	}

	return vc;
}

// ── Store VC in DB ──────────────────────────────────────────────

/**
 * Build a VC for an agent's existing AgentFacts record and store it in the v2 columns.
 * Returns the VC or null if facts don't exist.
 */
export async function issueAndStoreAgentFactsVC(
	env: Env,
	db: DbClient,
	agentId: string
): Promise<AgentFactsVC | null> {
	const factsRow = await getAgentFacts(db, agentId);
	if (!factsRow) return null;

	let factsDoc: AgentFactsV2Document;
	try {
		factsDoc = JSON.parse(factsRow.factsJson) as AgentFactsV2Document;
	} catch {
		log.error('issueAndStoreAgentFactsVC', 'Failed to parse facts JSON', { agentId });
		return null;
	}

	// Enrich with stored v2 metadata
	if (factsRow.trustScore !== null) factsDoc.trust_score = factsRow.trustScore;
	if (factsRow.complianceStatus)
		factsDoc.compliance_status =
			factsRow.complianceStatus as AgentFactsV2Document['compliance_status'];
	if (factsRow.disclosurePolicy)
		factsDoc.disclosure_policy =
			factsRow.disclosurePolicy as AgentFactsV2Document['disclosure_policy'];

	const vc = await buildAgentFactsVC(env, agentId, factsDoc);
	const now = Math.floor(Date.now() / 1000);
	const ttlHours = 24;

	// Persist VC in the v2 columns
	await updateAgentFactsV2Metadata(db, agentId, {
		vcJson: JSON.stringify(vc),
		vcIssuedAt: now,
		vcExpiresAt: now + ttlHours * 3600
	});

	log.info('issueAndStoreAgentFactsVC', `VC issued for ${agentId}`, {
		agentId,
		signed: !!vc.proof,
		expiresAt: new Date((now + ttlHours * 3600) * 1000).toISOString()
	});

	return vc;
}

// ── Retrieve Cached VC ──────────────────────────────────────────

/**
 * Get the cached VC for an agent. If expired or missing, re-issue.
 */
export async function getOrIssueAgentFactsVC(
	env: Env,
	db: DbClient,
	agentId: string
): Promise<AgentFactsVC | null> {
	const factsRow = await getAgentFacts(db, agentId);
	if (!factsRow) return null;

	// Check if we have a valid cached VC
	if (factsRow.vcJson && factsRow.vcExpiresAt) {
		const now = Math.floor(Date.now() / 1000);
		if (factsRow.vcExpiresAt > now) {
			try {
				return JSON.parse(factsRow.vcJson) as AgentFactsVC;
			} catch {
				// Corrupted — re-issue below
			}
		}
	}

	// Issue fresh VC
	return await issueAndStoreAgentFactsVC(env, db, agentId);
}
