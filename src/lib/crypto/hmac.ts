/**
 * HMAC-SHA256 helper (Web Crypto, Workers-safe).
 *
 * Single source of truth for keyed-hash derivation across the node
 * (audit-radius signing, Yanez callback capabilities, etc.).
 */

/** HMAC-SHA256 of `message` under `secret`, returned as lowercase hex. */
export async function hmacHex(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
