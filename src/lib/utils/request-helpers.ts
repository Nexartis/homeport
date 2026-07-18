/**
 * Shared request validation helpers.
 *
 * Provides reusable functions for common request validation patterns
 * (JSON body parsing, DB binding checks, required field validation)
 * to reduce boilerplate across route handlers.
 */

import { json } from '@sveltejs/kit';

/**
 * Safely parse a JSON request body.
 * Returns [body, null] on success, or [null, errorResponse] on failure.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
	request: Request
): Promise<[T, null] | [null, Response]> {
	try {
		const body = await request.json();
		if (body === null || typeof body !== 'object' || Array.isArray(body)) {
			return [null, json({ error: 'Request body must be a JSON object' }, { status: 400 })];
		}
		return [body as T, null];
	} catch {
		return [null, json({ error: 'Invalid JSON body' }, { status: 400 })];
	}
}

/**
 * Check that the DB binding is available.
 * Returns null if available, or a 503 error Response.
 */
export function requireDb(env: Record<string, unknown> | undefined): Response | null {
	if (!env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}
	return null;
}

/**
 * Require a non-empty string field from a body object.
 * Returns null if valid, or a 400 error Response.
 */
export function requireString(
	body: Record<string, unknown>,
	field: string,
	label?: string
): Response | null {
	if (!body[field] || typeof body[field] !== 'string') {
		return json({ error: `${label ?? field} is required and must be a string` }, { status: 400 });
	}
	return null;
}
