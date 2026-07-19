/**
 * Protocol constants — stable, non-tenant-configurable namespace URIs.
 *
 * The values in this module identify *semantic namespaces* — Nexartis-authored
 * schemas / JSON-LD contexts that must be byte-stable across every tenant
 * deployment so that VC verifiers (which key their JSON-LD context caches by
 * exact URI) accept credentials issued by any NANDA node in the federation.
 *
 * ⚠️ These are NOT service endpoints. They are identifiers. Do NOT swap them
 * to a tenant's own domain — that would fork the schema namespace and every
 * federation peer would reject the tenant's VCs as "unknown context".
 *
 * If a value below ever needs to move to a tenant-specific origin, that is a
 * *federation-breaking* schema change: update the version suffix (e.g. `/v2`
 * → `/v3`) and coordinate a two-phase rollout with every peer node.
 */

/**
 * JSON-LD context URI for AgentFacts v2 Verifiable Credentials.
 *
 * Referenced from every AgentFacts VC issued by any NANDA node. Persisted
 * verbatim inside signed credentials — mutating it invalidates historical
 * signatures. Owned by Nexartis as the schema author; served (or intended to
 * be served) from `nanda.nexartis.com/ns/agentfacts/v2`.
 */
export const AGENTFACTS_V2_CONTEXT_URI = 'https://nanda.nexartis.com/ns/agentfacts/v2';

/**
 * Default governance URL for the built-in KYM ("KnowYourModel") trust
 * framework. This framework is Nexartis-authored and its governance
 * documentation lives at knowyourmodel.ai — tenant nodes federate against
 * the same framework identifier so the URL is a stable Nexartis-owned
 * pointer, not tenant-configurable branding.
 *
 * Operators who want to publish an alternative governance URL for the KYM
 * framework may override at runtime via `env.TRUST_FRAMEWORK_GOVERNANCE_URL`
 * (see `src/lib/services/trust-framework/toip-alignment.ts`).
 */
export const KYM_TRUST_FRAMEWORK_DEFAULT_GOVERNANCE_URL = 'https://knowyourmodel.ai/docs';
