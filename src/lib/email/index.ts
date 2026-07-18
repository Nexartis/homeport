/**
 * Email barrel — high-level helpers that bind templates to the Resend transport.
 *
 * Auth-critical emails (magic link, verification, re-auth) remain owned by
 * Sentinel. Only operator-originated notifications live here.
 */

import { sendResendEmail, getFromAddress, type ResendEnv, type ResendResult } from './resend';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'email');
import { renderInvitationEmail, type InvitationTemplateVars } from './templates/invitation';
import {
	renderWaitlistConfirmationEmail,
	type WaitlistConfirmationVars
} from './templates/waitlist-confirmation';
import {
	renderWaitlistApprovedEmail,
	type WaitlistApprovedVars
} from './templates/waitlist-approved';

export interface SendInvitationInput extends InvitationTemplateVars {
	to: string;
}

/**
 * Resolve `From:` address without throwing. Returns null when the tenant
 * hasn't configured FROM_EMAIL — callers surface a { sent: false } result.
 */
function tryGetFromAddress(env: ResendEnv): string | null {
	try {
		return getFromAddress(env);
	} catch (err) {
		log.warn('tryGetFromAddress', 'FROM_EMAIL not configured — skipping email send', {
			error: err instanceof Error ? err.message : String(err)
		});
		return null;
	}
}

/** Send the invitation email via Resend. Best-effort; never throws. */
export async function sendInvitationEmail(
	env: ResendEnv,
	input: SendInvitationInput
): Promise<ResendResult> {
	const from = tryGetFromAddress(env);
	if (!from) return { sent: false, error: 'missing_from_email' };
	const { subject, html, text } = renderInvitationEmail(input);
	return sendResendEmail(env, { from, to: input.to, subject, html, text });
}

/** Send the waitlist-confirmation email via Resend. Best-effort; never throws. */
export async function sendWaitlistConfirmationEmail(
	env: ResendEnv,
	input: WaitlistConfirmationVars
): Promise<ResendResult> {
	const from = tryGetFromAddress(env);
	if (!from) return { sent: false, error: 'missing_from_email' };
	const { subject, html, text } = renderWaitlistConfirmationEmail(input);
	return sendResendEmail(env, { from, to: input.to, subject, html, text });
}

/** Send the waitlist-approved email via Resend. Best-effort; never throws. */
export async function sendWaitlistApprovedEmail(
	env: ResendEnv,
	input: WaitlistApprovedVars
): Promise<ResendResult> {
	const from = tryGetFromAddress(env);
	if (!from) return { sent: false, error: 'missing_from_email' };
	const { subject, html, text } = renderWaitlistApprovedEmail(input);
	return sendResendEmail(env, { from, to: input.to, subject, html, text });
}

export { sendResendEmail, getFromAddress, getResendApiKey } from './resend';
export type { ResendEnv, ResendPayload, ResendResult } from './resend';
export { renderInvitationEmail } from './templates/invitation';
export type { InvitationTemplateVars } from './templates/invitation';
export { renderWaitlistConfirmationEmail } from './templates/waitlist-confirmation';
export type { WaitlistConfirmationVars } from './templates/waitlist-confirmation';
export { renderWaitlistApprovedEmail } from './templates/waitlist-approved';
export type { WaitlistApprovedVars } from './templates/waitlist-approved';
