/**
 * Database Client Wrapper
 *
 * Thin wrapper around D1 binding that provides typed access to the database.
 * All repositories consume this client for database operations.
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Create a typed Drizzle client from a D1 database binding
 *
 * @param d1 - Cloudflare D1 database binding
 * @returns Typed Drizzle client with schema
 */
export function createDbClient(d1: D1Database) {
	return drizzle(d1, { schema });
}

/**
 * Type alias for the Drizzle client
 */
export type DbClient = ReturnType<typeof createDbClient>;
