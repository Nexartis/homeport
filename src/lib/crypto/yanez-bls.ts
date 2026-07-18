/**
 * Yanez BLS12-381 signature verification + Ethereum-address derivation.
 *
 * Ported from `nexartis-yanez-client`
 * (`packages/stub/src/protocol/crypto.ts`), Workers-safe (`Buffer` replaced
 * with the local hex/utf8 helpers). The Yanez mobile app returns a BLS
 * G2Basic signature over the exact challenge bytes; the group public key is
 * a G1 point; the Ethereum address is `EIP-55(keccak256(pubkey_g1)[-20:])`
 * and is re-derived server-side (client-supplied value is informational).
 */

import { bls12_381 } from '@noble/curves/bls12-381';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, utf8Bytes } from './yanez-encoding';

/**
 * Domain separation tag for the Yanez BLS scheme
 * (basic scheme, signatures in G2). Must match the app and yanez-client.
 */
export const BLS_DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_';

/**
 * Verify a BLS signature over `messageBytes` under `publicKeyHex` (G1).
 *
 * Returns `false` on any malformed input (bad hex, non-canonical point, wrong
 * length) instead of throwing: the noble library and `hexToBytes` raise on
 * garbage, but from a verification standpoint garbage is simply "not valid".
 * Callers treat any non-`true` as a failed verification.
 */
export function verifyBls(
	signatureHex: string,
	publicKeyHex: string,
	messageBytes: Uint8Array
): boolean {
	try {
		return bls12_381.verify(hexToBytes(signatureHex), messageBytes, hexToBytes(publicKeyHex), {
			DST: BLS_DST
		});
	} catch {
		return false;
	}
}

/** Type guard for a `0x`-prefixed 20-byte hex Ethereum address. */
export function looksLikeEthAddress(value: unknown): value is string {
	return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Apply EIP-55 mixed-case checksum to a 20-byte address. */
function toEip55(addr20: Uint8Array): string {
	const lower = bytesToHex(addr20);
	const hashHex = bytesToHex(keccak_256(utf8Bytes(lower)));
	let out = '0x';
	for (let i = 0; i < lower.length; i += 1) {
		const char = lower[i];
		out +=
			char >= 'a' && char <= 'f' && Number.parseInt(hashHex[i], 16) >= 8
				? char.toUpperCase()
				: char;
	}
	return out;
}

/** Derive the EIP-55 Ethereum address from a G1 public-key hex string. */
export function ethAddressFromG1PubkeyHex(publicKeyHex: string): string {
	const digest = keccak_256(hexToBytes(publicKeyHex));
	return toEip55(digest.slice(-20));
}

/**
 * Re-derive the address from the public key and compare to the claimed one.
 * Server-side derivation is authoritative; a mismatching claim is not fatal
 * to verification but is surfaced so callers can flag spoof attempts.
 */
export function verifyAddressBinding(
	claimedEth: unknown,
	publicKeyHex: string
): { ok: boolean; derived: string } {
	const derived = ethAddressFromG1PubkeyHex(publicKeyHex);
	return {
		ok: looksLikeEthAddress(claimedEth) && claimedEth.toLowerCase() === derived.toLowerCase(),
		derived
	};
}
