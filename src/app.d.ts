// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

/// <reference types="@cloudflare/workers-types" />

import type { UserLocals } from '@nexartis/sentinel-sdk/core';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Sentinel-owned fields — shape mirrors
			// creatorcube-link-cubestore/cubes/sentinel/src/lib/auth/app-locals.d.ts
			// so declaration-merging stays compatible once that SDK file is
			// installed into src/lib/auth/ by cubes-driver.js.
			user: UserLocals | null;
			accessToken: string | null;
			// Nanda-node-owned field (developer API key auth path).
			apiKey: {
				id: string;
				tier: string;
				scopes: string[] | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				// Storage
				DB: D1Database;
				NANDA_NODE_CACHE: KVNamespace;
				KYM_NANDA_EVIDENCE: R2Bucket;

				// Secrets (from Secrets Store — use resolveSecret() to unwrap)
				KYM_NANDA_HMAC_SECRET: string | { get: () => Promise<string> };
				KYM_NANDA_RADIUS_SECRET: string | { get: () => Promise<string> };
				KYM_NANDA_ED25519_PRIVATE_KEY_v1?: string | { get: () => Promise<string> };
				KYM_NANDA_ED25519_PRIVATE_KEY_v2?: string | { get: () => Promise<string> };

				// Yanez biometric sign-and-return (opt-in). Set on the worker via
				// the dispatch-namespace secrets API. PARTNER_ID/KID/PRIVATE_KEY are
				// reserved for the future partner-signed phase; sign-and-return only
				// needs KYM_NANDA_HMAC_SECRET.
				YANEZ_PARTNER_ID?: string | { get: () => Promise<string> };
				YANEZ_KID?: string | { get: () => Promise<string> };
				YANEZ_PARTNER_PRIVATE_KEY_HEX?: string | { get: () => Promise<string> };

				// Vars
				ENVIRONMENT: 'development' | 'test' | 'production';
				LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
				NANDA_REGISTRY_URL: string;
				NANDA_ED25519_PUBLIC_KEY_v1: string;
				NANDA_ED25519_PUBLIC_KEY_v2?: string;
				NANDA_FEDERATION_PEER_URL?: string;
				NANDA_FEDERATION_ADMIN_KEY?: string | { get: () => Promise<string> };
				NANDA_NODE_ID?: string; // Federation v2 node identity (Phase 6)

				// Auth (Sentinel)
				SENTINEL_API_URL: string;
				SENTINEL_POST_AUTH_REDIRECT?: string;
				VITE_BASE_URL: string;

				// Site owner (Pegasus deployments — restricts admin login)
				SITE_OWNER_EMAIL?: string;
				SITE_NAME?: string; // Owner's display name
				CONTACT_EMAIL_TO?: string;
				FROM_EMAIL?: string;
				NODE_ENV?: string;

				// Operator notifications (Phase 2 — Resend)
				RESEND_API_KEY?: string | { get: () => Promise<string> };

				// Cron (P3-3)
				CRON_AUTH_TOKEN?: string | { get: () => Promise<string> };

				// Configurable service parameters (string env vars, parsed at use site)
				CERT_VALIDITY_DAYS?: string;
				CERT_PASS_THRESHOLD?: string;
				AUDIT_AMOUNT_TOL?: string;
				OBSERVER_W_AVAIL?: string;
				OBSERVER_W_PROBE?: string;
				OBSERVER_W_CERT?: string;
				OBSERVER_W_FRAUD?: string;
				PAYMENT_PAYEE?: string;
				CORS_ALLOWED_ORIGINS?: string;
				NANDA_PROD_ORIGINS?: string;
				NANDA_LOOKUP_BASE_URL?: string;
				AGENT_CARD_PROVIDER_URL?: string;
				AGENT_CARD_PROVIDER_ORG?: string;
				TRUST_FRAMEWORK_GOVERNANCE_URL?: string;
				AUDIT_MATCH_WINDOW_SEC?: string;
				DEFAULT_PROBE_N?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
