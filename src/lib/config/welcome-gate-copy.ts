/**
 * WelcomeGate copy — the strings shown on the branded cover that sits in
 * front of public routes when the node is in `solo` or `invite` auth mode.
 *
 * Defaults are overridable via `node_settings.welcomeHeadline` /
 * `welcomeBody` and get re-shaped into mode-aware CTAs by {@link resolveCopy}.
 */

import type { AuthMode } from '$lib/services/node-settings/types';

export interface WelcomeGateCopy {
	headline: string;
	body: string;
	waitlistCta: string;
	loginCta: string;
	waitlistSuccessHeadline: string;
	waitlistSuccessBody: string;
}

export const DEFAULT_COPY: WelcomeGateCopy = {
	headline: 'NANDA Node — Coming soon',
	body: 'This node is being prepared for launch. Operators and invited participants can sign in now; public access opens shortly.',
	waitlistCta: 'Request access',
	loginCta: 'Sign in',
	waitlistSuccessHeadline: "You're on the list",
	waitlistSuccessBody:
		"Thanks — we've logged your request. You'll receive an invitation by email once access opens."
};

export interface ResolveCopyInput {
	welcomeHeadline?: string | null;
	welcomeBody?: string | null;
	authMode: AuthMode | string;
	waitlistEnabled: boolean;
}

/**
 * Merge DB overrides over defaults. Empty / whitespace-only overrides are
 * ignored so an operator can't accidentally blank out the gate.
 *
 * Mode-aware tweaks:
 *  - `solo`:   body is rewritten to signal "owner-only for now".
 *  - `invite`: body kept as-is unless overridden; waitlist CTA suppressed
 *              at the component level if `waitlistEnabled === false`.
 *  - `open`:   the component short-circuits and never shows the gate,
 *              but we still return sensible copy for completeness.
 */
export function resolveCopy(input: ResolveCopyInput): WelcomeGateCopy {
	const headline =
		input.welcomeHeadline && input.welcomeHeadline.trim().length > 0
			? input.welcomeHeadline.trim()
			: DEFAULT_COPY.headline;

	let body =
		input.welcomeBody && input.welcomeBody.trim().length > 0
			? input.welcomeBody.trim()
			: DEFAULT_COPY.body;

	if (input.authMode === 'solo' && (!input.welcomeBody || input.welcomeBody.trim().length === 0)) {
		body =
			'This node is in single-operator mode. Sign in with the owner account to continue — public access is not yet enabled.';
	}

	return {
		...DEFAULT_COPY,
		headline,
		body
	};
}
