/**
 * Owner guard tests — isOwner + requireOwner.
 */
import { describe, it, expect } from 'vitest';
import { isOwner, requireOwner } from '../src/lib/server/roles';

const mkUser = (email?: string | null, roles: string[] = ['admin']) => ({
	isAuthenticated: true,
	id: 'user-1',
	email: email ?? null,
	roles
});

describe('isOwner', () => {
	it('matches case-insensitively', () => {
		expect(isOwner(mkUser('Owner@Example.COM'), 'owner@example.com')).toBe(true);
		expect(isOwner(mkUser('owner@example.com'), 'OWNER@EXAMPLE.COM')).toBe(true);
	});

	it('trims whitespace on both sides', () => {
		expect(isOwner(mkUser('  owner@example.com  '), '  owner@example.com  ')).toBe(true);
	});

	it('returns false for mismatch', () => {
		expect(isOwner(mkUser('someone@example.com'), 'owner@example.com')).toBe(false);
	});

	it('returns false when user is null', () => {
		expect(isOwner(null, 'owner@example.com')).toBe(false);
		expect(isOwner(undefined, 'owner@example.com')).toBe(false);
	});

	it('returns false when ownerEmail is null, undefined, or empty', () => {
		expect(isOwner(mkUser('owner@example.com'), null)).toBe(false);
		expect(isOwner(mkUser('owner@example.com'), undefined)).toBe(false);
		expect(isOwner(mkUser('owner@example.com'), '')).toBe(false);
		expect(isOwner(mkUser('owner@example.com'), '   ')).toBe(false);
	});

	it('returns false when user.email is null, undefined, or empty', () => {
		expect(isOwner(mkUser(null), 'owner@example.com')).toBe(false);
		expect(isOwner(mkUser(undefined), 'owner@example.com')).toBe(false);
		expect(isOwner(mkUser(''), 'owner@example.com')).toBe(false);
		expect(isOwner(mkUser('   '), 'owner@example.com')).toBe(false);
	});
});

describe('requireOwner', () => {
	it('does not throw for matching owner', () => {
		expect(() => requireOwner(mkUser('owner@example.com'), 'owner@example.com')).not.toThrow();
	});

	it('throws 403 for non-owner', () => {
		expect(() => requireOwner(mkUser('someone@example.com'), 'owner@example.com')).toThrow();
		try {
			requireOwner(mkUser('someone@example.com'), 'owner@example.com');
		} catch (e) {
			expect((e as { status: number }).status).toBe(403);
			expect((e as { body: { message: string } }).body.message).toMatch(/owner access required/i);
		}
	});

	it('throws 403 when user is null', () => {
		expect(() => requireOwner(null, 'owner@example.com')).toThrow();
		try {
			requireOwner(null, 'owner@example.com');
		} catch (e) {
			expect((e as { status: number }).status).toBe(403);
		}
	});

	it('throws 403 when owner email is missing', () => {
		expect(() => requireOwner(mkUser('owner@example.com'), null)).toThrow();
		try {
			requireOwner(mkUser('owner@example.com'), null);
		} catch (e) {
			expect((e as { status: number }).status).toBe(403);
		}
	});
});
