/**
 * Delegation Grants — NND-D1 (master release train, NEX-56).
 *
 * Server-side implementation of the A2A `delegation.grant` / `.revoke` /
 * `.check` actions defined in
 * `nexartis-system-architecture/decisions/ADR-2026-07-04-proof-of-unique-human-for-agentic-delegation.md`
 * (Layer 3).
 *
 * Load-bearing invariants (ARCH-2 M2, server-side and mandatory):
 *   1. Chain-narrowing: a child grant's `granted_scope` MUST be a subset
 *      of its parent's; `expires_at` MUST NOT exceed the parent's; the
 *      `revocable` flag MUST NOT be flipped from `true` (1) to `false`
 *      (0). Client-side narrowing (RC client §7.2) is defense-in-depth
 *      only — enforcement lives here.
 *   2. Revocation cascade: revoking a grant marks all transitive
 *      descendants (via `parent_delegation_id`) as revoked in the same
 *      transaction/audit event.
 *
 * Audit trail: every grant/revoke/check emits an `admin_audit_log` row
 * carrying an Ed25519 signature over the canonical event payload, so
 * downstream verifiers can attest to the exact server-side decision
 * without trusting the DB row alone.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import { delegationTasks, type DelegationTaskRecord } from '$lib/db/schema';
import { appendAudit } from '$lib/db/repositories/admin-audit-log';
import { importSigningKey, derivePublicKeyHex } from '$lib/crypto/sign-agent';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'delegation-grants');

// ─── Types ────────────────────────────────────────────────────────────

export interface GrantEnvironment {
	KYM_NANDA_ED25519_PRIVATE_KEY_v1?: unknown;
	NANDA_NODE_CACHE?: KVNamespace;
}

/**
 * PUH proof envelope carried on every `delegation.grant`. Mirrors the
 * `proof` field the RC-client mobile UI builds in
 * `nexartis-remote-control/src/lib/cubes/remote-control/delegation-grant.ts`
 * (PUH-4). `issuedAt` is the client's grant issuance timestamp in unix
 * milliseconds and is required so the server can re-derive
 * `grantedByProofHash` deterministically.
 */
export interface PuhProof {
	principalPk: string; // Yanez biometric principal (Ed25519 SPKI, base64 or hex)
	deviceDid: string; // signed-by device Ed25519 DID
	requestId: string; // Yanez preapproval request id
	boundAt: number; // ms since epoch — when the PUH binding was minted
	issuedAt: number; // ms since epoch — when the grant was constructed on-device
	/**
	 * Ed25519 signature (base64, url-safe base64, or hex) over the canonical
	 * envelope returned by `canonicalProofEnvelope`, verified against
	 * `principalPk`. Required. Missing, empty, malformed, wrong-key, and
	 * wrong-subject signatures fail closed before any grant write.
	 */
	signature: string;
}

export interface GrantInput {
	delegatorId: string; // grantedByDid (agent making the grant)
	delegateId: string; // grantedToDid (agent receiving the grant)
	action: string;
	grantedScope: string[]; // capability classes / tool ids
	expiresAt: number; // unix seconds
	grantedByProofHash: string; // SHA-256 hex of WebAuthn authenticatorData||clientDataJSON
	proof: PuhProof; // NND-D3: required PUH envelope; re-derives the hash server-side
	parentDelegationId?: string | null;
	revocable?: boolean; // defaults to true
	parentWorkflowId?: string | null;
	parentStepId?: string | null;
	inputJson?: Record<string, unknown>;
	timeoutMs?: number;
	maxRetries?: number;
	freshnessMs?: number; // override PUH freshness window (defaults to 5 min)
	actor?: {
		userId?: string | null;
		email?: string | null;
		ip?: string | null;
		userAgent?: string | null;
	};
}

/**
 * NND-D3 — PUH proof freshness window. Matches the RC-client mobile UI
 * (`DEFAULT_PUH_FRESHNESS_MS` in `remote-control/delegation-grant.ts`) and
 * the ADR Layer-4 VC TTL. Grants presenting a proof older than this are
 * rejected with `puh-proof-stale`.
 */
export const PUH_FRESHNESS_MS = 5 * 60 * 1000;

/**
 * Small allowance for client/server clock skew when checking
 * `proof.boundAt` / `proof.issuedAt` against server time. 30 s is enough
 * for typical NTP drift + network hop without meaningfully widening the
 * PUH freshness window.
 */
const PUH_SKEW_MS = 30_000;

export interface GrantResult {
	delegationId: string;
	kymVcId: string | null;
	expiresAt: number;
}

export interface RevokeInput {
	delegationId: string;
	reason?: string;
	actor?: GrantInput['actor'];
}

export interface RevokeResult {
	revoked: true;
	revokedAt: number;
	cascadedIds: string[];
}

export interface CheckResult {
	valid: boolean;
	revoked: boolean;
	revokedAt?: number;
	expired: boolean;
	expiresAt?: number;
	credentialSubject: {
		grantedToDid: string;
		grantedByDid: string;
		scope: string[];
	};
}

export class DelegationGrantError extends Error {
	code: string;
	statusHint: number;
	constructor(code: string, message: string, statusHint = -32602) {
		super(message);
		this.code = code;
		this.statusHint = statusHint;
	}
}

// ─── Chain-narrowing invariants ───────────────────────────────────────

/**
 * Assert child grant narrows (or equals) the parent per ARCH-2 M2.
 * Throws DelegationGrantError on violation; caller maps to JSON-RPC error.
 */
export function assertChainNarrowing(
	parent: Pick<DelegationTaskRecord, 'grantedScope' | 'expiresAt' | 'revocable' | 'status'>,
	child: { grantedScope: string[]; expiresAt: number; revocable: boolean }
): void {
	if (parent.status === 'revoked') {
		throw new DelegationGrantError('parent-revoked', 'Parent delegation is revoked');
	}
	const parentScope = parseScope(parent.grantedScope);
	if (!parentScope) {
		throw new DelegationGrantError('parent-scope-missing', 'Parent delegation has no grantedScope');
	}
	const parentSet = new Set(parentScope);
	for (const s of child.grantedScope) {
		if (!parentSet.has(s)) {
			throw new DelegationGrantError(
				'scope-widens-parent',
				`Child scope "${s}" is not present in parent grantedScope`
			);
		}
	}
	if (parent.expiresAt == null) {
		throw new DelegationGrantError('parent-ttl-missing', 'Parent delegation has no expiresAt');
	}
	if (child.expiresAt > parent.expiresAt) {
		throw new DelegationGrantError(
			'ttl-widens-parent',
			`Child expiresAt ${child.expiresAt} exceeds parent expiresAt ${parent.expiresAt}`
		);
	}
	const parentRevocable = parent.revocable !== 0;
	if (parentRevocable && !child.revocable) {
		throw new DelegationGrantError(
			'revocable-flip-forbidden',
			'Child cannot flip revocable=false when parent is revocable=true'
		);
	}
}

// ─── PUH proof verification (NND-D3) ─────────────────────────────────

interface PuhProofSubject {
	delegateId: string;
	grantedScope: string[];
	expiresAt: number;
	parentDelegationId: string | null;
	revocable: boolean;
}

/**
 * Deterministic canonical envelope for `grantedByProofHash`. Field
 * ordering, key names, and normalisation MUST match the RC-client mobile
 * UI (`computeGrantedByProofHash` in
 * `nexartis-remote-control/src/lib/cubes/remote-control/delegation-grant.ts`).
 * Any drift here is a silent authentication bypass, so keep them in sync.
 */
function canonicalProofEnvelope(proof: PuhProof, subject: PuhProofSubject): string {
	// `scope` mirrors the mobile UI's `normalizeScope` output shape
	// (`{ toolNames: string[] }`, sorted, trimmed, non-empty). The A2A
	// wire flattens scope to `string[]`; we rebuild the object here so
	// the server envelope byte-for-byte matches the client hash input.
	const toolNames = subject.grantedScope
		.map((s) => (typeof s === 'string' ? s.trim() : ''))
		.filter((s) => s.length > 0)
		.sort();
	return JSON.stringify({
		principalPk: proof.principalPk,
		deviceDid: proof.deviceDid,
		requestId: proof.requestId,
		grantee: subject.delegateId,
		scope: { toolNames },
		expiresAt: subject.expiresAt,
		parentDelegationId: subject.parentDelegationId,
		revocable: subject.revocable,
		issuedAt: proof.issuedAt
	});
}

/**
 * Reconstruct the PUH envelope from an A2A `proof` object. Preserves
 * `signature` when the caller sent it; never invents one. Shared by the
 * `/a2a` route so a stripped field cannot be dropped only on the wire path.
 */
export function reconstructPuhProof(proofPayload: unknown): PuhProof | null {
	if (!proofPayload || typeof proofPayload !== 'object') return null;
	const p = proofPayload as Record<string, unknown>;
	const signatureRaw = p.signature ?? p.proof_signature;
	return {
		principalPk: String(p.principalPk ?? p.principal_pk ?? ''),
		deviceDid: String(p.deviceDid ?? p.device_did ?? ''),
		requestId: String(p.requestId ?? p.request_id ?? ''),
		boundAt: Number(p.boundAt ?? p.bound_at ?? NaN),
		issuedAt: Number(p.issuedAt ?? p.issued_at ?? NaN),
		signature: typeof signatureRaw === 'string' ? signatureRaw : ''
	};
}

/**
 * Verify a PUH proof is present, fresh, and binds cryptographically to
 * this exact grant. Throws `DelegationGrantError` on any failure; caller
 * maps the code to a JSON-RPC error.
 *
 * NND-D3 acceptance: `delegation.grant` must reject grants that lack a
 * proof, whose proof is older than `PUH_FRESHNESS_MS`, or whose recorded
 * `grantedByProofHash` does not match the SHA-256 of the canonical
 * envelope over `(proof, subject)`. This closes the H4 approval-with-grant
 * loop: the same WebAuthn/Yanez ceremony that gated command execution
 * gates the grant that would otherwise let the delegate skip it.
 */
export async function verifyPuhProof(
	input: {
		proof: PuhProof | undefined | null;
		grantedByProofHash: string;
		subject: PuhProofSubject;
	},
	opts: { nowMs: number; freshnessMs?: number } = { nowMs: Date.now() }
): Promise<void> {
	const proof = input.proof;
	if (!proof || typeof proof !== 'object') {
		throw new DelegationGrantError('missing-proof', 'PUH proof envelope required');
	}
	for (const field of ['principalPk', 'deviceDid', 'requestId'] as const) {
		if (typeof proof[field] !== 'string' || !proof[field]) {
			throw new DelegationGrantError(
				'invalid-proof',
				`PUH proof.${field} must be a non-empty string`
			);
		}
	}
	if (typeof proof.boundAt !== 'number' || !Number.isFinite(proof.boundAt)) {
		throw new DelegationGrantError('invalid-proof', 'PUH proof.boundAt must be a number (ms)');
	}
	if (typeof proof.issuedAt !== 'number' || !Number.isFinite(proof.issuedAt)) {
		throw new DelegationGrantError('invalid-proof', 'PUH proof.issuedAt must be a number (ms)');
	}

	const freshnessMs = opts.freshnessMs ?? PUH_FRESHNESS_MS;
	const nowMs = opts.nowMs;
	const boundAge = nowMs - proof.boundAt;
	if (boundAge < -PUH_SKEW_MS || boundAge > freshnessMs) {
		throw new DelegationGrantError(
			'puh-proof-stale',
			`PUH binding age ${boundAge}ms is outside freshness window ${freshnessMs}ms`
		);
	}
	const issuedAge = nowMs - proof.issuedAt;
	if (issuedAge < -PUH_SKEW_MS || issuedAge > freshnessMs) {
		throw new DelegationGrantError(
			'puh-proof-stale',
			`PUH issuance age ${issuedAge}ms is outside freshness window ${freshnessMs}ms`
		);
	}
	if (proof.issuedAt < proof.boundAt - PUH_SKEW_MS) {
		throw new DelegationGrantError('invalid-proof', 'PUH proof.issuedAt precedes proof.boundAt');
	}

	if (typeof input.grantedByProofHash !== 'string' || !input.grantedByProofHash) {
		throw new DelegationGrantError(
			'missing-proof-hash',
			'grantedByProofHash required alongside proof envelope'
		);
	}
	const canonical = canonicalProofEnvelope(proof, input.subject);
	const derived = await sha256Hex(canonical);
	if (derived !== input.grantedByProofHash) {
		throw new DelegationGrantError(
			'proof-hash-mismatch',
			'grantedByProofHash does not match canonical PUH envelope'
		);
	}

	if (typeof proof.signature !== 'string' || !proof.signature) {
		throw new DelegationGrantError('invalid-proof', 'PUH proof.signature is required');
	}
	const signatureOk = await verifyEd25519OverCanonical(
		proof.principalPk,
		canonical,
		proof.signature
	);
	if (!signatureOk) {
		throw new DelegationGrantError(
			'invalid-proof',
			'PUH proof.signature does not verify against principalPk'
		);
	}
}

/**
 * Decode a byte string that may be hex or base64 (standard or url-safe).
 * Yanez principals and signatures land in whichever encoding the calling
 * SDK chose, so the server accepts both rather than forcing a rebuild.
 */
function decodeBytes(input: string): Uint8Array | null {
	if (typeof input !== 'string' || input.length === 0) return null;
	// Hex?
	if (/^[0-9a-fA-F]+$/.test(input) && input.length % 2 === 0) {
		const bytes = new Uint8Array(input.length / 2);
		for (let i = 0; i < input.length; i += 2) {
			bytes[i / 2] = parseInt(input.slice(i, i + 2), 16);
		}
		return bytes;
	}
	// Base64 (accept url-safe variants).
	try {
		const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}

async function verifyEd25519OverCanonical(
	principalPk: string,
	canonical: string,
	signature: string
): Promise<boolean> {
	const pkBytes = decodeBytes(principalPk);
	const sigBytes = decodeBytes(signature);
	if (!pkBytes || !sigBytes) return false;
	try {
		// Yanez principals are raw 32-byte Ed25519 public keys; import as raw.
		const key = await crypto.subtle.importKey(
			pkBytes.length === 32 ? 'raw' : 'spki',
			pkBytes as BufferSource,
			{ name: 'Ed25519' },
			false,
			['verify']
		);
		const data = new TextEncoder().encode(canonical);
		return await crypto.subtle.verify(
			'Ed25519',
			key,
			sigBytes as BufferSource,
			data as BufferSource
		);
	} catch {
		return false;
	}
}

function parseScope(json: string | null | undefined): string[] | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : null;
	} catch {
		return null;
	}
}

// ─── Signed audit records ─────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

async function signAuditPayload(
	env: GrantEnvironment,
	payload: Record<string, unknown>
): Promise<{ payloadHash: string; signatureHex: string; publicKeyHex: string } | null> {
	try {
		const key = await importSigningKey({
			KYM_NANDA_ED25519_PRIVATE_KEY_v1: env.KYM_NANDA_ED25519_PRIVATE_KEY_v1,
			NANDA_NODE_CACHE: env.NANDA_NODE_CACHE
		});
		const canonical = JSON.stringify(payload, Object.keys(payload).sort());
		const payloadHash = await sha256Hex(canonical);
		const sig = await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(canonical));
		const signatureHex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		const publicKeyHex = await derivePublicKeyHex(key);
		return { payloadHash, signatureHex, publicKeyHex };
	} catch (err) {
		// Signing key missing/unavailable → still write the audit row (unsigned),
		// but surface a warning. Fail-open here would defeat the audit trail.
		log.warn('signAuditPayload', 'signing unavailable', {
			err: err instanceof Error ? err.message : String(err)
		});
		return null;
	}
}

async function writeSignedAudit(
	db: DbClient,
	env: GrantEnvironment,
	eventType: string,
	delegationId: string,
	payload: Record<string, unknown>,
	actor?: GrantInput['actor']
): Promise<void> {
	const signature = await signAuditPayload(env, payload);
	await appendAudit(db, {
		eventType,
		actorUserId: actor?.userId ?? null,
		actorEmail: actor?.email ?? null,
		targetType: 'delegation',
		targetId: delegationId,
		ip: actor?.ip ?? null,
		userAgent: actor?.userAgent ?? null,
		metadata: {
			payload,
			signature
		}
	});
}

// ─── Grant ────────────────────────────────────────────────────────────

/**
 * Create a scoped delegation grant. Enforces the chain-narrowing invariant
 * when `parentDelegationId` is present.
 *
 * The `kymVcId` field of the return value is null in this NANDA-side
 * implementation — the KYM VC is issued by the KYM node (Wave 2 KYM-D1) via
 * a separate path; consumers that need the VC id will resolve it out-of-band.
 * Returning null keeps the JSON-RPC shape defined by the ADR without
 * pretending we minted a credential we did not.
 */
export async function grantDelegation(
	db: DbClient,
	env: GrantEnvironment,
	input: GrantInput
): Promise<GrantResult> {
	if (!input.delegatorId)
		throw new DelegationGrantError('missing-delegator', 'delegatorId required');
	if (!input.delegateId) throw new DelegationGrantError('missing-delegate', 'delegateId required');
	if (!input.action) throw new DelegationGrantError('missing-action', 'action required');
	if (!Array.isArray(input.grantedScope) || input.grantedScope.length === 0) {
		throw new DelegationGrantError(
			'missing-scope',
			'grantedScope must be a non-empty string array'
		);
	}
	if (!input.grantedScope.every((s) => typeof s === 'string' && s.length > 0)) {
		throw new DelegationGrantError(
			'invalid-scope',
			'grantedScope entries must be non-empty strings'
		);
	}
	if (typeof input.expiresAt !== 'number' || !Number.isFinite(input.expiresAt)) {
		throw new DelegationGrantError('missing-expires', 'expiresAt (unix seconds) required');
	}
	const now = Math.floor(Date.now() / 1000);
	if (input.expiresAt <= now) {
		throw new DelegationGrantError('already-expired', 'expiresAt must be in the future');
	}
	if (!input.grantedByProofHash || typeof input.grantedByProofHash !== 'string') {
		throw new DelegationGrantError('missing-proof-hash', 'grantedByProofHash required');
	}
	const revocable = input.revocable !== false; // default true

	// NND-D3: verify the PUH proof envelope binds to this exact grant.
	// Runs BEFORE any DB write so a bad proof cannot leak partial state.
	await verifyPuhProof(
		{
			proof: input.proof,
			grantedByProofHash: input.grantedByProofHash,
			subject: {
				delegateId: input.delegateId,
				grantedScope: input.grantedScope,
				expiresAt: input.expiresAt,
				parentDelegationId: input.parentDelegationId ?? null,
				revocable
			}
		},
		{ nowMs: Date.now(), freshnessMs: input.freshnessMs }
	);

	if (input.parentDelegationId) {
		const parent = await db.query.delegationTasks.findFirst({
			where: eq(delegationTasks.id, input.parentDelegationId)
		});
		if (!parent) {
			throw new DelegationGrantError('parent-not-found', 'parentDelegationId does not exist');
		}
		assertChainNarrowing(parent, {
			grantedScope: input.grantedScope,
			expiresAt: input.expiresAt,
			revocable
		});
	}

	const id = `del-${nanoid()}`;
	await db.insert(delegationTasks).values({
		id,
		parentWorkflowId: input.parentWorkflowId ?? null,
		parentStepId: input.parentStepId ?? null,
		delegatorId: input.delegatorId,
		delegateId: input.delegateId,
		taskType: 'a2a_grant',
		action: input.action,
		inputJson: JSON.stringify(input.inputJson ?? {}),
		status: 'granted',
		delegationToken: nanoid(),
		timeoutMs: input.timeoutMs ?? 30000,
		maxRetries: input.maxRetries ?? 3,
		grantedScope: JSON.stringify(input.grantedScope),
		expiresAt: input.expiresAt,
		grantedByProofHash: input.grantedByProofHash,
		parentDelegationId: input.parentDelegationId ?? null,
		revocable: revocable ? 1 : 0,
		startedAt: now
	});

	await writeSignedAudit(
		db,
		env,
		'delegation.grant',
		id,
		{
			delegationId: id,
			delegatorId: input.delegatorId,
			delegateId: input.delegateId,
			action: input.action,
			grantedScope: input.grantedScope,
			expiresAt: input.expiresAt,
			parentDelegationId: input.parentDelegationId ?? null,
			revocable,
			grantedByProofHash: input.grantedByProofHash,
			grantedAt: now
		},
		input.actor
	);

	return { delegationId: id, kymVcId: null, expiresAt: input.expiresAt };
}

// ─── Revoke ──────────────────────────────────────────────────────────

/**
 * Revoke a grant and cascade to all transitive descendants. Idempotent —
 * calling `revoke` on an already-revoked grant returns the existing
 * revocation timestamp without rewriting rows.
 */
export async function revokeDelegation(
	db: DbClient,
	env: GrantEnvironment,
	input: RevokeInput
): Promise<RevokeResult> {
	const row = await db.query.delegationTasks.findFirst({
		where: eq(delegationTasks.id, input.delegationId)
	});
	if (!row) {
		throw new DelegationGrantError(
			'not-found',
			`Delegation ${input.delegationId} not found`,
			-32001
		);
	}
	if (row.revocable === 0) {
		throw new DelegationGrantError('not-revocable', 'Delegation is marked non-revocable', -32001);
	}
	if (row.status === 'revoked') {
		return { revoked: true, revokedAt: row.completedAt ?? row.updatedAt, cascadedIds: [] };
	}

	const now = Math.floor(Date.now() / 1000);
	const cascadeIds = await collectDescendants(db, input.delegationId);
	const allIds = [input.delegationId, ...cascadeIds];

	await db
		.update(delegationTasks)
		.set({
			status: 'revoked',
			errorMessage: input.reason ?? 'Revoked',
			completedAt: now,
			updatedAt: sql`(unixepoch())`
		})
		.where(inArray(delegationTasks.id, allIds));

	await writeSignedAudit(
		db,
		env,
		'delegation.revoke',
		input.delegationId,
		{
			delegationId: input.delegationId,
			reason: input.reason ?? 'Revoked',
			cascadedIds: cascadeIds,
			revokedAt: now
		},
		input.actor
	);

	return { revoked: true, revokedAt: now, cascadedIds: cascadeIds };
}

/**
 * BFS through parent_delegation_id → child rows. Bounded to 32 hops to
 * cheaply defuse pathological chains; real chains are 2-3 deep.
 */
async function collectDescendants(db: DbClient, rootId: string): Promise<string[]> {
	const out: string[] = [];
	let frontier: string[] = [rootId];
	const MAX_HOPS = 32;
	for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop++) {
		const kids = await db.query.delegationTasks.findMany({
			where: inArray(delegationTasks.parentDelegationId, frontier)
		});
		if (kids.length === 0) break;
		const kidIds = kids.map((k) => k.id).filter((id) => !out.includes(id) && id !== rootId);
		out.push(...kidIds);
		frontier = kidIds;
	}
	return out;
}

// ─── Check ───────────────────────────────────────────────────────────

/**
 * Server-side grant gate. Returns the shape from ADR §Layer 3 —
 * field names align with KYM `POST /api/vc/verify` so client-side
 * consumers can reuse the same result type.
 *
 * Note: performs the revocation-cascade check inline (walks up the
 * parent chain) so a parent revoked after a child was granted still
 * invalidates the child even if the write-time cascade missed it.
 */
export async function checkDelegation(db: DbClient, delegationId: string): Promise<CheckResult> {
	const row = await db.query.delegationTasks.findFirst({
		where: eq(delegationTasks.id, delegationId)
	});
	if (!row) {
		throw new DelegationGrantError('not-found', `Delegation ${delegationId} not found`, -32001);
	}

	const now = Math.floor(Date.now() / 1000);
	let expiresAt: number | undefined = row.expiresAt ?? undefined;
	let expired = expiresAt != null && now >= expiresAt;

	let revoked = row.status === 'revoked';
	let revokedAt: number | undefined = revoked ? (row.completedAt ?? row.updatedAt) : undefined;

	// Walk up the chain — if any ancestor is revoked or expired, this grant is invalid.
	if (!revoked) {
		let cursor = row.parentDelegationId;
		const seen = new Set<string>();
		let hops = 0;
		while (cursor && hops < 32 && !seen.has(cursor)) {
			seen.add(cursor);
			hops++;
			const parent = await db.query.delegationTasks.findFirst({
				where: eq(delegationTasks.id, cursor)
			});
			if (!parent) break;
			if (parent.status === 'revoked') {
				revoked = true;
				revokedAt = parent.completedAt ?? parent.updatedAt;
				break;
			}
			if (parent.expiresAt != null && now >= parent.expiresAt) {
				// Ancestor expiry bounds this grant; surface as `expired` per the
				// ARCH-2 M2 revocation-cascade / narrowing invariant. Previously
				// the code set `cursor = null; break;` but never assigned
				// `expired = true`, so consumers of `delegation.check` saw
				// `valid: true` for a child whose parent had already lapsed
				// (review CRITICAL-3).
				expired = true;
				if (expiresAt == null || parent.expiresAt < expiresAt) {
					expiresAt = parent.expiresAt;
				}
				cursor = null;
				break;
			}
			cursor = parent.parentDelegationId;
		}
	}

	const scope = parseScope(row.grantedScope) ?? [];
	const valid = !revoked && !expired && row.status !== 'failed';

	return {
		valid,
		revoked,
		revokedAt,
		expired,
		expiresAt,
		credentialSubject: {
			grantedToDid: row.delegateId,
			grantedByDid: row.delegatorId,
			scope
		}
	};
}
