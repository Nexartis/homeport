/**
 * Shared types for the node-settings + invitations services.
 */

export type AuthMode = 'solo' | 'invite' | 'open';
export type UserRole = 'admin' | 'developer' | 'viewer';

/** Result of the login-gate check. */
export interface LoginAllowedResult {
	ok: boolean;
	/** Machine-readable reason when ok is false. */
	reason?:
		| 'no_settings'
		| 'solo_mode'
		| 'not_invited'
		| 'revoked'
		| 'expired'
		| 'waitlisted'
		| 'error';
	/** Optional role to attach to the session on success. */
	role?: UserRole;
	/** Human-readable message for admin logs / UI. */
	message?: string;
}

/** Result of the accept-on-first-login promotion. */
export interface AcceptInvitationResult {
	accepted: boolean;
	invitationId?: string;
	role?: UserRole;
}
