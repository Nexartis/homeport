/**
 * Resend transport — minimal HTTP client for api.resend.com/emails.
 *
 * Pattern mirrors nexartis-com/contact: pull RESEND_API_KEY via
 * Secrets Store binding, POST JSON, log non-2xx bodies.
 *
 * Uses resolveSecret() so Pegasus deployments can set the key via
 * KV fallback (`__node_secrets:resend_api_key`).
 */

import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback } from '$lib/utils/node-secrets';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'resend');

export interface ResendEnv {
	RESEND_API_KEY?: string | { get: () => Promise<string> };
	NANDA_NODE_CACHE?: KVNamespace;
	FROM_EMAIL?: string;
}

export interface ResendPayload {
	from: string;
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	reply_to?: string;
}

export interface ResendResult {
	sent: boolean;
	id?: string;
	error?: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Resolve the outbound `From:` address at request time.
 *
 * Tenant nodes MUST configure `env.FROM_EMAIL` (Pegasus wires this from the
 * operator's domain in setup-cubicube.sh, e.g. `noreply@<tenant-domain>`).
 * We fail loudly rather than falling back to a hardcoded `noreply@nexartis.com`
 * because a shared-brand From address on a tenant's outbound mail is both
 * confusing to recipients and defeats SPF/DKIM alignment for the tenant.
 *
 * @throws {Error} when `env.FROM_EMAIL` is missing or blank. Callers that
 * need a non-throwing variant should catch and treat delivery as skipped
 * (see `tryGetFromAddress` in `$lib/email/index.ts`).
 */
export function getFromAddress(env: ResendEnv): string {
	const from = env.FROM_EMAIL?.trim();
	if (!from) {
		throw new Error(
			'FROM_EMAIL is not configured. Tenant node operators must set FROM_EMAIL (e.g. "NANDA Node <noreply@example.com>") in wrangler.jsonc vars.'
		);
	}
	return from;
}

/**
 * Resolve the Resend API key, preferring the Secrets Store binding and
 * falling back to KV (`__node_secrets:resend_api_key`) for Pegasus nodes.
 */
export async function getResendApiKey(env: ResendEnv): Promise<string | undefined> {
	return resolveSecret(env.RESEND_API_KEY, kvFallback(env, 'resend_api_key'));
}

/**
 * POST an email payload to Resend. Returns { sent: false } (not throws)
 * when the key is missing or the request fails — callers treat delivery
 * as best-effort and surface the error to the operator.
 */
export async function sendResendEmail(
	env: ResendEnv,
	payload: ResendPayload
): Promise<ResendResult> {
	const apiKey = await getResendApiKey(env);
	if (!apiKey || !apiKey.trim()) {
		log.warn('sendResendEmail', 'RESEND_API_KEY not configured');
		return { sent: false, error: 'missing_api_key' };
	}

	try {
		const res = await fetch(RESEND_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			let detail: unknown = null;
			try {
				detail = await res.json();
			} catch {
				detail = await res.text().catch(() => '');
			}
			log.error('sendResendEmail', 'Resend API error', {
				status: res.status,
				detail
			});
			return { sent: false, error: `resend_${res.status}` };
		}

		const body = (await res.json().catch(() => null)) as { id?: string } | null;
		return { sent: true, id: body?.id };
	} catch (err) {
		log.error('sendResendEmail', 'Resend fetch failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return { sent: false, error: 'network_error' };
	}
}
