/**
 * Yanez deep-link + QR construction and the HMAC callback capability.
 *
 * The node mints a `yanezbio://sign` deep link that carries a callback URL
 * back to this node. The callback URL embeds a `cap` capability — an
 * HMAC(kind:id) under the node's HMAC secret — so the public callback route
 * can authenticate the app's POST without a node session. Ported from
 * `nexartis-yanez-client` (`yanez-do.ts` / `crypto.ts`).
 */

// Use the server renderer explicitly: the default `qrcode` entry resolves to
// the browser build, whose toDataURL needs a DOM canvas and throws in the
// Workers runtime ("You need to specify a canvas element"). `qrcode/lib/server`
// renders a PNG data URL via zlib (available under nodejs_compat, which this
// worker enables). Matches nexartis-yanez-client's usage.
import QRCode from 'qrcode/lib/server.js';
import { hmacHex } from './hmac';

/**
 * Capability token binding a callback to a specific request. The Yanez app
 * echoes it back via `?cap=` on the callback URL; the callback route recomputes
 * and compares with `!==`. This is a 256-bit HMAC hex over a per-request UUID,
 * so there is no timing oracle to exploit (each request has a distinct secret
 * input); a plain string compare is sufficient.
 */
export async function callbackCapability(
	secret: string,
	kind: string,
	requestId: string
): Promise<string> {
	return hmacHex(secret, `${kind}:${requestId}`);
}

/** Status-poll token (separate capability namespace from the callback cap). */
export async function statusToken(
	secret: string,
	kind: string,
	requestId: string
): Promise<string> {
	return hmacHex(secret, `${kind}:status:${requestId}`);
}

export interface BuiltDeepLink {
	callbackUrl: string;
	deepLink: string;
	qrDataUrl: string;
}

/**
 * Build the callback URL, the `yanezbio://sign` deep link, and a QR data URL.
 *
 * @param baseUrl  Public origin of this node (no trailing slash), e.g.
 *                 `https://nanda.example.com`.
 * @param cap      Callback capability from {@link callbackCapability}.
 * @param id       Request id (also the challenge row id).
 * @param messageB64  base64url message the app signs verbatim.
 */
export async function buildDeepLink(
	baseUrl: string,
	cap: string,
	id: string,
	messageB64: string
): Promise<BuiltDeepLink> {
	const base = baseUrl.replace(/\/$/, '');
	const callbackUrl = `${base}/api/yanez/callback/${encodeURIComponent(id)}?cap=${cap}`;
	const deepLink =
		`yanezbio://sign?message=${encodeURIComponent(messageB64)}` +
		`&callback=${encodeURIComponent(callbackUrl)}` +
		`&method=post&request_id=${encodeURIComponent(id)}`;
	const qrDataUrl = await QRCode.toDataURL(deepLink, {
		errorCorrectionLevel: 'M',
		margin: 1,
		width: 360
	});
	return { callbackUrl, deepLink, qrDataUrl };
}
