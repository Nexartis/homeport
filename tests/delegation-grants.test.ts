/**
 * NND-D3 — delegation.grant PUH proof enforcement.
 *
 * Verifies that `grantDelegation` rejects grants without a fresh, well-formed
 * PUH proof envelope and that the server-side canonical hash matches the
 * RC-client mobile UI (PUH-4). Uses the local D1 binding from
 * `@cloudflare/vitest-pool-workers` so the audit-log write path runs end
 * to end.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import {
	grantDelegation,
	verifyPuhProof,
	reconstructPuhProof,
	DelegationGrantError,
	PUH_FRESHNESS_MS,
	type PuhProof
} from '../src/lib/server/delegation-grants';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const DDL = [
	`CREATE TABLE IF NOT EXISTS delegation_tasks (
		id TEXT PRIMARY KEY, parent_workflow_id TEXT, parent_step_id TEXT,
		delegator_id TEXT NOT NULL, delegate_id TEXT NOT NULL,
		task_type TEXT NOT NULL DEFAULT 'a2a_call', action TEXT NOT NULL,
		input_json TEXT NOT NULL DEFAULT '{}', output_json TEXT,
		status TEXT NOT NULL DEFAULT 'pending', error_message TEXT,
		delegation_token TEXT, timeout_ms INTEGER NOT NULL DEFAULT 30000,
		retry_count INTEGER NOT NULL DEFAULT 0, max_retries INTEGER NOT NULL DEFAULT 3,
		granted_scope TEXT, expires_at INTEGER, granted_by_proof_hash TEXT,
		parent_delegation_id TEXT, revocable INTEGER NOT NULL DEFAULT 1,
		started_at INTEGER, completed_at INTEGER,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS admin_audit_log (
		id TEXT PRIMARY KEY NOT NULL,
		event_type TEXT NOT NULL,
		actor_user_id TEXT, actor_email TEXT,
		target_type TEXT, target_id TEXT,
		metadata TEXT, ip TEXT, user_agent TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()))`
];

const db = createDbClient(env.DB);

let auditSigningKeyB64 = '';

beforeAll(async () => {
	await env.DB.batch(DDL.map((sql) => env.DB.prepare(sql)));
	const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
		'sign',
		'verify'
	])) as CryptoKeyPair;
	const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
	auditSigningKeyB64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
});

function auditEnv(): { KYM_NANDA_ED25519_PRIVATE_KEY_v1: string } {
	return { KYM_NANDA_ED25519_PRIVATE_KEY_v1: auditSigningKeyB64 };
}

async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// Mirror `canonicalProofEnvelope` from delegation-grants.ts. Duplicated
// intentionally so a silent drift there breaks these tests loudly.
async function computeHash(
	proof: PuhProof,
	subject: {
		delegateId: string;
		grantedScope: string[];
		expiresAt: number;
		parentDelegationId: string | null;
		revocable: boolean;
	}
): Promise<string> {
	const toolNames = subject.grantedScope
		.map((s) => s.trim())
		.filter(Boolean)
		.sort();
	const canonical = JSON.stringify({
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
	return sha256Hex(canonical);
}

function hexOf(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function canonicalString(
	proof: PuhProof,
	subject: {
		delegateId: string;
		grantedScope: string[];
		expiresAt: number;
		parentDelegationId: string | null;
		revocable: boolean;
	}
): string {
	const toolNames = subject.grantedScope
		.map((s) => s.trim())
		.filter(Boolean)
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

async function generatePrincipal(): Promise<{ pkHex: string; privateKey: CryptoKey }> {
	const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
		'sign',
		'verify'
	])) as CryptoKeyPair;
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	return { pkHex: hexOf(raw), privateKey: pair.privateKey };
}

async function signCanonical(privateKey: CryptoKey, canonical: string): Promise<string> {
	const sig = new Uint8Array(
		await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(canonical))
	);
	return hexOf(sig);
}

async function signedProof(
	subject: {
		delegateId: string;
		grantedScope: string[];
		expiresAt: number;
		parentDelegationId: string | null;
		revocable: boolean;
	},
	overrides: Partial<PuhProof> = {}
): Promise<PuhProof> {
	const { pkHex, privateKey } = await generatePrincipal();
	const now = Date.now();
	const proof: PuhProof = {
		principalPk: pkHex,
		deviceDid: 'did:key:z6Mkdevice',
		requestId: 'yz-req-01',
		boundAt: now - 1_000,
		issuedAt: now - 500,
		signature: '',
		...overrides
	};
	if (!('signature' in overrides)) {
		proof.signature = await signCanonical(privateKey, canonicalString(proof, subject));
	}
	return proof;
}

function freshProof(overrides: Partial<PuhProof> = {}): PuhProof {
	const now = Date.now();
	return {
		principalPk: 'yz-principal-01',
		deviceDid: 'did:key:z6Mkdevice',
		requestId: 'yz-req-01',
		boundAt: now - 1_000,
		issuedAt: now - 500,
		signature: '',
		...overrides
	};
}

describe('verifyPuhProof — NND-D3', () => {
	const subject = {
		delegateId: 'agent-delegate-1',
		grantedScope: ['tool.echo', 'tool.summarize'],
		expiresAt: Math.floor(Date.now() / 1000) + 3600,
		parentDelegationId: null,
		revocable: true
	};

	it('rejects when proof is missing', async () => {
		await expect(
			verifyPuhProof({ proof: null, grantedByProofHash: 'x', subject })
		).rejects.toMatchObject({ code: 'missing-proof' });
	});

	it('rejects when proof.principalPk is empty', async () => {
		await expect(
			verifyPuhProof({
				proof: freshProof({ principalPk: '' }),
				grantedByProofHash: 'x',
				subject
			})
		).rejects.toMatchObject({ code: 'invalid-proof' });
	});

	it('rejects when the PUH binding is older than the freshness window', async () => {
		const stale = freshProof({ boundAt: Date.now() - PUH_FRESHNESS_MS - 60_000 });
		const hash = await computeHash(stale, subject);
		await expect(
			verifyPuhProof({ proof: stale, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'puh-proof-stale' });
	});

	it('rejects when the grant issuance is older than the freshness window', async () => {
		const stale = freshProof({ issuedAt: Date.now() - PUH_FRESHNESS_MS - 60_000 });
		const hash = await computeHash(stale, subject);
		await expect(
			verifyPuhProof({ proof: stale, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'puh-proof-stale' });
	});

	it('rejects when the hash does not bind to this subject', async () => {
		const proof = freshProof();
		const otherSubject = { ...subject, delegateId: 'agent-attacker' };
		const wrongHash = await computeHash(proof, otherSubject);
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: wrongHash, subject })
		).rejects.toMatchObject({ code: 'proof-hash-mismatch' });
	});

	it('rejects when the hash does not bind to the scope', async () => {
		const proof = freshProof();
		const widened = { ...subject, grantedScope: [...subject.grantedScope, 'tool.destroy'] };
		const wrongHash = await computeHash(proof, widened);
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: wrongHash, subject })
		).rejects.toMatchObject({ code: 'proof-hash-mismatch' });
	});

	it('rejects a missing signature before any grant write', async () => {
		const proof = await signedProof(subject, { signature: '' });
		const hash = await computeHash(proof, subject);
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'invalid-proof' });
	});

	it('rejects an A2A-stripped signature (reconstruct drops unsigned field)', async () => {
		const signed = await signedProof(subject);
		const { signature: _dropped, ...wire } = signed;
		const reconstructed = reconstructPuhProof(wire);
		expect(reconstructed?.signature).toBe('');
		const hash = await computeHash(reconstructed!, subject);
		await expect(
			verifyPuhProof({ proof: reconstructed, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'invalid-proof' });
	});

	it('preserves signature through A2A reconstruction', async () => {
		const signed = await signedProof(subject);
		const reconstructed = reconstructPuhProof({
			principal_pk: signed.principalPk,
			device_did: signed.deviceDid,
			request_id: signed.requestId,
			bound_at: signed.boundAt,
			issued_at: signed.issuedAt,
			signature: signed.signature
		});
		expect(reconstructed?.signature).toBe(signed.signature);
		const hash = await computeHash(reconstructed!, subject);
		await expect(
			verifyPuhProof({ proof: reconstructed, grantedByProofHash: hash, subject })
		).resolves.toBeUndefined();
	});

	it('rejects a malformed signature', async () => {
		const proof = await signedProof(subject, { signature: 'not-a-signature!!!' });
		const hash = await computeHash(proof, subject);
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'invalid-proof' });
	});

	it('rejects a signature from the wrong key', async () => {
		const other = await generatePrincipal();
		const proof = await signedProof(subject);
		const canonical = canonicalString(proof, subject);
		proof.signature = await signCanonical(other.privateKey, canonical);
		const hash = await computeHash(proof, subject);
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'invalid-proof' });
	});

	it('rejects a signature bound to a different subject', async () => {
		const otherSubject = { ...subject, delegateId: 'agent-attacker' };
		const signedForOther = await signedProof(otherSubject);
		const hash = await computeHash(signedForOther, subject);
		await expect(
			verifyPuhProof({ proof: signedForOther, grantedByProofHash: hash, subject })
		).rejects.toMatchObject({ code: 'invalid-proof' });
	});

	it('accepts a fresh, correctly bound signed proof', async () => {
		const proof = await signedProof(subject);
		const hash = await computeHash(proof, subject);
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: hash, subject })
		).resolves.toBeUndefined();
	});

	it('is scope-order-insensitive (envelope sorts toolNames)', async () => {
		const proof = await signedProof(subject);
		const hashSorted = await computeHash(proof, subject);
		const shuffled = { ...subject, grantedScope: [...subject.grantedScope].reverse() };
		await expect(
			verifyPuhProof({ proof, grantedByProofHash: hashSorted, subject: shuffled })
		).resolves.toBeUndefined();
	});
});

describe('grantDelegation — NND-D3 integration', () => {
	const baseInput = () => {
		const expiresAt = Math.floor(Date.now() / 1000) + 3600;
		return {
			delegatorId: 'agent-owner-1',
			delegateId: 'agent-delegate-2',
			action: 'delegated',
			grantedScope: ['tool.echo'],
			expiresAt,
			revocable: true
		};
	};

	it('rejects when no proof envelope is supplied', async () => {
		const base = baseInput();
		const proof = freshProof();
		const hash = await computeHash(proof, {
			delegateId: base.delegateId,
			grantedScope: base.grantedScope,
			expiresAt: base.expiresAt,
			parentDelegationId: null,
			revocable: true
		});
		await expect(
			grantDelegation(
				db,
				auditEnv(),
				{
					...base,
					grantedByProofHash: hash,
					proof: undefined as unknown as PuhProof
				}
			)
		).rejects.toBeInstanceOf(DelegationGrantError);
	});

	it('rejects when the hash does not match the proof envelope', async () => {
		const base = baseInput();
		const proof = freshProof();
		await expect(
			grantDelegation(
				db,
				auditEnv(),
				{
					...base,
					grantedByProofHash: 'deadbeef',
					proof
				}
			)
		).rejects.toMatchObject({ code: 'proof-hash-mismatch' });
	});

	it('does not persist a grant when the signature is missing', async () => {
		const base = baseInput();
		const subject = {
			delegateId: base.delegateId,
			grantedScope: base.grantedScope,
			expiresAt: base.expiresAt,
			parentDelegationId: null,
			revocable: true
		};
		const proof = await signedProof(subject, { signature: '' });
		const hash = await computeHash(proof, subject);
		const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM delegation_tasks').first<{ n: number }>();
		await expect(
			grantDelegation(db, auditEnv(), { ...base, grantedByProofHash: hash, proof })
		).rejects.toMatchObject({ code: 'invalid-proof' });
		const after = await env.DB.prepare('SELECT COUNT(*) AS n FROM delegation_tasks').first<{ n: number }>();
		expect(after?.n).toBe(before?.n ?? 0);
	});

	it('persists a grant when the signed proof envelope binds correctly', async () => {
		const base = baseInput();
		const subject = {
			delegateId: base.delegateId,
			grantedScope: base.grantedScope,
			expiresAt: base.expiresAt,
			parentDelegationId: null,
			revocable: true
		};
		const proof = await signedProof(subject);
		const hash = await computeHash(proof, subject);
		const result = await grantDelegation(
			db,
			auditEnv(),
			{
				...base,
				grantedByProofHash: hash,
				proof
			}
		);
		expect(result.delegationId).toMatch(/^del-/);
		expect(result.expiresAt).toBe(base.expiresAt);
	});

	it('does not persist a grant or unsigned audit when signing is unavailable', async () => {
		const base = baseInput();
		const subject = {
			delegateId: base.delegateId,
			grantedScope: base.grantedScope,
			expiresAt: base.expiresAt,
			parentDelegationId: null,
			revocable: true
		};
		const proof = await signedProof(subject);
		const hash = await computeHash(proof, subject);
		const grantsBefore = await env.DB.prepare(
			'SELECT COUNT(*) AS n FROM delegation_tasks'
		).first<{ n: number }>();
		const auditsBefore = await env.DB.prepare(
			'SELECT COUNT(*) AS n FROM admin_audit_log'
		).first<{ n: number }>();
		await expect(
			grantDelegation(db, {}, { ...base, grantedByProofHash: hash, proof })
		).rejects.toMatchObject({ code: 'audit-signing-unavailable' });
		const grantsAfter = await env.DB.prepare(
			'SELECT COUNT(*) AS n FROM delegation_tasks'
		).first<{ n: number }>();
		const auditsAfter = await env.DB.prepare(
			'SELECT COUNT(*) AS n FROM admin_audit_log'
		).first<{ n: number }>();
		expect(grantsAfter?.n).toBe(grantsBefore?.n ?? 0);
		expect(auditsAfter?.n).toBe(auditsBefore?.n ?? 0);
	});
});
