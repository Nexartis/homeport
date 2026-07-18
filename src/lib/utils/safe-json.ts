/**
 * Shared safe JSON parsing utilities.
 *
 * Replaces duplicated safeParse / safeJsonParse / safeParseActions functions
 * that were scattered across 7+ route files.
 */

/**
 * Safely parse a JSON string, returning the provided fallback on failure.
 * When value is null/undefined or cannot be parsed, returns fallback immediately.
 *
 * Overloads ensure callers that omit a fallback see `T | null` in the return type,
 * forcing them to handle the null case. Callers that provide an explicit fallback
 * get back `T` directly.
 */
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T;
export function safeJsonParse<T = unknown>(value: string | null | undefined): T | null;
export function safeJsonParse<T = unknown>(
	value: string | null | undefined,
	fallback?: T
): T | null {
	if (value == null) return fallback ?? null;
	try {
		const parsed = JSON.parse(value);
		// Guard against JSON `null` sneaking through as T when a fallback is provided.
		// Without this, callers using e.g. safeJsonParse<Record<…>>(str, {}) could
		// receive `null` at runtime while TypeScript claims it's `Record<…>`.
		if (parsed === null && fallback !== undefined) return fallback;
		return parsed as T;
	} catch {
		return fallback ?? null;
	}
}

/**
 * Safely parse a JSON string expected to be a string array.
 * Handles both raw `unknown` values (from DB row fields) and `string` values.
 * Filters out non-string elements.
 */
export function safeParseStringArray(value: unknown): string[] {
	if (typeof value === 'string') {
		const parsed = safeJsonParse<unknown>(value, []);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
	}
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === 'string');
	}
	return [];
}
