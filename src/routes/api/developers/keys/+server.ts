/**
 * Developer API Key Management Endpoint
 *
 * POST /api/developers/keys — Generate a new API key (requires Sentinel session auth)
 * GET  /api/developers/keys — List all keys for the authenticated user
 *
 * @swagger
 * /api/developers/keys:
 *   post:
 *     summary: Generate a new API key
 *     description: Creates a new developer API key. Requires session authentication (not API key auth).
 *     tags:
 *       - Developer Keys
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Label for the key
 *               tier:
 *                 type: string
 *                 enum: [free, pro, enterprise]
 *                 default: free
 *     responses:
 *       201:
 *         description: API key generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 key:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     raw_key:
 *                       type: string
 *                     key_prefix:
 *                       type: string
 *                     name:
 *                       type: string
 *                     tier:
 *                       type: string
 *                     rate_limit_monthly:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: API key auth not permitted or non-admin tier request
 *       429:
 *         description: Maximum active keys reached
 *   get:
 *     summary: List API keys
 *     description: Lists all developer API keys for the authenticated user. Requires session authentication.
 *     tags:
 *       - Developer Keys
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       key_prefix:
 *                         type: string
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                       tier:
 *                         type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: API key auth not permitted
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { generateDevApiKey, listDevApiKeys } from '$lib/db/repositories';
import type { ApiKeyTier } from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireDeveloperSession } from '$lib/server/auth-lanes';
import { isAdmin } from '$lib/server/roles';

const log = createLogger(undefined, 'developer-keys');

/** POST — Generate a new API key */
export const POST: RequestHandler = async ({ locals, request, platform }) => {
	const actor = getActor(locals);
	requireDeveloperSession(actor, { log, fn: 'POST' });

	const env = platform!.env;
	const db = createDbClient(env.DB);

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) {
		return json({ error: 'name is required (a label for this key)' }, { status: 400 });
	}
	if (name.length > 100) {
		return json({ error: 'name must be 100 characters or fewer' }, { status: 400 });
	}

	// Tier defaults to 'free' — only admins can set higher tiers
	let tier: ApiKeyTier = 'free';
	if (body.tier && typeof body.tier === 'string') {
		const validTiers: ApiKeyTier[] = ['free', 'pro', 'enterprise'];
		if (!validTiers.includes(body.tier as ApiKeyTier)) {
			return json({ error: 'tier must be one of: free, pro, enterprise' }, { status: 400 });
		}
		if (body.tier !== 'free' && !isAdmin(actor.user)) {
			// Only admins can create pro/enterprise keys. Throw via error() so
			// the auth-lane contract (§3.2: all 403s use @sveltejs/kit error)
			// is respected end-to-end.
			log.warn('POST', 'denied', {
				reason: 'admin_required_for_paid_tier',
				actorKind: actor.kind,
				userEmail: actor.user.email ?? null,
				requestedTier: body.tier
			});
			throw error(403, 'admin_required_for_paid_tier');
		}
		tier = body.tier as ApiKeyTier;
	}

	// Limit keys per user (max 5 for free tier)
	const existingKeys = await listDevApiKeys(db, actor.user.id);
	const activeKeys = existingKeys.filter((k) => k.status === 'active');
	if (tier === 'free' && activeKeys.length >= 5) {
		return json(
			{ error: 'Maximum 5 active API keys per account on the free tier' },
			{ status: 429 }
		);
	}

	try {
		const generated = await generateDevApiKey(db, actor.user.id, actor.user.email, name, tier);
		log.info('POST', 'API key generated', { keyId: generated.id, tier, ownerId: actor.user.id });
		return json(
			{
				message: 'API key generated successfully. Save this key — it will not be shown again.',
				key: {
					id: generated.id,
					raw_key: generated.rawKey,
					key_prefix: generated.keyPrefix,
					name: generated.name,
					tier: generated.tier,
					rate_limit_monthly: generated.rateLimitMonthly,
					created_at: generated.createdAt
				}
			},
			{ status: 201 }
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('POST', 'Failed to generate API key', { error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/** GET — List all API keys for the authenticated user */
export const GET: RequestHandler = async ({ locals, platform }) => {
	const actor = getActor(locals);
	requireDeveloperSession(actor, { log, fn: 'GET' });

	const env = platform!.env;
	const db = createDbClient(env.DB);

	try {
		const keys = await listDevApiKeys(db, actor.user.id);
		return json({
			keys: keys.map((k) => ({
				id: k.id,
				key_prefix: k.keyPrefix,
				name: k.name,
				status: k.status,
				tier: k.tier,
				rate_limit_monthly: k.rateLimitMonthly,
				usage_count_monthly: k.usageCountMonthly,
				last_used_at: k.lastUsedAt,
				created_at: k.createdAt,
				revoked_at: k.revokedAt,
				expires_at: k.expiresAt
			}))
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		log.error('GET', 'Failed to list API keys', { error: msg });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
