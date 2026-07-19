/**
 * Shared date formatting utilities for admin pages.
 *
 * All functions accept epoch seconds (Unix timestamps) as used by D1.
 */

/** Format epoch seconds as a locale date string, or fallback if falsy. */
export function formatDate(epoch: number | null | undefined, fallback: string = '—'): string {
	if (!epoch) return fallback;
	return new Date(epoch * 1000).toLocaleDateString();
}

/** Format epoch seconds as ISO date (YYYY-MM-DD), or fallback if falsy. */
export function formatDateISO(epoch: number | null | undefined, fallback: string = '—'): string {
	if (!epoch || typeof epoch !== 'number') return fallback;
	return new Date(epoch * 1000).toISOString().split('T')[0];
}

/** Format epoch seconds as a full locale date+time string, or '' if falsy. */
export function formatDateTime(epoch: number | null | undefined): string {
	if (!epoch) return '';
	return new Date(epoch * 1000).toLocaleString();
}

/** Format epoch seconds (or a numeric string) as a human-readable relative time string. */
export function relativeTime(epoch: number | string | null | undefined): string {
	if (!epoch) return '—';
	const ts = typeof epoch === 'string' ? Number(epoch) : epoch;
	if (isNaN(ts)) return '—';
	const now = Math.floor(Date.now() / 1000);
	const diff = now - ts;
	if (diff < 60) return 'just now';
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
	return new Date(ts * 1000).toLocaleDateString();
}

/** Calculate days until a sunset epoch, returning a human string. */
export function daysUntilSunset(sunsetAt: number | null | undefined): string {
	if (!sunsetAt) return '—';
	const now = Math.floor(Date.now() / 1000);
	const diff = sunsetAt - now;
	if (diff <= 0) return 'Expired';
	const days = Math.ceil(diff / 86400);
	return `${days}d`;
}
