/**
 * Key Rotation — Ed25519 signing with versioned keys
 *
 * Strategy:
 *  - Secrets are versioned: KYM_NANDA_ED25519_PRIVATE_KEY_v1, _v2, ...
 *  - signWithLatestKey() uses the newest available key version
 *  - verifyWithAnyKey() tries all available public key versions
 *  - Keys stored as base64-encoded PKCS8 (private) / SPKI (public) DER
 */
import type { Env } from '$lib/types';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, resolvePublicKey } from '$lib/utils/node-secrets';

/** Maximum key versions to check */
const MAX_KEY_VERSIONS = 5;

/**
 * Import an Ed25519 private key from base64 PKCS8 DER.
 */
async function importPrivateKey(base64Der: string): Promise<CryptoKey> {
	const der = Uint8Array.from(atob(base64Der), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
}

/**
 * Import an Ed25519 public key from base64 SPKI DER.
 */
async function importPublicKey(base64Der: string): Promise<CryptoKey> {
	const der = Uint8Array.from(atob(base64Der), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
}

/**
 * Resolve the latest available private key and its version number.
 * Tries versions in descending order (newest first).
 * Handles both Secrets Store bindings and plain strings via resolveSecret().
 */
async function resolveLatestPrivateKey(env: Env): Promise<{ key: string; version: number } | null> {
	// Check from highest to lowest version
	for (let v = MAX_KEY_VERSIONS; v >= 1; v--) {
		const envKey = `KYM_NANDA_ED25519_PRIVATE_KEY_v${v}` as keyof Env;
		const value = await resolveSecret(env[envKey], kvFallback(env, `ed25519_private_key_v${v}`));
		if (value) {
			return { key: value, version: v };
		}
	}
	return null;
}

/**
 * Resolve all available public key versions.
 * Checks env vars first, falls back to KV for Pegasus-deployed nodes.
 */
async function resolvePublicKeys(env: Env): Promise<Array<{ key: string; version: number }>> {
	const keys: Array<{ key: string; version: number }> = [];
	for (let v = 1; v <= MAX_KEY_VERSIONS; v++) {
		const envKey = `NANDA_ED25519_PUBLIC_KEY_v${v}` as keyof Env;
		const value = await resolvePublicKey(env[envKey] as string | undefined, env, `v${v}`);
		if (value) {
			keys.push({ key: value, version: v });
		}
	}
	return keys;
}

export interface SignedPayload {
	/** Base64-encoded Ed25519 signature */
	signature: string;
	/** Key version used for signing */
	keyVersion: number;
	/** ISO timestamp of signing */
	signedAt: string;
}

/**
 * Sign arbitrary data with the latest available Ed25519 private key.
 * Returns the base64 signature, key version, and timestamp.
 */
export async function signWithLatestKey(env: Env, data: string): Promise<SignedPayload> {
	const resolved = await resolveLatestPrivateKey(env);
	if (!resolved) {
		throw new Error('No Ed25519 private key available — check Secrets Store bindings');
	}

	const privateKey = await importPrivateKey(resolved.key);
	const encoded = new TextEncoder().encode(data);
	const signatureBuffer = await crypto.subtle.sign('Ed25519', privateKey, encoded);
	const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

	return {
		signature,
		keyVersion: resolved.version,
		signedAt: new Date().toISOString()
	};
}

/**
 * Sign arbitrary data and return the raw ArrayBuffer signature.
 * Used by buildVCProof which needs raw bytes for base58btc encoding.
 */
async function signWithLatestKeyRaw(
	env: Env,
	data: string
): Promise<{ signatureBuffer: ArrayBuffer; keyVersion: number; signedAt: string }> {
	const resolved = await resolveLatestPrivateKey(env);
	if (!resolved) {
		throw new Error('No Ed25519 private key available — check Secrets Store bindings');
	}

	const privateKey = await importPrivateKey(resolved.key);
	const encoded = new TextEncoder().encode(data);
	const signatureBuffer = await crypto.subtle.sign('Ed25519', privateKey, encoded);

	return {
		signatureBuffer,
		keyVersion: resolved.version,
		signedAt: new Date().toISOString()
	};
}

/**
 * Verify a signature against all available public key versions.
 * Returns true if any version verifies successfully.
 */
export async function verifyWithAnyKey(
	env: Env,
	data: string,
	signatureBase64: string,
	preferVersion?: number
): Promise<{ valid: boolean; keyVersion?: number }> {
	const publicKeys = await resolvePublicKeys(env);
	if (publicKeys.length === 0) {
		return { valid: false };
	}

	const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
	const encoded = new TextEncoder().encode(data);

	// If a preferred version is specified, try that first
	if (preferVersion) {
		const sorted = [...publicKeys].sort((a, b) =>
			a.version === preferVersion ? -1 : b.version === preferVersion ? 1 : b.version - a.version
		);
		publicKeys.length = 0;
		publicKeys.push(...sorted);
	}

	for (const pk of publicKeys) {
		try {
			const publicKey = await importPublicKey(pk.key);
			const valid = await crypto.subtle.verify('Ed25519', publicKey, signatureBytes, encoded);
			if (valid) {
				return { valid: true, keyVersion: pk.version };
			}
		} catch {
			// Key import or verify failed — try next version
			continue;
		}
	}

	return { valid: false };
}

/**
 * Encode raw bytes as base58btc (Bitcoin alphabet).
 * Used for multibase-encoded proof values in W3C VCs.
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58btc(bytes: Uint8Array): string {
	// Count leading zeros
	let leadingZeros = 0;
	for (const b of bytes) {
		if (b !== 0) break;
		leadingZeros++;
	}

	// Convert byte array to a big integer (manual bigint arithmetic)
	const digits: number[] = [0];
	for (const byte of bytes) {
		let carry = byte;
		for (let j = 0; j < digits.length; j++) {
			carry += digits[j] << 8;
			digits[j] = carry % 58;
			carry = (carry / 58) | 0;
		}
		while (carry > 0) {
			digits.push(carry % 58);
			carry = (carry / 58) | 0;
		}
	}

	// Build result: leading '1's for zero bytes + encoded digits (reversed)
	let result = BASE58_ALPHABET[0].repeat(leadingZeros);
	for (let i = digits.length - 1; i >= 0; i--) {
		result += BASE58_ALPHABET[digits[i]];
	}
	return result;
}

/**
 * Build a W3C Verifiable Credential proof object with Ed25519 signature.
 * proofValue uses multibase-encoded base58btc with 'z' prefix per Ed25519Signature2020 spec.
 */
export async function buildVCProof(
	env: Env,
	credentialPayload: string
): Promise<Record<string, unknown>> {
	const { signatureBuffer, keyVersion, signedAt } = await signWithLatestKeyRaw(
		env,
		credentialPayload
	);

	// Multibase base58btc: 'z' prefix + base58btc-encoded signature bytes
	const proofValue = 'z' + encodeBase58btc(new Uint8Array(signatureBuffer));

	return {
		type: 'Ed25519Signature2020',
		created: signedAt,
		verificationMethod: `${env.NANDA_REGISTRY_URL}/.well-known/keys/ed25519-v${keyVersion}`,
		proofPurpose: 'assertionMethod',
		proofValue
	};
}
