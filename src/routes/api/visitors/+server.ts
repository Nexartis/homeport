/**
 * Visitor Registration API
 *
 * POST /api/visitors — Record a vault-gate visitor (name + email)
 *
 * If the email already exists, increments visit_count and updates last_visited_at.
 * Otherwise creates a new site_visitors row.
 *
 * Body: { name: string, email: string, source?: string }
 * Response: { success: true } | { error: string }
 *
 * @swagger
 * /api/visitors:
 *   post:
 *     summary: Register visitor
 *     description: Record a visitor from vault-gate. Upserts by email.
 *     tags:
 *       - Internal
 *     responses:
 *       200:
 *         description: Visitor recorded
 *       400:
 *         description: Missing name or email
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { markPublic } from '$lib/server/auth-lanes';
import { createLogger } from '$lib/utils/logger';
import { sql } from 'drizzle-orm';

import { EMAIL_REGEX } from '$lib/utils/validation';

const log = createLogger(undefined, 'visitors-api');

/** Simple IP-based rate limit: max 10 visitor registrations per IP per hour */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SEC = 3600;

export const POST: RequestHandler = async ({ request, platform, getClientAddress, url }) => {
	markPublic({
		reason: 'vault-gate visitor intake — same-origin CSRF + IP rate-limit + email validation',
		rateLimit: `${RATE_LIMIT_MAX}/h per IP`,
		csrf: true
	});

	// --- CSRF: Reject cross-origin requests ---
	const origin = request.headers.get('origin');
	if (origin) {
		const allowed = url.origin;
		if (origin !== allowed) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	const d1 = platform?.env?.DB;
	if (!d1) {
		return json({ error: 'Database not available' }, { status: 503 });
	}

	// --- Rate limiting via KV ---
	const kv = platform?.env?.NANDA_NODE_CACHE;
	if (kv) {
		try {
			const ip = getClientAddress();
			const rlKey = `rl:visitor:${ip}`;
			const current = parseInt((await kv.get(rlKey)) || '0', 10);
			if (current >= RATE_LIMIT_MAX) {
				return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
			}
			await kv.put(rlKey, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC });
		} catch {
			/* rate limit check failed — proceed anyway */
		}
	}

	let body: { name?: string; email?: string; source?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const name = body.name?.trim();
	const email = body.email?.trim().toLowerCase();
	const source = body.source?.trim() || 'vault_gate';

	if (!name || name.length < 2) {
		return json({ error: 'A valid name is required (at least 2 characters)' }, { status: 400 });
	}
	if (!email || !EMAIL_REGEX.test(email)) {
		return json({ error: 'A valid email address is required' }, { status: 400 });
	}

	const db = createDbClient(d1);

	try {
		// Atomic upsert — no race condition on concurrent requests for the same email
		const id = `sv-${crypto.randomUUID()}`;
		await db.run(sql`
			INSERT INTO site_visitors (id, email, name, source, status, visit_count, created_at, updated_at, last_visited_at)
			VALUES (${id}, ${email}, ${name}, ${source}, 'active', 1, unixepoch(), unixepoch(), unixepoch())
			ON CONFLICT(email) DO UPDATE SET
				name = ${name},
				visit_count = visit_count + 1,
				updated_at = unixepoch(),
				last_visited_at = unixepoch()
		`);

		return json({ success: true });
	} catch (error) {
		log.error('POST', 'Error recording visitor', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'Failed to record visitor' }, { status: 500 });
	}
};
