/**
 * Workers-safe hex / base64url / utf8 helpers for the Yanez integration.
 *
 * Ported from `nexartis-yanez-client` (`packages/stub/src/protocol/encoding.ts`)
 * but with `Buffer` replaced by `atob`/`btoa` + `Uint8Array` so it runs on
 * Cloudflare Workers without the node `Buffer` global.
 */

export function bytesToHex(bytes: Uint8Array): string {
	let out = '';
	for (const byte of bytes) {
		out += byte.toString(16).padStart(2, '0');
	}
	return out;
}

export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
	if (clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
		throw new Error('invalid hex string');
	}
	const out = new Uint8Array(clean.length / 2);
	for (let i = 0; i < out.length; i += 1) {
		out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

/** Standard base64 (not url) of raw bytes, Workers-safe via btoa. */
function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

/** base64url (no padding) of raw bytes. */
export function b64url(bytes: Uint8Array): string {
	const std = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_');
	// Manual right-strip of '=' padding avoids the CodeQL js/polynomial-redos
	// warning on `.replace(/=+$/, '')`. Input is always our own output.
	let end = std.length;
	while (end > 0 && std.charCodeAt(end - 1) === 61 /* '=' */) end -= 1;
	return end === std.length ? std : std.slice(0, end);
}

/** Decode base64url (with or without padding) to raw bytes. */
export function b64urlDecode(value: string): Uint8Array {
	const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
	const std = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
	const binary = atob(std);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

export function utf8Bytes(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

export function utf8String(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

/** Cryptographically-random hex string of `byteLength` bytes. */
export function randomHex(byteLength: number): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytesToHex(bytes);
}
