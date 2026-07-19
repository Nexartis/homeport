/**
 * POST /api/public/waitlist
 *
 * Public waitlist intake for nodes in `invite` mode with `waitlistEnabled=true`.
 * Accepts `{ email, note? }`, rate-limits per-IP via KV, and writes a row to
 * the invitations table with status='waitlisted'. Idempotent — duplicate
 * emails are not leaked as an enumeration side-channel.
 *
 * Response:
 *  - 200 `{ status: 'waitlisted' }` or `{ status: existingStatus }`
 *  - 404 `{ error: 'waitlist_not_enabled' }` when authMode!='invite' or disabled
 *  - 429 `{ error: 'rate_limited' }` with `Retry-After` header
 *  - 400 `{ error: 'invalid_email' }`
 */

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { createDbClient } from '$lib/db/client';
import { getSettings } from '$lib/services/node-settings';
import {
	getInvitationByEmail,
	createInvitation,
	appendAudit,
	normalizeEmail
} from '$lib/db/repositories';
import { validateEmail } from '$lib/utils/validation';
import { sendWaitlistConfirmationEmail } from '$lib/email';
import { issueWelcomeAck } from '$lib/server/welcome-ack';
import { markPublic } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'waitlist');

const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1h
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL = RATE_LIMIT_WINDOW_SECONDS * 2;

async function enforceRateLimit(
	kv: KVNamespace | undefined,
	ip: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
	if (!kv) return { allowed: true };
	const slot = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS);
	const key = `rl:waitlist:${ip}:${slot}`;
	const raw = await kv.get(key);
	const current = raw ? parseInt(raw, 10) || 0 : 0;
	if (current >= RATE_LIMIT_MAX) {
		const retryAfter = (slot + 1) * RATE_LIMIT_WINDOW_SECONDS - Math.floor(Date.now() / 1000);
		return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
	}
	await kv.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_TTL });
	return { allowed: true };
}

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	markPublic({
		reason: 'public waitlist intake — IP rate-limit + email validation + invite-mode gate',
		rateLimit: `${RATE_LIMIT_MAX}/h per IP`
	});

	if (!platform?.env?.DB) {
		throw error(503, 'database_unavailable');
	}

	const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
	const rl = await enforceRateLimit(platform.env.NANDA_NODE_CACHE, ip);
	if (!rl.allowed) {
		return json(
			{ error: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	let body: { email?: unknown; note?: unknown };
	try {
		body = (await request.json()) as { email?: unknown; note?: unknown };
	} catch {
		return json({ error: 'invalid_body' }, { status: 400 });
	}

	const rawEmail = typeof body.email === 'string' ? body.email : '';
	const emailCheck = validateEmail(rawEmail);
	if (!emailCheck.isFormValid) {
		return json({ error: 'invalid_email', message: emailCheck.emailError }, { status: 400 });
	}
	const email = normalizeEmail(rawEmail);
	const note =
		typeof body.note === 'string' && body.note.trim().length > 0
			? body.note.trim().slice(0, 500)
			: null;

	const db = createDbClient(platform.env.DB);
	const settings = await getSettings(db);

	// Gate: only available when node is in `invite` mode with waitlist enabled.
	if (settings.authMode !== 'invite' || !settings.waitlistEnabled) {
		return json({ error: 'waitlist_not_enabled' }, { status: 404 });
	}

	// Idempotency — never disclose whether the address was pre-existing.
	const existing = await getInvitationByEmail(db, email);
	if (existing) {
		// Still issue the ack cookie so the gate doesn't re-prompt.
		try {
			await issueWelcomeAck(cookies, platform.env, { reason: 'waitlisted', email });
		} catch {
			/* best-effort */
		}
		return json({ status: existing.status });
	}

	try {
		await createInvitation(db, {
			email,
			role: (settings.defaultRole as 'developer' | 'viewer' | 'admin') ?? 'developer',
			status: 'waitlisted',
			note
		});
	} catch (err) {
		log.error('POST', 'createInvitation failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		throw error(500, 'waitlist_create_failed');
	}

	// Send confirmation email — best-effort.
	try {
		await sendWaitlistConfirmationEmail(platform.env, {
			to: email,
			nodeName: settings.nodeName ?? undefined,
			supportEmail: settings.supportEmail ?? undefined
		});
	} catch (emailErr) {
		log.warn('POST', 'sendWaitlistConfirmationEmail failed (non-fatal)', {
			error: emailErr instanceof Error ? emailErr.message : String(emailErr)
		});
	}

	// Issue welcome_ack so the gate stays suppressed.
	try {
		await issueWelcomeAck(cookies, platform.env, { reason: 'waitlisted', email });
	} catch (ackErr) {
		log.warn('POST', 'issueWelcomeAck failed (non-fatal)', {
			error: ackErr instanceof Error ? ackErr.message : String(ackErr)
		});
	}

	// Audit — best-effort.
	try {
		await appendAudit(db, {
			eventType: 'waitlist.submitted',
			actorEmail: email,
			targetType: 'invitation',
			targetId: email,
			metadata: { note: note ?? undefined },
			ip,
			userAgent: request.headers.get('user-agent')
		});
	} catch {
		/* audit is best-effort */
	}

	return json({ status: 'waitlisted' });
};
