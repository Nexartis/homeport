/**
 * Developer Keys Repository
 *
 * Typed repository for developer API key management on the Nexartis NANDA Node.
 * Keys use `nanda_` prefix and are hashed with SHA-256 before storage.
 * The raw key is only returned once at generation time.
 *
 * Modelled after KnowYourModel's api-key.ts but adapted for NANDA's
 * integer-timestamp schema conventions.
 */

import { eq, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DbClient } from '../client';
import { developerKeys, type DeveloperKey } from '../schema';

// ===================================================================
// Types
// ===================================================================

export type ApiKeyTier = 'free' | 'pro' | 'enterprise';
export type ApiKeyStatus = 'active' | 'revoked';

/** Tier-based rate limits (requests per month) */
const TIER_LIMITS: Record<ApiKeyTier, number> = {
	free: 1000,
	pro: 10000,
	enterprise: 100000
};

/** Result returned when a new key is generated (includes raw key shown once) */
export interface GeneratedApiKey {
	id: string;
	rawKey: string;
	keyPrefix: string;
	name: string;
	tier: ApiKeyTier;
	rateLimitMonthly: number;
	createdAt: number;
}

/** Result of API key validation */
export type ValidatedApiKey = DeveloperKey & { isValid: true };

/** Returned when a key's monthly usage exceeds its limit */
export interface ApiKeyRateLimited {
	rateLimited: true;
	limit: number;
	resetAt: number; // unix seconds when the counter resets
}

/** Discriminated result from validateDevApiKey — distinguishes invalid from rate-limited */
export type ValidateApiKeyResult = ValidatedApiKey | ApiKeyRateLimited | null;

// ===================================================================
// Crypto Helpers (Cloudflare Workers Web Crypto API)
// ===================================================================

/** Generate a cryptographically secure API key with nanda_ prefix */
function generateRawKey(): string {
	const bytes = new Uint8Array(32); // 256-bit key
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `nanda_${hex}`;
}

/** SHA-256 hash a raw API key for storage */
async function hashKey(rawKey: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(rawKey);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ===================================================================
// Key Generation
// ===================================================================

/**
 * Generate a new API key for a developer.
 * Returns the raw key exactly once — it is never stored.
 */
export async function generateDevApiKey(
	db: DbClient,
	ownerId: string,
	ownerEmail: string | null,
	name: string,
	tier: ApiKeyTier = 'free'
): Promise<GeneratedApiKey> {
	const id = nanoid();
	const rawKey = generateRawKey();
	const keyHash = await hashKey(rawKey);
	const keyPrefix = rawKey.slice(0, 12); // "nanda_" + first 6 hex chars

	const now = Math.floor(Date.now() / 1000);
	const usageResetAt = getNextMonthResetUnix();

	await db.insert(developerKeys).values({
		id,
		keyHash,
		keyPrefix,
		name,
		ownerId,
		ownerEmail,
		status: 'active',
		tier,
		rateLimitMonthly: TIER_LIMITS[tier],
		scopes: null,
		usageCountMonthly: 0,
		usageResetAt,
		createdAt: now
	});

	return { id, rawKey, keyPrefix, name, tier, rateLimitMonthly: TIER_LIMITS[tier], createdAt: now };
}

// ===================================================================
// Key Validation
// ===================================================================

/**
 * Validate a raw API key from an Authorization header.
 * Hashes the key, looks it up, checks status + expiration + rate limits.
 */
export async function validateDevApiKey(
	db: DbClient,
	rawKey: string
): Promise<ValidateApiKeyResult> {
	const keyHash = await hashKey(rawKey);

	const key = await db.query.developerKeys.findFirst({
		where: eq(developerKeys.keyHash, keyHash)
	});

	if (!key) return null;
	if (key.status !== 'active') return null;

	const nowUnix = Math.floor(Date.now() / 1000);
	if (key.expiresAt && key.expiresAt < nowUnix) return null;

	// Reset counter if past reset window (or initialize if usageResetAt was never set)
	if (!key.usageResetAt || key.usageResetAt < nowUnix) {
		const newResetAt = getNextMonthResetUnix();
		await db
			.update(developerKeys)
			.set({ usageCountMonthly: 0, usageResetAt: newResetAt })
			.where(eq(developerKeys.id, key.id));
		key.usageCountMonthly = 0;
		key.usageResetAt = newResetAt;
	}

	if (key.usageCountMonthly >= key.rateLimitMonthly) {
		return {
			rateLimited: true,
			limit: key.rateLimitMonthly,
			resetAt: key.usageResetAt ?? getNextMonthResetUnix()
		};
	}

	return { ...key, isValid: true };
}

// ===================================================================
// Key CRUD Operations
// ===================================================================

/** Get an API key by ID (for management operations) */
export async function getDevApiKeyById(db: DbClient, id: string): Promise<DeveloperKey | null> {
	const result = await db.query.developerKeys.findFirst({
		where: eq(developerKeys.id, id)
	});
	return result ?? null;
}

/** List all API keys for a user (sorted newest first) */
export async function listDevApiKeys(db: DbClient, ownerId: string): Promise<DeveloperKey[]> {
	return await db.query.developerKeys.findMany({
		where: eq(developerKeys.ownerId, ownerId),
		orderBy: [desc(developerKeys.createdAt)]
	});
}

/** Revoke an API key (soft delete — marks as revoked). Verifies ownership. */
export async function revokeDevApiKey(
	db: DbClient,
	keyId: string,
	ownerId: string
): Promise<DeveloperKey | null> {
	const key = await getDevApiKeyById(db, keyId);
	if (!key || key.ownerId !== ownerId) return null;
	if (key.status === 'revoked') return key;

	const nowUnix = Math.floor(Date.now() / 1000);
	const result = await db
		.update(developerKeys)
		.set({ status: 'revoked', revokedAt: nowUnix })
		.where(eq(developerKeys.id, keyId))
		.returning();

	return result[0] ?? null;
}

// ===================================================================
// Usage Tracking
// ===================================================================

/** Increment usage counter and update last-used timestamp. Called after validation. */
export async function incrementDevKeyUsage(db: DbClient, keyId: string): Promise<void> {
	const nowUnix = Math.floor(Date.now() / 1000);
	await db
		.update(developerKeys)
		.set({
			usageCountMonthly: sql`${developerKeys.usageCountMonthly} + 1`,
			lastUsedAt: nowUnix
		})
		.where(eq(developerKeys.id, keyId));
}

// ===================================================================
// Helpers
// ===================================================================

/** Get the first day of the next month as a Unix timestamp */
function getNextMonthResetUnix(): number {
	const now = new Date();
	const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	return Math.floor(nextMonth.getTime() / 1000);
}
