/**
 * Drizzle ORM helpers — typed wrappers for Cloudflare D1 driver metadata.
 *
 * D1's Drizzle driver returns a `meta` object on write results (insert, update, delete)
 * containing the number of rows changed, but the Drizzle type definitions don't expose it.
 * This helper provides type-safe access without repeating `as unknown as { meta }` casts.
 */

/** D1 write result shape (Drizzle returns this but doesn't type it) */
interface D1WriteResult {
	meta?: {
		changes?: number;
		last_row_id?: number;
		duration?: number;
	};
}

/**
 * Extract the number of rows changed from a Drizzle D1 write result.
 *
 * @param result - The result from a Drizzle insert/update/delete operation.
 * @param fallback - Value to return if meta is unavailable (default: 0).
 * @returns The number of rows changed.
 *
 * @example
 * const result = await db.update(agents).set({ ... }).where(...);
 * if (getChangeCount(result) > 0) { ... }
 */
export function getChangeCount(result: unknown, fallback: number = 0): number {
	return (result as D1WriteResult)?.meta?.changes ?? fallback;
}
