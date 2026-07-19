/**
 * Database Types — scaffold (AI owns after first install)
 *
 * Re-export schema types and define common database utilities.
 * Edit freely — add custom types, query helpers, etc.
 */

export * from './schema';

// ── Common query result types ──────────────────────────────────────

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
	hasMore: boolean;
}

export interface QueryOptions {
	page?: number;
	pageSize?: number;
	orderBy?: string;
	orderDir?: 'asc' | 'desc';
}

// Transaction helper type
export type TransactionCallback<T> = (tx: unknown) => Promise<T>;
