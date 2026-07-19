/**
 * VC Revocation — StatusList2021 implementation
 *
 * Provides certificate revocation checking and status list generation.
 * Uses the cert_revocations D1 table as the source of truth.
 *
 * StatusList2021 spec: https://www.w3.org/TR/vc-status-list/
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { certRevocations } from '$lib/db/schema';
import {
	getCertificateExists,
	getRevocation,
	getMaxRevocationIndex,
	insertRevocation,
	getAllRevocationIndices,
	getRevocationStats as repoGetRevocationStats
} from '$lib/db/repositories';

/** Maximum bit index for the status list (16KB = 131,072 bits) */
const STATUS_LIST_SIZE = 131072;

export interface RevocationResult {
	revoked: boolean;
	reason?: string;
	revokedAt?: string;
}

/**
 * Revoke a certificate by cert_id.
 * Assigns the next available StatusList2021 bit index.
 */
export async function revokeCertificate(
	db: DbClient,
	certId: string,
	reason: string
): Promise<{ ok: boolean; statusListIndex?: number; error?: string }> {
	// Check if certificate exists
	const cert = await getCertificateExists(db, certId);
	if (!cert) {
		return { ok: false, error: 'Certificate not found' };
	}

	// Check if already revoked
	const existing = await getRevocation(db, certId);
	if (existing) {
		return { ok: false, error: 'Certificate already revoked' };
	}

	// Allocate the next status_list_index via getMax + insert.
	// D1/SQLite serialises all writes, so this two-step approach is safe.
	// The UNIQUE index on status_list_index provides a secondary guarantee —
	// if a constraint violation ever occurs, we retry once.
	let nextIndex: number;
	const MAX_RETRIES = 2;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const maxIdx = await getMaxRevocationIndex(db);
			nextIndex = maxIdx + 1;

			// Check capacity before insert to avoid writing an out-of-range index
			if (nextIndex >= STATUS_LIST_SIZE) {
				return { ok: false, error: 'Status list capacity exceeded — rotate status list' };
			}

			await insertRevocation(db, { certId, reason, statusListIndex: nextIndex });
			break;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if ((msg.includes('UNIQUE') || msg.includes('constraint')) && attempt < MAX_RETRIES - 1) {
				continue; // Retry — another concurrent revocation won the race for this index
			}
			if (msg.includes('UNIQUE') || msg.includes('constraint')) {
				return { ok: false, error: 'Concurrent revocation conflict — please retry' };
			}
			throw err;
		}
	}
	// Safety: nextIndex is always assigned by the loop above (break or return/throw)
	nextIndex = nextIndex!;

	return { ok: true, statusListIndex: nextIndex };
}

/**
 * Check if a certificate is revoked.
 */
export async function isRevoked(db: DbClient, certId: string): Promise<RevocationResult> {
	const row = await getRevocation(db, certId);

	if (!row) {
		return { revoked: false };
	}

	return {
		revoked: true,
		reason: row.reason,
		revokedAt: row.revokedAt ? new Date(row.revokedAt * 1000).toISOString() : undefined
	};
}

/**
 * Build the StatusList2021 credential — a compressed bitstring of all revocations.
 *
 * Each bit in the bitstring corresponds to a `status_list_index`.
 * Bit = 1 means revoked, bit = 0 means active.
 *
 * Returns a W3C VerifiableCredential-shaped object.
 */
export async function getRevocationList(
	db: DbClient,
	issuerUrl: string
): Promise<Record<string, unknown>> {
	// Fetch all revocation indices
	const rows = await getAllRevocationIndices(db);

	// Build bitstring (STATUS_LIST_SIZE bits = 16KB)
	const byteLength = Math.ceil(STATUS_LIST_SIZE / 8);
	const bitstring = new Uint8Array(byteLength);

	for (const row of rows) {
		const idx = row.statusListIndex;
		if (idx !== null && idx >= 0 && idx < STATUS_LIST_SIZE) {
			const byteIndex = Math.floor(idx / 8);
			const bitIndex = 7 - (idx % 8); // MSB first per spec
			bitstring[byteIndex] |= 1 << bitIndex;
		}
	}

	// Gzip-compress then base64url-encode the bitstring per StatusList2021 spec
	const encodedList = await gzipThenBase64url(bitstring);

	return {
		'@context': [
			'https://www.w3.org/2018/credentials/v1',
			'https://w3id.org/vc/status-list/2021/v1'
		],
		id: `${issuerUrl}/credentials/status/1`,
		type: ['VerifiableCredential', 'StatusList2021Credential'],
		issuer: issuerUrl,
		issuanceDate: new Date().toISOString(),
		credentialSubject: {
			id: `${issuerUrl}/credentials/status/1#list`,
			type: 'StatusList2021',
			statusPurpose: 'revocation',
			encodedList
		}
	};
}

/**
 * Get revocation stats for monitoring.
 */
export async function getRevocationStats(db: DbClient): Promise<{
	totalRevoked: number;
	latestRevocation: string | null;
}> {
	const stats = await repoGetRevocationStats(db);
	const [latestRow] = await db
		.select({ latest: sql<number | null>`MAX(revoked_at)` })
		.from(certRevocations);

	return {
		totalRevoked: stats.total,
		latestRevocation: latestRow?.latest ? new Date(latestRow.latest * 1000).toISOString() : null
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gzip-compress a Uint8Array and return base64url-encoded string per StatusList2021 spec. */
async function gzipThenBase64url(data: Uint8Array<ArrayBuffer>): Promise<string> {
	const cs = new CompressionStream('gzip');
	const writer = cs.writable.getWriter();
	await writer.write(data);
	await writer.close();

	const chunks: Uint8Array[] = [];
	const reader = cs.readable.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	// base64url: standard base64 with + → -, / → _, trailing = removed
	let binary = '';
	for (let i = 0; i < result.length; i++) {
		binary += String.fromCharCode(result[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
