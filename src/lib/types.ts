/**
 * Cloudflare Secrets Store binding OR plain string (miniflare tests).
 * Always unwrap with resolveSecret() before use.
 * @see src/lib/utils/resolve-secret.ts
 */
export type SecretBinding = string | { get: () => Promise<string> };

export interface Env {
	// Storage
	DB: D1Database;
	NANDA_NODE_CACHE: KVNamespace;
	KYM_NANDA_EVIDENCE: R2Bucket;

	// Secrets (from Secrets Store — use resolveSecret() to unwrap)
	KYM_NANDA_HMAC_SECRET: SecretBinding;
	KYM_NANDA_RADIUS_SECRET: SecretBinding;
	KYM_NANDA_ED25519_PRIVATE_KEY_v1?: SecretBinding; // Ed25519 for external VCs (Sprint 3)
	KYM_NANDA_ED25519_PRIVATE_KEY_v2?: SecretBinding; // Rotation slot (Sprint 3)

	// Yanez biometric sign-and-return (opt-in service). Secrets are set on
	// the deployed worker via the dispatch-namespace API (see
	// YANEZ-ONBOARDING-PACKAGE.md). Unused today: PARTNER_ID/KID/PRIVATE_KEY
	// are reserved for the future partner-signed (app_sig) phase; the
	// sign-and-return flow only needs KYM_NANDA_HMAC_SECRET (callback cap).
	YANEZ_PARTNER_ID?: SecretBinding;
	YANEZ_KID?: SecretBinding;
	YANEZ_PARTNER_PRIVATE_KEY_HEX?: SecretBinding;

	// Vars
	ENVIRONMENT: 'development' | 'test' | 'production';
	LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
	NANDA_REGISTRY_URL: string;
	NANDA_ED25519_PUBLIC_KEY_v1: string;
	NANDA_ED25519_PUBLIC_KEY_v2?: string; // Rotation slot
	NANDA_FEDERATION_PEER_URL?: string;
	NANDA_FEDERATION_ADMIN_KEY?: SecretBinding;
	NANDA_NODE_ID?: string; // Federation v2 node identity (Phase 6)
	SENTINEL_API_URL: string;
	VITE_BASE_URL: string;

	// Owner + tenant identity vars (patched into wrangler.jsonc by
	// scripts/setup-cubicube.sh; provisioned per-tenant by Pegasus).
	SITE_NAME?: string;
	SITE_OWNER_EMAIL?: string;
	CONTACT_EMAIL_TO?: string;
	FROM_EMAIL?: string;

	// Configurable service parameters (string env vars, parse at use site — all declared in wrangler.jsonc)
	CERT_VALIDITY_DAYS?: string; // Certificate validity period in days
	CERT_PASS_THRESHOLD?: string; // Certification pass threshold (0.0–1.0 ratio)
	PAYMENT_PAYEE?: string; // Configurable payee for x402-NP
	AUDIT_AMOUNT_TOL?: string; // Audit amount tolerance
	OBSERVER_W_AVAIL?: string; // Observer weight: availability
	OBSERVER_W_PROBE?: string; // Observer weight: probe
	OBSERVER_W_CERT?: string; // Observer weight: certification
	OBSERVER_W_FRAUD?: string; // Observer weight: fraud
	NP_TO_USD_RATE?: string; // NP → USD exchange rate (declared in wrangler.jsonc)
	EUR_TO_USD_RATE?: string; // EUR → USD exchange rate (declared in wrangler.jsonc)
	CORS_ALLOWED_ORIGINS?: string; // Comma-separated origins for production
	NANDA_PROD_ORIGINS?: string; // Comma-separated Nexartis-hosted origins (Nexartis-managed nodes only)
	NANDA_LOOKUP_BASE_URL?: string; // Base URL for federated agent lookup fallback (falls back to NANDA_REGISTRY_URL)
	AGENT_CARD_PROVIDER_URL?: string; // Public provider URL surfaced in /.well-known/agent-card.json
	AGENT_CARD_PROVIDER_ORG?: string; // Organization name surfaced in /.well-known/agent-card.json
	TRUST_FRAMEWORK_GOVERNANCE_URL?: string; // Override for KYM framework governance URL
	AUDIT_MATCH_WINDOW_SEC?: string; // Default: 3600 (P3-6)
	DEFAULT_PROBE_N?: string; // Default: 3 probes per run (P3-6)
	CRON_AUTH_TOKEN?: SecretBinding; // Shared secret for cron self-fetch auth (P3-3)
	TRUST_LOCAL_WEIGHT?: string; // Default: 0.6 — weight for local reputation in cross-registry aggregation (Phase 3)
}

export interface CertJobMessage {
	job_id: string;
	agent_id: string;
	capability: string;
	trial_num: number;
	pass_threshold: number;
}

export interface ProbeJobMessage {
	agent_id: string;
	agent_url: string;
}

export interface WebhookJobMessage {
	subscription_id: string;
	event_type: string; // 'registered' | 'deprecated' | 'degraded' | 'revoked' | 'version_created'
	payload: Record<string, unknown>;
	idempotency_key: string; // nanoid — for dedup
}
