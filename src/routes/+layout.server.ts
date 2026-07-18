import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/roles';
import { createDbClient } from '$lib/db/client';
import { getSettings } from '$lib/services/node-settings';
import { verifyWelcomeAck } from '$lib/server/welcome-ack';
import type { NodeSettingsRecord } from '$lib/db/schema';

// Defaults used when the DB binding is unavailable (pre-migration / preview).
const DEFAULT_SETTINGS: Pick<
	NodeSettingsRecord,
	| 'authMode'
	| 'waitlistEnabled'
	| 'defaultRole'
	| 'welcomeHeadline'
	| 'welcomeBody'
	| 'nodeName'
	| 'brandLogoUrl'
	| 'brandPrimaryColor'
> = {
	authMode: 'solo',
	waitlistEnabled: false,
	defaultRole: 'developer',
	welcomeHeadline: null,
	welcomeBody: null,
	nodeName: null,
	brandLogoUrl: null,
	brandPrimaryColor: null
};

export const load: LayoutServerLoad = async ({ platform, locals, cookies }) => {
	const env = platform!.env;

	// Read settings + welcome_ack in parallel — fall back silently when DB
	// binding is missing (keeps public rendering alive in preview/pre-boot).
	let settings: Partial<NodeSettingsRecord> = DEFAULT_SETTINGS;
	let welcomeAck: { valid: boolean; reason?: string } = { valid: false };

	if (env.DB) {
		try {
			const db = createDbClient(env.DB);
			const [s, ack] = await Promise.all([getSettings(db), verifyWelcomeAck(cookies, env)]);
			settings = s;
			welcomeAck = { valid: ack.valid, reason: ack.payload?.reason };
		} catch {
			/* fall through with defaults */
		}
	}

	return {
		environment: env.ENVIRONMENT,
		registryUrl: env.NANDA_REGISTRY_URL,
		user: locals.user,
		isAdmin: isAdmin(locals.user),
		// When SITE_OWNER_EMAIL is set, /auth hides the "Register" link (single-owner mode).
		// Exposed at the root layout so the auth page survives sentinel SDK clobber of /auth/+page.server.ts.
		isSingleOwner: !!env.SITE_OWNER_EMAIL,
		settings: {
			authMode: (settings.authMode ?? 'solo') as 'solo' | 'invite' | 'open',
			waitlistEnabled: !!settings.waitlistEnabled,
			welcomeHeadline: settings.welcomeHeadline ?? null,
			welcomeBody: settings.welcomeBody ?? null,
			nodeName: settings.nodeName ?? null,
			brandLogoUrl: settings.brandLogoUrl ?? null,
			brandPrimaryColor: settings.brandPrimaryColor ?? null
		},
		welcomeAck
	};
};
