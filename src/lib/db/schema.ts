/**
 * Drizzle ORM Schema — nexartis-nanda-node
 *
 * Single source of truth for all 53 database tables across 21 domains.
 * Baseline migration: drizzle/migrations/0000_baseline.sql
 *
 * Domains: Registry (3), Certifier (4), Compliance (3), Observer (3), Auditor (4),
 *   Developer Keys (1), Trust (3), Trust Framework (2), Webhooks (1), Versioning (1),
 *   UCP (1), Billing (2), Revenue Sharing (3), Multi-Currency (1),
 *   Subscriptions (2), Invoices (2), Lean Index (1), Resolver (2),
 *   Federation v2 (3), Orchestration (9), Site Visitors (1)
 */

import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
	primaryKey
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ===================================================================
// REGISTRY DOMAIN (3 tables)
// ===================================================================

export const agentFacts = sqliteTable(
	'agent_facts',
	{
		agentId: text('agent_id')
			.primaryKey()
			.references(() => agentAddrs.agentId),
		factsJson: text('facts_json').notNull(), // Complete AgentFacts v1 JSON blob
		agentName: text('agent_name'), // urn:agent:nanda:USERNAME
		providerDid: text('provider_did'), // did:web:...
		jurisdiction: text('jurisdiction'), // e.g. "USA"
		certLevel: text('cert_level'), // development | staging | production
		schemaVersion: text('schema_version').default('1.0.0'),
		fetchedAt: integer('fetched_at').default(sql`(unixepoch())`),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`),
		// ── AgentFacts v2 columns (P6 — migration 0013) ──
		trustScore: real('trust_score'),
		complianceStatus: text('compliance_status'),
		complianceCheckedAt: text('compliance_checked_at'),
		vcJson: text('vc_json'),
		vcIssuedAt: integer('vc_issued_at'),
		vcExpiresAt: integer('vc_expires_at'),
		disclosurePolicy: text('disclosure_policy').default('public')
	},
	(table) => ({
		nameIdx: index('idx_af_name').on(table.agentName),
		jurisdictionIdx: index('idx_af_jurisdiction').on(table.jurisdiction)
	})
);

export const clients = sqliteTable('clients', {
	clientId: text('client_id').primaryKey(),
	assignedAgentId: text('assigned_agent_id').references(() => agentAddrs.agentId),
	createdAt: integer('created_at').default(sql`(unixepoch())`)
});

// ===================================================================
// CERTIFIER DOMAIN (4 tables)
// ===================================================================

export const certJobs = sqliteTable('cert_jobs', {
	jobId: text('job_id').primaryKey(),
	agentId: text('agent_id').notNull(),
	capability: text('capability').notNull(),
	status: text('status').default('pending'), // pending | running | complete | failed
	numTrials: integer('num_trials').default(5),
	completedTrials: integer('completed_trials').default(0),
	passThreshold: real('pass_threshold').default(0.8),
	score: real('score'),
	grade: text('grade'),
	createdAt: integer('created_at').default(sql`(unixepoch())`),
	updatedAt: integer('updated_at').default(sql`(unixepoch())`)
});

export const trialResults = sqliteTable(
	'trial_results',
	{
		id: text('id').primaryKey(),
		jobId: text('job_id')
			.notNull()
			.references(() => certJobs.jobId),
		trialNum: integer('trial_num').notNull(),
		topic: text('topic').default('general'),
		prompt: text('prompt').notNull(),
		expected: text('expected').notNull(),
		actual: text('actual'),
		score: real('score'),
		passed: integer('passed'), // 0 or 1
		latencyMs: integer('latency_ms'),
		evidenceR2Key: text('evidence_r2_key'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		jobTrialIdx: uniqueIndex('idx_trial_results_job_trial').on(table.jobId, table.trialNum)
	})
);

export const certificates = sqliteTable('certificates', {
	certId: text('cert_id').primaryKey(),
	agentId: text('agent_id').notNull(),
	capability: text('capability').notNull(),
	score: real('score').notNull(),
	grade: text('grade').notNull(),
	ci95Lo: real('ci95_lo'),
	ci95Hi: real('ci95_hi'),
	nTrials: integer('n_trials').notNull(),
	hmacSignature: text('hmac_signature').notNull(),
	ed25519Vc: text('ed25519_vc'),
	evidenceUri: text('evidence_uri'),
	issuedAt: integer('issued_at').default(sql`(unixepoch())`),
	expiresAt: integer('expires_at')
});

export const certRevocations = sqliteTable(
	'cert_revocations',
	{
		certId: text('cert_id')
			.primaryKey()
			.references(() => certificates.certId),
		reason: text('reason').notNull(),
		statusListIndex: integer('status_list_index'),
		revokedAt: integer('revoked_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		statusListIdx: uniqueIndex('idx_cert_rev_status_list_index').on(table.statusListIndex)
	})
);

// ===================================================================
// COMPLIANCE DOMAIN (3 tables)
// ===================================================================

export const compliancePolicies = sqliteTable('compliance_policies', {
	policyId: text('policy_id').primaryKey(),
	rulesJson: text('rules_json').notNull(), // JSON: region_pairs_allow, capability_allowlist, etc.
	version: integer('version').default(1),
	createdAt: integer('created_at').default(sql`(unixepoch())`),
	updatedAt: integer('updated_at').default(sql`(unixepoch())`)
});

export const complianceDecisions = sqliteTable(
	'compliance_decisions',
	{
		decisionId: text('decision_id').primaryKey(),
		envelopeHash: text('envelope_hash').notNull(),
		fromAgent: text('from_agent'),
		toAgent: text('to_agent'),
		capability: text('capability'),
		decision: text('decision').notNull(), // ALLOW | DENY | ESCALATE | ALLOW_WITH_REDACTION
		reasons: text('reasons'), // JSON array
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentsIdx: index('idx_cd_agents').on(table.fromAgent, table.toAgent)
	})
);

export const complianceViolations = sqliteTable(
	'compliance_violations',
	{
		violationId: text('violation_id').primaryKey(),
		agentId: text('agent_id').notNull(),
		envelopeHash: text('envelope_hash'),
		reason: text('reason').notNull(),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_cv_agent').on(table.agentId)
	})
);

// ===================================================================
// OBSERVER DOMAIN (3 tables)
// ===================================================================

export const telemetryEvents = sqliteTable(
	'telemetry_events',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		latencyMs: integer('latency_ms'),
		success: integer('success'), // 0 or 1
		statusCode: integer('status_code'),
		fraudFlag: integer('fraud_flag').default(0), // 0 or 1
		note: text('note'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_te_agent').on(table.agentId, table.createdAt)
	})
);

export const probeRuns = sqliteTable(
	'probe_runs',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		endpoint: text('endpoint'),
		capability: text('capability'),
		probesSent: integer('probes_sent'),
		successCount: integer('success_count'),
		p95LatencyMs: integer('p95_latency_ms'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_pr_agent').on(table.agentId, table.createdAt)
	})
);

export const reputationSnapshots = sqliteTable(
	'reputation_snapshots',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		availability: real('availability'),
		errorRate: real('error_rate'),
		fraudRate: real('fraud_rate'),
		p95LatencyMs: integer('p95_latency_ms'),
		probeSuccess: real('probe_success'),
		certScore: real('cert_score'),
		reputation: real('reputation'), // computed score
		actions: text('actions'), // JSON array: e.g. ["recert","warn"]
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_rs_agent').on(table.agentId, table.createdAt)
	})
);

// ===================================================================
// AUDITOR DOMAIN (4 tables)
// ===================================================================

export const auditIntents = sqliteTable(
	'audit_intents',
	{
		intentId: text('intent_id').primaryKey(),
		payer: text('payer').notNull(),
		payee: text('payee').notNull(),
		amount: integer('amount').notNull(), // minor units (NP)
		memo: text('memo'),
		nonce: text('nonce'),
		windowSec: integer('window_sec').default(3600),
		status: text('status').default('open'), // open | settled | partial | mismatch | expired
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		expiresAt: integer('expires_at')
	},
	(table) => ({
		payerIdx: index('idx_ai_payer').on(table.payer, table.status)
	})
);

export const auditSettlements = sqliteTable('audit_settlements', {
	settlementId: text('settlement_id').primaryKey(),
	txHash: text('tx_hash').notNull(),
	frm: text('frm').notNull(), // "from" is reserved word
	toAgent: text('to_agent').notNull(),
	amount: integer('amount').notNull(),
	ts: integer('ts').notNull(),
	sig: text('sig'),
	verified: integer('verified').default(0), // 0 or 1
	createdAt: integer('created_at').default(sql`(unixepoch())`)
});

export const auditReconciliations = sqliteTable('audit_reconciliations', {
	reconId: text('recon_id').primaryKey(),
	intentId: text('intent_id').references(() => auditIntents.intentId),
	txHash: text('tx_hash'),
	verdict: text('verdict').notNull(), // settled | partial | mismatch | no_show
	delta: integer('delta'),
	latencyMs: integer('latency_ms'),
	balances: text('balances'), // JSON: {payer_balance, payee_balance}
	createdAt: integer('created_at').default(sql`(unixepoch())`)
});

export const auditWallets = sqliteTable(
	'audit_wallets',
	{
		agentName: text('agent_name').notNull(),
		balanceMinor: integer('balance_minor').default(0), // NP minor units
		currency: text('currency').notNull().default('NP'),
		scale: integer('scale').default(0),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		pk: primaryKey({ columns: [table.agentName, table.currency] })
	})
);

// ===================================================================
// DEVELOPER KEYS DOMAIN (1 table)
// ===================================================================

export const developerKeys = sqliteTable(
	'developer_keys',
	{
		id: text('id').primaryKey(), // nanoid
		keyHash: text('key_hash').notNull(), // SHA-256 hash of the raw API key
		keyPrefix: text('key_prefix').notNull(), // First 12 chars for identification (e.g., "nanda_abc1...")
		name: text('name').notNull(), // Developer-friendly label
		ownerId: text('owner_id').notNull(), // Sentinel user ID
		ownerEmail: text('owner_email'), // For display purposes
		status: text('status').notNull().default('active'), // 'active' | 'revoked'
		tier: text('tier').notNull().default('free'), // 'free' | 'pro' | 'enterprise'
		rateLimitMonthly: integer('rate_limit_monthly').notNull().default(1000), // Max API calls per month
		scopes: text('scopes'), // JSON array of allowed scopes (null = all)
		lastUsedAt: integer('last_used_at'), // Unix timestamp
		usageCountMonthly: integer('usage_count_monthly').notNull().default(0), // Current month usage
		usageResetAt: integer('usage_reset_at'), // Unix timestamp — when to reset monthly count
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		revokedAt: integer('revoked_at'), // Unix timestamp
		expiresAt: integer('expires_at') // Optional expiration (Unix timestamp)
	},
	(table) => ({
		keyHashIdx: uniqueIndex('idx_dev_keys_key_hash').on(table.keyHash),
		ownerIdx: index('idx_dev_keys_owner').on(table.ownerId),
		statusIdx: index('idx_dev_keys_status').on(table.status),
		prefixIdx: index('idx_dev_keys_prefix').on(table.keyPrefix)
	})
);

// ===================================================================
// CROSS-REGISTRY TRUST DOMAIN (Phase 3 — Agent Alpha)
// ===================================================================

/** Trust/reputation data fetched from federation peer registries */
export const federationTrustScores = sqliteTable(
	'federation_trust_scores',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		peerUrl: text('peer_url').notNull(),
		reputation: real('reputation'),
		availability: real('availability'),
		probeSuccess: real('probe_success'),
		certScore: real('cert_score'),
		fraudRate: real('fraud_rate'),
		badgeTier: text('badge_tier').default('none'),
		fetchedAt: integer('fetched_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_fts_agent').on(table.agentId),
		agentPeerUnique: uniqueIndex('idx_fts_agent_peer').on(table.agentId, table.peerUrl)
	})
);

/** Aggregated local + federated scores with confidence metrics */
export const crossRegistryScores = sqliteTable(
	'cross_registry_scores',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull().unique(),
		localReputation: real('local_reputation'),
		federatedReputation: real('federated_reputation'),
		combinedReputation: real('combined_reputation'),
		peerCount: integer('peer_count').default(0),
		confidence: real('confidence').default(0),
		badgeTier: text('badge_tier').default('none'),
		computedAt: integer('computed_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_crs_agent').on(table.agentId)
	})
);

// ===================================================================
// BEHAVIOR ANALYTICS DOMAIN (Phase 3 — Agent Beta)
// ===================================================================

/** Periodic aggregated behavior metrics per agent (daily / weekly) */
export const agentBehaviorMetrics = sqliteTable(
	'agent_behavior_metrics',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		periodStart: integer('period_start').notNull(),
		periodEnd: integer('period_end').notNull(),
		periodType: text('period_type').notNull().default('daily'), // 'daily' | 'weekly'
		uptimePct: real('uptime_pct'),
		avgResponseMs: real('avg_response_ms'),
		p95ResponseMs: integer('p95_response_ms'),
		successRate: real('success_rate'),
		totalRequests: integer('total_requests').default(0),
		errorCount: integer('error_count').default(0),
		paymentReliability: real('payment_reliability'),
		reputationScore: real('reputation_score'),
		badgeTier: text('badge_tier'),
		computedAt: integer('computed_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentPeriodIdx: index('idx_abm_agent_period').on(
			table.agentId,
			table.periodType,
			table.periodStart
		),
		periodTypeIdx: index('idx_abm_period_type').on(table.periodType, table.periodStart)
	})
);

/** Compliance scan run results — periodic policy re-evaluation */
export const complianceScanRuns = sqliteTable(
	'compliance_scan_runs',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		policyId: text('policy_id').notNull(),
		decision: text('decision').notNull(), // 'ALLOW' | 'DENY' | 'ESCALATE'
		reasons: text('reasons'), // JSON array
		scanType: text('scan_type').default('scheduled'), // 'scheduled' | 'manual'
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentCreatedIdx: index('idx_csr_agent_created').on(table.agentId, table.createdAt),
		decisionIdx: index('idx_csr_decision').on(table.decision)
	})
);

// ===================================================================
// TRUST FRAMEWORK DOMAIN (Phase 3 — Agent Gamma)
// ===================================================================

/** Trust framework metadata — DIF/ToIP alignment records */
export const trustFrameworkMeta = sqliteTable('trust_framework_meta', {
	id: text('id').primaryKey(),
	frameworkId: text('framework_id').notNull().unique(),
	name: text('name').notNull(),
	version: text('version').notNull(),
	governanceUrl: text('governance_url'),
	alignment: text('alignment'), // e.g. 'toip-tswg', 'dif-trust-graph'
	createdAt: integer('created_at').default(sql`(unixepoch())`)
});

/** Trust graph edges — directed trust relationships between DIDs */
export const trustGraphEdges = sqliteTable(
	'trust_graph_edges',
	{
		id: text('id').primaryKey(),
		fromDid: text('from_did').notNull(),
		toDid: text('to_did').notNull(),
		relationship: text('relationship').notNull(), // 'issuer', 'verifier', 'peer', 'endorser'
		trustLevel: real('trust_level').default(0), // 0.0–1.0
		evidenceUri: text('evidence_uri'),
		frameworkId: text('framework_id'),
		validFrom: integer('valid_from'),
		validUntil: integer('valid_until'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		fromDidIdx: index('idx_tge_from').on(table.fromDid),
		toDidIdx: index('idx_tge_to').on(table.toDid),
		uniqueEdge: uniqueIndex('idx_tge_unique_edge').on(
			table.fromDid,
			table.toDid,
			table.relationship
		)
	})
);

// ===================================================================
// AGENT VERSIONING DOMAIN (Phase 4 — Agent Alpha)
// ===================================================================

/** Version history for agents — tracks each published version */
export const agentVersions = sqliteTable(
	'agent_versions',
	{
		id: text('id').primaryKey(), // nanoid
		agentId: text('agent_id').notNull(), // base agent ID (without version)
		version: text('version').notNull(), // semver string
		agentUrl: text('agent_url').notNull(),
		apiUrl: text('api_url'),
		factsUrl: text('facts_url'),
		capabilities: text('capabilities'), // JSON array
		changelog: text('changelog'), // What changed in this version
		status: text('status').default('alive'), // alive | deprecated | tombstoned
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		deprecatedAt: integer('deprecated_at'),
		sunsetAt: integer('sunset_at')
	},
	(table) => ({
		agentVersionIdx: uniqueIndex('idx_av_agent_version').on(table.agentId, table.version),
		agentStatusIdx: index('idx_av_agent_status').on(table.agentId, table.status)
	})
);

/** Webhook subscriptions — event notification callbacks (Phase 4 — Beta builds service on top) */
export const webhookSubscriptions = sqliteTable(
	'webhook_subscriptions',
	{
		id: text('id').primaryKey(), // nanoid
		callbackUrl: text('callback_url').notNull(),
		events: text('events').notNull(), // JSON array: ['registered','deprecated','degraded','revoked']
		secret: text('secret').notNull(), // HMAC-SHA256 signing secret
		ownerId: text('owner_id'), // API key owner ID
		status: text('status').default('active'), // active | paused | disabled
		failureCount: integer('failure_count').default(0),
		lastDeliveredAt: integer('last_delivered_at'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		ownerIdx: index('idx_ws_owner').on(table.ownerId),
		statusIdx: index('idx_ws_status').on(table.status)
	})
);

// ===================================================================
// UCP DOMAIN (Phase 5 — Agent Alpha)
// ===================================================================

/** UCP checkout sessions — stateful purchase flow per UCP spec v2026-01-11 */
export const ucpCheckoutSessions = sqliteTable(
	'ucp_checkout_sessions',
	{
		id: text('id').primaryKey(),
		status: text('status').notNull().default('open'),
		clientAgentId: text('client_agent_id'),
		ownerId: text('owner_id'), // Sentinel user id of the creator (Lane C ownership)
		lineItems: text('line_items').notNull(), // JSON array of UcpCheckoutLineItem
		totals: text('totals').notNull(), // JSON: { subtotal, discount, tax, total, currency }
		payment: text('payment'), // JSON: { method, status, provider_ref, amount, currency }
		metadata: text('metadata'), // JSON: arbitrary metadata
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`),
		expiresAt: integer('expires_at') // Session TTL
	},
	(table) => ({
		statusIdx: index('idx_ucp_cs_status').on(table.status),
		clientIdx: index('idx_ucp_cs_client').on(table.clientAgentId),
		ownerIdx: index('idx_ucp_cs_owner').on(table.ownerId)
	})
);

// ===================================================================
// CURRENCY DOMAIN (Phase 5 — Agent Alpha)
// ===================================================================

/** Currency registry — supported currencies with chain/contract metadata */
export const currencies = sqliteTable('currencies', {
	symbol: text('symbol').primaryKey(),
	name: text('name').notNull(),
	decimals: integer('decimals').notNull().default(6),
	chain: text('chain'),
	contractAddress: text('contract_address'),
	active: integer('active').notNull().default(1),
	category: text('category').notNull().default('stablecoin'),
	createdAt: integer('created_at').default(sql`(unixepoch())`)
});

// ===================================================================
// BILLING DOMAIN (Phase 5 — Agent Bravo)
// ===================================================================

/** Monthly billing periods for metered API usage per developer key */
export const billingPeriods = sqliteTable(
	'billing_periods',
	{
		id: text('id').primaryKey(),
		keyId: text('key_id').notNull(),
		tier: text('tier').notNull().default('free'),
		periodStart: integer('period_start').notNull(),
		periodEnd: integer('period_end').notNull(),
		totalCalls: integer('total_calls').notNull().default(0),
		includedCalls: integer('included_calls').notNull().default(1000),
		overageCalls: integer('overage_calls').notNull().default(0),
		overageChargeNp: integer('overage_charge_np').notNull().default(0),
		status: text('status').notNull().default('open'),
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		closedAt: integer('closed_at')
	},
	(table) => ({
		keyIdx: index('idx_bp_key').on(table.keyId),
		statusIdx: index('idx_bp_status').on(table.status),
		keyPeriodUnique: uniqueIndex('idx_bp_key_period').on(table.keyId, table.periodStart)
	})
);

/** Line items within a billing period (overage charges, credits, adjustments) */
export const billingLineItems = sqliteTable(
	'billing_line_items',
	{
		id: text('id').primaryKey(),
		periodId: text('period_id')
			.notNull()
			.references(() => billingPeriods.id),
		description: text('description').notNull(),
		quantity: integer('quantity').notNull().default(0),
		unitPriceNp: real('unit_price_np').notNull().default(0),
		totalNp: integer('total_np').notNull().default(0),
		category: text('category').notNull().default('overage'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		periodIdx: index('idx_bli_period').on(table.periodId)
	})
);

// ===================================================================
// SUBSCRIPTION DOMAIN (Phase 5 — Agent Charlie)
// ===================================================================

export const subscriptions = sqliteTable(
	'subscriptions',
	{
		id: text('id').primaryKey(),
		keyId: text('key_id').notNull(),
		ownerId: text('owner_id'), // Sentinel user id of the creator (Lane C ownership)
		plan: text('plan').notNull().default('starter'),
		status: text('status').notNull().default('active'),
		periodStart: integer('period_start').notNull(),
		periodEnd: integer('period_end').notNull(),
		autoRenew: integer('auto_renew').notNull().default(1),
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		cancelledAt: integer('cancelled_at')
	},
	(table) => ({
		keyIdx: index('idx_sub_key').on(table.keyId),
		statusIdx: index('idx_sub_status').on(table.status),
		ownerIdx: index('idx_sub_owner').on(table.ownerId)
	})
);

export const subscriptionEvents = sqliteTable(
	'subscription_events',
	{
		id: text('id').primaryKey(),
		subscriptionId: text('subscription_id')
			.notNull()
			.references(() => subscriptions.id),
		eventType: text('event_type').notNull(),
		fromPlan: text('from_plan'),
		toPlan: text('to_plan'),
		metadata: text('metadata'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		subIdx: index('idx_se_sub').on(table.subscriptionId)
	})
);

// ===================================================================
// INVOICE DOMAIN (Phase 5 — Agent Charlie)
// ===================================================================

export const invoices = sqliteTable(
	'invoices',
	{
		id: text('id').primaryKey(),
		invoiceNumber: text('invoice_number').notNull().unique(),
		periodId: text('period_id').references(() => billingPeriods.id),
		keyId: text('key_id').notNull(),
		subscriptionId: text('subscription_id'),
		lineItems: text('line_items').notNull(),
		subtotalNp: integer('subtotal_np').notNull().default(0),
		totalNp: integer('total_np').notNull().default(0),
		totalUsdEquivalent: real('total_usd_equivalent'),
		currency: text('currency').notNull().default('NP'),
		status: text('status').notNull().default('draft'),
		issuedAt: integer('issued_at'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		keyIdx: index('idx_inv_key').on(table.keyId),
		periodIdx: index('idx_inv_period').on(table.periodId)
	})
);

export const invoiceSequence = sqliteTable('invoice_sequence', {
	year: integer('year').primaryKey(),
	nextNumber: integer('next_number').notNull().default(1)
});

// ===================================================================
// REVENUE SHARING DOMAIN (Phase 5 — Agent Bravo)
// ===================================================================

/** Revenue split configuration — how revenue from an agent is shared with its developer */
export const revenueSplits = sqliteTable(
	'revenue_splits',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		developerId: text('developer_id').notNull(),
		splitPct: integer('split_pct').notNull().default(70),
		effectiveFrom: integer('effective_from').notNull(),
		effectiveTo: integer('effective_to'),
		status: text('status').notNull().default('active'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_revsplit_agent').on(table.agentId),
		developerIdx: index('idx_revsplit_developer').on(table.developerId),
		agentDevUnique: uniqueIndex('idx_revsplit_agent_dev').on(
			table.agentId,
			table.developerId,
			table.effectiveFrom
		)
	})
);

/** Computed revenue share per billing period per split */
export const revenueShares = sqliteTable(
	'revenue_shares',
	{
		id: text('id').primaryKey(),
		splitId: text('split_id')
			.notNull()
			.references(() => revenueSplits.id),
		periodId: text('period_id')
			.notNull()
			.references(() => billingPeriods.id),
		grossRevenueNp: integer('gross_revenue_np').notNull().default(0),
		developerShareNp: integer('developer_share_np').notNull().default(0),
		platformShareNp: integer('platform_share_np').notNull().default(0),
		status: text('status').notNull().default('pending'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		splitIdx: index('idx_rsh_split').on(table.splitId),
		periodIdx: index('idx_rsh_period').on(table.periodId),
		statusIdx: index('idx_rsh_status').on(table.status)
	})
);

/** Settlement records — aggregate payout to a developer */
export const revenueSettlements = sqliteTable(
	'revenue_settlements',
	{
		id: text('id').primaryKey(),
		developerId: text('developer_id').notNull(),
		totalNp: integer('total_np').notNull().default(0),
		sharesCount: integer('shares_count').notNull().default(0),
		status: text('status').notNull().default('pending'),
		settledAt: integer('settled_at'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		developerIdx: index('idx_rse_developer').on(table.developerId),
		statusIdx: index('idx_rse_status').on(table.status)
	})
);

// ===================================================================
// RESOLVER (P6 — Agent California)
// ===================================================================

/** Resolution request audit trail — analytics for adaptive resolution */
export const resolutionLog = sqliteTable(
	'resolution_log',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		requesterId: text('requester_id'),
		strategy: text('strategy').notNull().default('static'),
		contextJson: text('context_json'),
		resultJson: text('result_json'),
		latencyMs: integer('latency_ms'),
		cacheHit: integer('cache_hit').default(0),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		agentIdx: index('idx_rl_agent').on(table.agentId, table.createdAt),
		strategyIdx: index('idx_rl_strategy').on(table.strategy)
	})
);

/** Registered protocol adapters — tracks detected protocols per agent */
export const protocolAdapters = sqliteTable(
	'protocol_adapters',
	{
		id: text('id').primaryKey(),
		agentId: text('agent_id').notNull(),
		protocol: text('protocol').notNull(),
		detectedAt: integer('detected_at').default(sql`(unixepoch())`),
		metadataJson: text('metadata_json'),
		lastSyncedAt: integer('last_synced_at')
	},
	(table) => ({
		agentIdx: index('idx_pa_agent').on(table.agentId),
		protocolIdx: index('idx_pa_protocol').on(table.protocol)
	})
);

// ===================================================================
// FEDERATION v2 DOMAIN (Phase 6 — Agent Hawaii)
// ===================================================================

/** Known federation peers with health tracking */
export const federationPeers = sqliteTable(
	'federation_peers',
	{
		peerId: text('peer_id').primaryKey(),
		peerUrl: text('peer_url').notNull(),
		nodeId: text('node_id').notNull(),
		status: text('status').notNull().default('active'), // active | degraded | offline
		lastSyncAt: integer('last_sync_at'),
		lastGossipAt: integer('last_gossip_at'),
		vectorClock: text('vector_clock').default('{}'), // JSON: Record<string, number>
		failureCount: integer('failure_count').default(0),
		capabilities: text('capabilities').default('[]'), // JSON array
		quiltTypes: text('quilt_types').default('["native"]'), // JSON array
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		statusIdx: index('idx_fp_status').on(table.status),
		nodeIdx: index('idx_fp_node').on(table.nodeId)
	})
);

/** Gossip exchange log for audit and debugging */
export const gossipLog = sqliteTable(
	'gossip_log',
	{
		id: text('id').primaryKey(),
		peerId: text('peer_id').notNull(),
		direction: text('direction').notNull().default('inbound'), // inbound | outbound
		messageJson: text('message_json').notNull(),
		deltasCount: integer('deltas_count').default(0),
		accepted: integer('accepted').default(0),
		rejected: integer('rejected').default(0),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		peerIdx: index('idx_gl_peer').on(table.peerId, table.createdAt),
		directionIdx: index('idx_gl_direction').on(table.direction, table.createdAt)
	})
);

/** Quilt routes — prefix-based routing to federation peers */
export const quiltRoutes = sqliteTable(
	'quilt_routes',
	{
		id: text('id').primaryKey(),
		prefix: text('prefix').notNull(),
		quiltType: text('quilt_type').notNull(),
		peerId: text('peer_id').notNull(),
		priority: integer('priority').default(0),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		prefixPeerUnique: uniqueIndex('idx_qr_prefix_peer').on(table.prefix, table.peerId),
		quiltTypeIdx: index('idx_qr_quilt_type').on(table.quiltType)
	})
);

// ===================================================================
// LEAN INDEX DOMAIN (Phase 6 — Agent Bali)
// ===================================================================

/**
 * AgentAddr records — the single source of truth for all agent data.
 * Ed25519-signed pointers from agent_id → AgentFacts URL.
 * Local registrations, federated agents (CRDT gossip), and external
 * registry imports all live in this table.
 */
export const agentAddrs = sqliteTable(
	'agent_addrs',
	{
		agentId: text('agent_id').primaryKey(),
		publicKeyHex: text('public_key_hex').notNull(),
		factsUrl: text('facts_url'), // nullable — local registrations may not have AgentFacts
		privateUrl: text('private_url'),
		resolverUrl: text('resolver_url'),
		ttlSeconds: integer('ttl_seconds').notNull().default(300),
		signatureHex: text('signature_hex').notNull(),
		signerId: text('signer_id').notNull(),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at')
			.notNull()
			.default(sql`(unixepoch())`),
		expiresAt: integer('expires_at'),
		source: text('source').notNull().default('local'),
		quiltType: text('quilt_type').notNull().default('native'),
		contentId: text('content_id'),
		// ── Agent registry columns (unified from former `agents` table) ──
		agentUrl: text('agent_url'), // Full agent URL
		apiUrl: text('api_url'), // API URL
		capabilities: text('capabilities'), // JSON array of capabilities
		tags: text('tags'), // JSON array of tags
		status: text('status').default('alive'), // alive | dead
		version: text('version').default('1.0.0'), // semver
		deprecatedAt: integer('deprecated_at'), // Unix timestamp when deprecated
		sunsetAt: integer('sunset_at'), // Unix timestamp for final removal
		registeredAt: integer('registered_at').default(sql`(unixepoch())`),
		visibility: text('visibility').notNull().default('public'),
		capabilityManifest: text('capability_manifest'),
		mcpMetadata: text('mcp_metadata'),
		pricing: text('pricing')
	},
	(table) => ({
		sourceIdx: index('idx_agent_addrs_source').on(table.source),
		quiltIdx: index('idx_agent_addrs_quilt').on(table.quiltType),
		expiresIdx: index('idx_agent_addrs_expires').on(table.expiresAt),
		signerIdx: index('idx_agent_addrs_signer').on(table.signerId),
		statusIdx: index('idx_agent_addrs_status').on(table.status),
		visibilityIdx: index('idx_agent_addrs_visibility').on(table.visibility)
	})
);

// ===================================================================
// ORCHESTRATION DOMAIN (Phase 6 — Sprint 13: Multi-Agent Orchestration)
// ===================================================================

/** Workflow definitions — DAG blueprints for multi-agent orchestration */
export const workflows = sqliteTable(
	'workflows',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		ownerId: text('owner_id').notNull(),
		dagJson: text('dag_json').notNull().default('{"nodes":[],"edges":[]}'),
		status: text('status').notNull().default('draft'), // draft | active | archived
		version: integer('version').notNull().default(1),
		templateId: text('template_id'),
		metadata: text('metadata').default('{}'),
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		ownerIdx: index('idx_wf_owner').on(table.ownerId),
		statusIdx: index('idx_wf_status').on(table.status),
		templateIdx: index('idx_wf_template').on(table.templateId)
	})
);

/** Workflow steps — individual nodes in the DAG */
export const workflowSteps = sqliteTable(
	'workflow_steps',
	{
		id: text('id').primaryKey(),
		workflowId: text('workflow_id')
			.notNull()
			.references(() => workflows.id),
		stepType: text('step_type').notNull().default('agent_call'), // agent_call | condition | transform | parallel | wait
		agentId: text('agent_id'),
		action: text('action'),
		configJson: text('config_json').default('{}'),
		positionX: real('position_x').default(0),
		positionY: real('position_y').default(0),
		dependsOn: text('depends_on').default('[]'), // JSON array of step IDs
		timeoutMs: integer('timeout_ms').default(30000),
		retryCount: integer('retry_count').default(0),
		retryDelayMs: integer('retry_delay_ms').default(1000),
		conditionJson: text('condition_json'), // conditional branching logic
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		workflowIdx: index('idx_ws_workflow').on(table.workflowId),
		agentIdx: index('idx_ws_agent').on(table.agentId)
	})
);

/** Workflow runs — execution instances of a workflow */
export const workflowRuns = sqliteTable(
	'workflow_runs',
	{
		id: text('id').primaryKey(),
		workflowId: text('workflow_id')
			.notNull()
			.references(() => workflows.id),
		status: text('status').notNull().default('pending'), // pending | running | completed | failed | cancelled
		triggerType: text('trigger_type').notNull().default('manual'), // manual | scheduled | webhook | a2a
		inputJson: text('input_json').default('{}'),
		outputJson: text('output_json'),
		errorMessage: text('error_message'),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		workflowIdx: index('idx_wr_workflow').on(table.workflowId, table.createdAt),
		statusIdx: index('idx_wr_status').on(table.status)
	})
);

/** Workflow step runs — per-step execution within a workflow run */
export const workflowStepRuns = sqliteTable(
	'workflow_step_runs',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => workflowRuns.id),
		stepId: text('step_id')
			.notNull()
			.references(() => workflowSteps.id),
		status: text('status').notNull().default('pending'), // pending | running | completed | failed | skipped
		inputJson: text('input_json'),
		outputJson: text('output_json'),
		errorMessage: text('error_message'),
		attempt: integer('attempt').default(1),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		durationMs: integer('duration_ms'),
		delegatedTo: text('delegated_to'), // agent_id if sub-delegated
		createdAt: integer('created_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		runIdx: index('idx_wsr_run').on(table.runId),
		stepIdx: index('idx_wsr_step').on(table.stepId),
		statusIdx: index('idx_wsr_status').on(table.status)
	})
);

/** Orchestrator patterns — reusable workflow templates */
export const orchestratorPatterns = sqliteTable(
	'orchestrator_patterns',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		category: text('category').notNull().default('general'), // general | review | approval | pipeline | monitoring
		dagTemplateJson: text('dag_template_json').notNull(),
		inputSchemaJson: text('input_schema_json'),
		tags: text('tags').default('[]'), // JSON array
		usageCount: integer('usage_count').default(0),
		isBuiltin: integer('is_builtin').default(0), // 0 = user-created, 1 = system template
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		categoryIdx: index('idx_op_category').on(table.category),
		builtinIdx: index('idx_op_builtin').on(table.isBuiltin)
	})
);

// ===================================================================
// Type Exports (inferred from schema)
// ===================================================================

export type AgentFact = typeof agentFacts.$inferSelect;
export type NewAgentFact = typeof agentFacts.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type CertJob = typeof certJobs.$inferSelect;
export type NewCertJob = typeof certJobs.$inferInsert;
export type TrialResult = typeof trialResults.$inferSelect;
export type NewTrialResult = typeof trialResults.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
export type CertRevocation = typeof certRevocations.$inferSelect;
export type CompliancePolicy = typeof compliancePolicies.$inferSelect;
export type ComplianceDecision = typeof complianceDecisions.$inferSelect;
export type ComplianceViolation = typeof complianceViolations.$inferSelect;
export type TelemetryEvent = typeof telemetryEvents.$inferSelect;
export type NewTelemetryEvent = typeof telemetryEvents.$inferInsert;
export type ProbeRun = typeof probeRuns.$inferSelect;
export type NewProbeRun = typeof probeRuns.$inferInsert;
export type ReputationSnapshot = typeof reputationSnapshots.$inferSelect;
export type NewReputationSnapshot = typeof reputationSnapshots.$inferInsert;
export type AuditIntent = typeof auditIntents.$inferSelect;
export type NewAuditIntent = typeof auditIntents.$inferInsert;
export type AuditSettlement = typeof auditSettlements.$inferSelect;
export type NewAuditSettlement = typeof auditSettlements.$inferInsert;
export type AuditReconciliation = typeof auditReconciliations.$inferSelect;
export type AuditWallet = typeof auditWallets.$inferSelect;
export type DeveloperKey = typeof developerKeys.$inferSelect;
export type NewDeveloperKey = typeof developerKeys.$inferInsert;
export type FederationTrustScore = typeof federationTrustScores.$inferSelect;
export type NewFederationTrustScore = typeof federationTrustScores.$inferInsert;
export type CrossRegistryScore = typeof crossRegistryScores.$inferSelect;
export type NewCrossRegistryScore = typeof crossRegistryScores.$inferInsert;
export type AgentBehaviorMetric = typeof agentBehaviorMetrics.$inferSelect;
export type NewAgentBehaviorMetric = typeof agentBehaviorMetrics.$inferInsert;
export type ComplianceScanRun = typeof complianceScanRuns.$inferSelect;
export type NewComplianceScanRun = typeof complianceScanRuns.$inferInsert;
export type TrustFrameworkMeta = typeof trustFrameworkMeta.$inferSelect;
export type NewTrustFrameworkMeta = typeof trustFrameworkMeta.$inferInsert;
export type TrustGraphEdge = typeof trustGraphEdges.$inferSelect;
export type NewTrustGraphEdge = typeof trustGraphEdges.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type BillingPeriodRecord = typeof billingPeriods.$inferSelect;
export type NewBillingPeriodRecord = typeof billingPeriods.$inferInsert;
export type BillingLineItemRecord = typeof billingLineItems.$inferSelect;
export type NewBillingLineItemRecord = typeof billingLineItems.$inferInsert;
export type SubscriptionRecord = typeof subscriptions.$inferSelect;
export type NewSubscriptionRecord = typeof subscriptions.$inferInsert;
export type SubscriptionEventRecord = typeof subscriptionEvents.$inferSelect;
export type NewSubscriptionEventRecord = typeof subscriptionEvents.$inferInsert;
export type InvoiceRecord = typeof invoices.$inferSelect;
export type NewInvoiceRecord = typeof invoices.$inferInsert;
export type UcpCheckoutSessionRecord = typeof ucpCheckoutSessions.$inferSelect;
export type NewUcpCheckoutSessionRecord = typeof ucpCheckoutSessions.$inferInsert;
export type CurrencyRecord = typeof currencies.$inferSelect;
export type NewCurrencyRecord = typeof currencies.$inferInsert;
export type RevenueSplitRecord = typeof revenueSplits.$inferSelect;
export type NewRevenueSplitRecord = typeof revenueSplits.$inferInsert;
export type RevenueShareRecord = typeof revenueShares.$inferSelect;
export type NewRevenueShareRecord = typeof revenueShares.$inferInsert;
export type RevenueSettlementRecord = typeof revenueSettlements.$inferSelect;
export type NewRevenueSettlementRecord = typeof revenueSettlements.$inferInsert;
export type ResolutionLogRecord = typeof resolutionLog.$inferSelect;
export type NewResolutionLogRecord = typeof resolutionLog.$inferInsert;
export type ProtocolAdapterRecord = typeof protocolAdapters.$inferSelect;
export type NewProtocolAdapterRecord = typeof protocolAdapters.$inferInsert;
export type FederationPeerRecord = typeof federationPeers.$inferSelect;
export type NewFederationPeerRecord = typeof federationPeers.$inferInsert;
export type GossipLogRecord = typeof gossipLog.$inferSelect;
export type NewGossipLogRecord = typeof gossipLog.$inferInsert;
export type QuiltRouteRecord = typeof quiltRoutes.$inferSelect;
export type NewQuiltRouteRecord = typeof quiltRoutes.$inferInsert;
export type AgentAddrRecord = typeof agentAddrs.$inferSelect;
export type NewAgentAddrRecord = typeof agentAddrs.$inferInsert;
export type WorkflowRecord = typeof workflows.$inferSelect;
export type NewWorkflowRecord = typeof workflows.$inferInsert;
export type WorkflowStepRecord = typeof workflowSteps.$inferSelect;
export type NewWorkflowStepRecord = typeof workflowSteps.$inferInsert;
export type WorkflowRunRecord = typeof workflowRuns.$inferSelect;
export type NewWorkflowRunRecord = typeof workflowRuns.$inferInsert;
export type WorkflowStepRunRecord = typeof workflowStepRuns.$inferSelect;
export type NewWorkflowStepRunRecord = typeof workflowStepRuns.$inferInsert;
export type OrchestratorPatternRecord = typeof orchestratorPatterns.$inferSelect;
export type NewOrchestratorPatternRecord = typeof orchestratorPatterns.$inferInsert;

// ===================================================================
// DELEGATION & ROUTING (Phase 6 — Sprint 14: A2A Routing + Delegation)
// ===================================================================

/** Delegation tasks — track sub-agent task delegation lifecycle */
export const delegationTasks = sqliteTable(
	'delegation_tasks',
	{
		id: text('id').primaryKey(),
		parentWorkflowId: text('parent_workflow_id').references(() => workflows.id),
		parentStepId: text('parent_step_id'),
		delegatorId: text('delegator_id').notNull(),
		delegateId: text('delegate_id').notNull(),
		taskType: text('task_type').notNull().default('a2a_call'),
		action: text('action').notNull(),
		inputJson: text('input_json').notNull().default('{}'),
		outputJson: text('output_json'),
		status: text('status').notNull().default('pending'),
		errorMessage: text('error_message'),
		delegationToken: text('delegation_token'),
		timeoutMs: integer('timeout_ms').notNull().default(30000),
		retryCount: integer('retry_count').notNull().default(0),
		maxRetries: integer('max_retries').notNull().default(3),
		grantedScope: text('granted_scope'),
		expiresAt: integer('expires_at'),
		grantedByProofHash: text('granted_by_proof_hash'),
		parentDelegationId: text('parent_delegation_id'),
		revocable: integer('revocable').notNull().default(1),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		delegatorIdx: index('idx_dt_delegator').on(table.delegatorId),
		delegateIdx: index('idx_dt_delegate').on(table.delegateId),
		statusIdx: index('idx_dt_status').on(table.status),
		workflowIdx: index('idx_dt_workflow').on(table.parentWorkflowId),
		parentDelegationIdx: index('idx_dt_parent_delegation').on(table.parentDelegationId),
		expiresAtIdx: index('idx_dt_expires_at').on(table.expiresAt)
	})
);

/** Routing decisions — log intelligent routing choices for analytics */
export const routingDecisions = sqliteTable(
	'routing_decisions',
	{
		id: text('id').primaryKey(),
		requestId: text('request_id').notNull(),
		sourceAgentId: text('source_agent_id').notNull(),
		targetAgentId: text('target_agent_id').notNull(),
		action: text('action').notNull(),
		strategy: text('strategy').notNull().default('capability'),
		score: real('score').notNull().default(0.0),
		contextJson: text('context_json'),
		candidatesJson: text('candidates_json'),
		selectedReason: text('selected_reason'),
		latencyMs: integer('latency_ms'),
		success: integer('success'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		sourceIdx: index('idx_rd_source').on(table.sourceAgentId),
		targetIdx: index('idx_rd_target').on(table.targetAgentId),
		actionIdx: index('idx_rd_action').on(table.action),
		createdIdx: index('idx_rd_created').on(table.createdAt)
	})
);

// Delegation & Routing type exports
export type DelegationTaskRecord = typeof delegationTasks.$inferSelect;
export type NewDelegationTaskRecord = typeof delegationTasks.$inferInsert;
export type RoutingDecisionRecord = typeof routingDecisions.$inferSelect;
export type NewRoutingDecisionRecord = typeof routingDecisions.$inferInsert;

// ===================================================================
// Phase 6 — Sprint 15: Real-time Collaboration + Conflict Resolution
// ===================================================================

/** Workflow events — SSE streaming of workflow run progress */
export const workflowEvents = sqliteTable(
	'workflow_events',
	{
		id: text('id').primaryKey(),
		workflowId: text('workflow_id')
			.notNull()
			.references(() => workflows.id),
		runId: text('run_id').references(() => workflowRuns.id),
		stepId: text('step_id'),
		eventType: text('event_type').notNull().default('step_status'), // step_status | delegation | routing | conflict | system
		payloadJson: text('payload_json').notNull().default('{}'),
		emittedAt: integer('emitted_at')
			.notNull()
			.default(sql`(unixepoch())`),
		consumed: integer('consumed').notNull().default(0) // 0 = pending, 1 = delivered
	},
	(table) => ({
		workflowIdx: index('idx_we_workflow').on(table.workflowId),
		runIdx: index('idx_we_run').on(table.runId),
		emittedIdx: index('idx_we_emitted').on(table.emittedAt),
		consumedIdx: index('idx_we_consumed').on(table.consumed, table.emittedAt)
	})
);

/** Conflict resolutions — handling competing agent responses */
export const conflictResolutions = sqliteTable(
	'conflict_resolutions',
	{
		id: text('id').primaryKey(),
		workflowId: text('workflow_id')
			.notNull()
			.references(() => workflows.id),
		runId: text('run_id').references(() => workflowRuns.id),
		stepId: text('step_id'),
		conflictType: text('conflict_type').notNull().default('competing_response'), // competing_response | timeout_race | capability_overlap
		strategy: text('strategy').notNull().default('highest_score'), // highest_score | first_wins | voting | manual
		candidatesJson: text('candidates_json').notNull().default('[]'),
		winnerAgentId: text('winner_agent_id'),
		winnerResponse: text('winner_response'),
		resolutionScore: real('resolution_score'),
		resolved: integer('resolved').notNull().default(0), // 0 = pending, 1 = resolved
		resolvedAt: integer('resolved_at'),
		metadataJson: text('metadata_json').default('{}'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		workflowIdx: index('idx_cr_workflow').on(table.workflowId),
		runIdx: index('idx_cr_run').on(table.runId),
		resolvedIdx: index('idx_cr_resolved').on(table.resolved),
		typeIdx: index('idx_cr_type').on(table.conflictType)
	})
);

// Real-time & Conflict Resolution type exports
export type WorkflowEventRecord = typeof workflowEvents.$inferSelect;
export type NewWorkflowEventRecord = typeof workflowEvents.$inferInsert;
export type ConflictResolutionRecord = typeof conflictResolutions.$inferSelect;
export type NewConflictResolutionRecord = typeof conflictResolutions.$inferInsert;

// ===================================================================
// SITE VISITORS (1 table)
// ===================================================================

/** Vault-gate visitors — name + email collected before granting access */
export const siteVisitors = sqliteTable(
	'site_visitors',
	{
		id: text('id').primaryKey(), // 'sv-{uuid}'
		email: text('email').notNull().unique(),
		name: text('name').notNull(),
		source: text('source').notNull().default('vault_gate'), // 'vault_gate', 'referral', etc.
		status: text('status').notNull().default('active'), // 'active', 'blocked', 'converted'
		notes: text('notes'), // Admin notes
		visitCount: integer('visit_count').notNull().default(1),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at')
			.notNull()
			.default(sql`(unixepoch())`),
		lastVisitedAt: integer('last_visited_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		emailIdx: index('idx_sv_email').on(table.email),
		statusIdx: index('idx_sv_status').on(table.status),
		createdIdx: index('idx_sv_created').on(table.createdAt)
	})
);

export type SiteVisitorRecord = typeof siteVisitors.$inferSelect;
export type NewSiteVisitorRecord = typeof siteVisitors.$inferInsert;

// ===================================================================
// EXTERNAL REGISTRY BRIDGE (Phase 7 — Cross-Network Federation)
// ===================================================================

/** Configured external NANDA registries to sync agents from */
export const externalRegistries = sqliteTable(
	'external_registries',
	{
		id: text('id').primaryKey(), // "ext-{uuid}" or slug like "hol-nanda"
		name: text('name').notNull(), // Human-readable name
		baseUrl: text('base_url').notNull(), // API base URL
		adapterType: text('adapter_type').notNull().default('nanda'), // nanda | hol | agntcy | custom
		enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
		syncIntervalMin: integer('sync_interval_min').notNull().default(60), // How often to sync (minutes)
		lastSyncAt: integer('last_sync_at'),
		lastSyncStatus: text('last_sync_status'), // success | error | partial
		lastSyncAgentCount: integer('last_sync_agent_count').default(0),
		lastSyncError: text('last_sync_error'),
		totalAgentsSynced: integer('total_agents_synced').default(0),
		configJson: text('config_json').default('{}'), // Adapter-specific config (headers, filters, etc.)
		createdAt: integer('created_at').default(sql`(unixepoch())`),
		updatedAt: integer('updated_at').default(sql`(unixepoch())`)
	},
	(table) => ({
		enabledIdx: index('idx_er_enabled').on(table.enabled),
		adapterIdx: index('idx_er_adapter').on(table.adapterType)
	})
);

export type ExternalRegistryRecord = typeof externalRegistries.$inferSelect;
export type NewExternalRegistryRecord = typeof externalRegistries.$inferInsert;

// ===================================================================
// NODE OPERATOR CONTROL SURFACE (Phase 2 — Launch Roadmap §4)
// ===================================================================

/**
 * Node settings singleton — operator-controlled configuration for
 * auth modes, branding, and notifications. Exactly one row with id='default'.
 */
export const nodeSettings = sqliteTable('node_settings', {
	id: text('id').primaryKey().default('default'),
	authMode: text('auth_mode').notNull().default('solo'), // solo | invite | open
	waitlistEnabled: integer('waitlist_enabled', { mode: 'boolean' }).notNull().default(false),
	defaultRole: text('default_role').notNull().default('developer'), // developer | viewer
	yanezEnabled: integer('yanez_enabled', { mode: 'boolean' }).notNull().default(false), // Yanez biometric sign-and-return service
	ownerEmail: text('owner_email'), // Canonical site-owner email (nullable until first boot)
	nodeName: text('node_name'), // Public display name
	supportEmail: text('support_email'), // Shown in emails / gate
	welcomeHeadline: text('welcome_headline'),
	welcomeBody: text('welcome_body'),
	brandLogoUrl: text('brand_logo_url'),
	brandPrimaryColor: text('brand_primary_color'),
	createdAt: integer('created_at')
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql`(unixepoch())`)
});

export type NodeSettingsRecord = typeof nodeSettings.$inferSelect;
export type NewNodeSettingsRecord = typeof nodeSettings.$inferInsert;

/**
 * Invitations / allowlist — each row is both the invite record and the
 * allowlist entry. The magic-link flow checks `status IN ('invited', 'accepted')`
 * at login time. No tokens; the row itself is the grant.
 */
export const invitations = sqliteTable(
	'invitations',
	{
		id: text('id').primaryKey(), // 'inv-{uuid}'
		email: text('email').notNull(),
		role: text('role').notNull().default('developer'), // developer | viewer | admin
		status: text('status').notNull().default('invited'), // invited | waitlisted | accepted | revoked | expired
		invitedBy: text('invited_by'), // user id of the operator who created this row
		invitedByEmail: text('invited_by_email'),
		note: text('note'), // Free-form operator note (shown in UI)
		expiresAt: integer('expires_at'), // Optional hard expiry (unix seconds)
		lastSentAt: integer('last_sent_at'), // Last time Resend email was dispatched
		sendCount: integer('send_count').notNull().default(0),
		acceptedAt: integer('accepted_at'),
		acceptedUserId: text('accepted_user_id'), // Sentinel user id after first login
		revokedAt: integer('revoked_at'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		emailUniq: uniqueIndex('idx_inv_email').on(table.email),
		statusIdx: index('idx_inv_status').on(table.status),
		createdIdx: index('idx_inv_created').on(table.createdAt)
	})
);

export type InvitationRecord = typeof invitations.$inferSelect;
export type NewInvitationRecord = typeof invitations.$inferInsert;

/**
 * Admin audit log — captures every mutation performed through the
 * operator control surface. Separate from telemetry_events (which is
 * agent-centric). Added in migration 0002.
 */
export const adminAuditLog = sqliteTable(
	'admin_audit_log',
	{
		id: text('id').primaryKey(), // 'aud-{nanoid}'
		eventType: text('event_type').notNull(), // e.g. 'settings.auth_mode_changed'
		actorUserId: text('actor_user_id'),
		actorEmail: text('actor_email'),
		targetType: text('target_type'),
		targetId: text('target_id'),
		metadata: text('metadata'), // JSON blob
		ip: text('ip'),
		userAgent: text('user_agent'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => ({
		eventTypeIdx: index('idx_audit_event_type').on(table.eventType),
		createdAtIdx: index('idx_audit_created_at').on(table.createdAt),
		actorIdx: index('idx_audit_actor').on(table.actorEmail)
	})
);

export type AdminAuditLogRecord = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogRecord = typeof adminAuditLog.$inferInsert;

// ===================================================================
// Yanez biometric sign-and-return (opt-in service)
// ===================================================================

export const yanezChallenges = sqliteTable(
	'yanez_challenges',
	{
		id: text('id').primaryKey(), // request_id (uuid)
		kind: text('kind').notNull().default('session'), // session
		status: text('status').notNull().default('pending'), // pending | verified | invalid | expired
		subject: text('subject'),
		messageB64: text('message_b64').notNull(),
		callbackUrl: text('callback_url').notNull(),
		deepLink: text('deep_link').notNull(),
		verifyOk: integer('verify_ok', { mode: 'boolean' }).notNull().default(false),
		yid: text('yid'),
		groupPublicKey: text('group_public_key'),
		ethAddress: text('eth_address'),
		signature: text('signature'),
		payloadJson: text('payload_json'),
		reason: text('reason'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at')
			.notNull()
			.default(sql`(unixepoch())`),
		expiresAt: integer('expires_at').notNull()
	},
	(table) => ({
		statusIdx: index('idx_yanez_challenges_status').on(table.status)
	})
);

export type YanezChallengeRecord = typeof yanezChallenges.$inferSelect;
export type NewYanezChallengeRecord = typeof yanezChallenges.$inferInsert;
