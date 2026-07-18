/**
 * Yanez sign-and-return service types.
 */

export type YanezKind = 'session';
export type YanezStatus = 'pending' | 'verified' | 'invalid' | 'expired';

export interface MintOptions {
	/** Optional caller context stored with the challenge (audit only). */
	subject?: string;
	/** Message the app signs. If omitted, a random challenge is generated. */
	message?: string;
	/** Time-to-live in seconds (default 300, clamped 30..3600). */
	ttlSec?: number;
}

export interface MintResult {
	challengeId: string;
	deepLink: string;
	qrDataUrl: string;
	/** Callback URL embedded in the deep link; the `cap` capability is already a query param on it. */
	callbackUrl: string;
	/** Poll status at `/api/yanez/status/{challengeId}?status_token={statusToken}`. */
	statusToken: string;
	/** Unix seconds. */
	expiresAt: number;
}

/** Flat callback body posted by the Yanez app (sign-and-return). */
export interface YanezCallbackBody {
	signature?: unknown;
	group_public_key?: unknown;
	eth_address?: unknown;
	message?: unknown; // echoed base64url
	request_id?: unknown;
	yid?: unknown;
}

export type VerifyOutcome =
	| { ok: true; status: 'verified' }
	| { ok: false; httpStatus: number; error: string };

export interface StatusResult {
	status: YanezStatus;
	verifyOk: boolean;
	yid?: string | null;
	ethAddress?: string | null;
}
