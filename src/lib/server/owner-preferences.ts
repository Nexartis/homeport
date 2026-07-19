/**
 * Owner-preferences approval policy — signed envelope builder (NND-D2).
 *
 * Publishes the canonical operator approval-policy shape defined by
 * `@nexartis/owner-preferences` (workspace-linked from
 * `../nexartis-remote-control-client/packages/owner-preferences`). The
 * package is the single source of truth for BOTH sides of the wire — nnd
 * publisher and rc-client verifier — so the previous silent-drift between
 * the two shapes cannot recur.
 *
 * Signature contract lives in the shared package (SIGNED_FIELDS,
 * buildOwnerPreferencesPayload, canonicalizeOwnerPreferencesPayload).
 * This file only wires the payload builder to the nnd key-rotation signer.
 */
import type { Env } from '$lib/types';
import { signWithLatestKey } from '$lib/services/certifier/key-rotation';
import {
	DEFAULT_APPROVAL_POLICY,
	OWNER_PREFERENCES_TTL_SECONDS,
	SIGNED_FIELDS,
	buildOwnerPreferencesPayload,
	canonicalizeOwnerPreferencesPayload
} from '@nexartis/owner-preferences';

export { OWNER_PREFERENCES_TTL_SECONDS, SIGNED_FIELDS, DEFAULT_APPROVAL_POLICY };
export {
	buildOwnerPreferencesPayload,
	canonicalizeOwnerPreferencesPayload
} from '@nexartis/owner-preferences';

/**
 * Types re-exported so existing callers in this repo keep compiling. New
 * code should import them directly from `@nexartis/owner-preferences`.
 *
 * The concrete shape is authoritatively defined by the zod schema in the
 * shared package; these local aliases exist only for backward compatibility
 * with existing imports across the nnd codebase.
 */
export type ApprovalMode = 'allow' | 'require-approval' | 'approval-with-grant' | 'deny';
export type ApprovalClass = 'read' | 'mutate' | 'device' | 'code-exec' | 'network' | 'destructive';
export type ApprovalProfile = Record<ApprovalClass, ApprovalMode>;
export interface ApprovalGrant {
	ttlMs: number;
	since: number;
}
export interface ApprovalPolicy {
	profiles: Record<string, ApprovalProfile>;
	default: string;
	grants: Record<string, ApprovalGrant>;
	biometric: { requireForClasses: ApprovalClass[] };
}
export interface SignedOwnerPreferencesPayload {
	kind: 'nexartis.owner-preferences.v1';
	issuer: string;
	issuedAt: string;
	expiresAt: string;
	ttlSeconds: number;
	policy: ApprovalPolicy;
}
export interface SignedOwnerPreferencesResponse extends SignedOwnerPreferencesPayload {
	signature: {
		alg: 'Ed25519';
		keyVersion: number;
		verificationMethod: string;
		value: string;
		signedFields: readonly (keyof SignedOwnerPreferencesPayload)[];
	};
}

/**
 * Build and sign an owner-preferences response.
 *
 * @throws Error if no Ed25519 private key is configured for this node.
 */
export async function signOwnerPreferences(
	env: Env,
	policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY as ApprovalPolicy,
	now: Date = new Date()
): Promise<SignedOwnerPreferencesResponse> {
	const payload = buildOwnerPreferencesPayload({
		issuer: env.NANDA_REGISTRY_URL,
		issuedAt: now,
		policy
	}) as SignedOwnerPreferencesPayload;
	const canonical = canonicalizeOwnerPreferencesPayload(payload);
	const signed = await signWithLatestKey(env, canonical);
	return {
		...payload,
		signature: {
			alg: 'Ed25519',
			keyVersion: signed.keyVersion,
			verificationMethod: `${env.NANDA_REGISTRY_URL}/.well-known/keys/ed25519-v${signed.keyVersion}`,
			value: signed.signature,
			signedFields: SIGNED_FIELDS as readonly (keyof SignedOwnerPreferencesPayload)[]
		}
	};
}
