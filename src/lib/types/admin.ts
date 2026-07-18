/**
 * Shared TypeScript interfaces for admin page data.
 *
 * These describe the row shapes returned by +page.server.ts loaders
 * and consumed by admin page components via `as` casts.
 */

// ── Stats shapes (per-page stat widget data) ─────────────
export interface RegistryStats {
	total: number;
	alive: number;
	local_agents: number;
	federated: number;
}

export interface CertifierStats {
	total_jobs: number;
	pending: number;
	running: number;
	active_certs: number;
	revoked: number;
}

export interface ComplianceStats {
	total_policies: number;
	total_decisions: number;
	allowed: number;
	denied: number;
	total_violations: number;
}

export interface ObserverStats {
	total_events: number;
	errors: number;
	fraud: number;
	total_probes: number;
	avg_reputation: number | null;
}

export interface AuditorStats {
	total_intents: number;
	open_intents: number;
	total_settlements: number;
	total_balance: number | null;
	mismatches: number;
}

export interface AnalyticsStats {
	total_metrics: number;
	total_scans: number;
	agents_tracked: number;
	avg_uptime: number | null;
	avg_reputation: number | null;
}

export interface DeprecationStats {
	deprecated: number;
	tombstoned: number;
	expiring_soon: number;
}

export interface VisitorStats {
	total: number;
	active: number;
	repeat_visitors: number;
	today: number;
}

// ── Registry ──────────────────────────────────────────────
export interface AgentItem {
	agent_id: string;
	agent_url: string;
	api_url: string | null;
	status: string;
	capabilities: string | null;
	tags: string | null;
	source: string;
	registered_at: number;
	updated_at: number;
	agent_name: string | null;
	provider_did: string | null;
	jurisdiction: string | null;
	cert_level: string | null;
}

// ── Certifier ─────────────────────────────────────────────
export interface JobItem {
	job_id: string;
	agent_id: string;
	capability: string;
	status: string;
	num_trials: number;
	completed_trials: number;
	score: number | null;
	grade: string | null;
	created_at: number;
}

export interface CertItem {
	cert_id: string;
	agent_id: string;
	capability: string;
	score: number;
	grade: string;
	ci95_lo: number | null;
	ci95_hi: number | null;
	n_trials: number;
	issued_at: number;
	expires_at: number | null;
	revocation_reason: string | null;
	revoked_at: number | null;
}

export interface RevocItem {
	cert_id: string;
	reason: string;
	status_list_index: number | null;
	revoked_at: number;
}

// ── Observer ──────────────────────────────────────────────
export interface TelItem {
	id: string;
	agent_id: string;
	latency_ms: number | null;
	success: number;
	status_code: number | null;
	fraud_flag: number;
	note: string | null;
	created_at: number;
}

export interface ProbeItem {
	id: string;
	agent_id: string;
	endpoint: string | null;
	capability: string | null;
	probes_sent: number | null;
	success_count: number | null;
	p95_latency_ms: number | null;
	created_at: number;
}

export interface RepItem {
	id: string;
	agent_id: string;
	availability: number | null;
	error_rate: number | null;
	fraud_rate: number | null;
	p95_latency_ms: number | null;
	probe_success: number | null;
	cert_score: number | null;
	reputation: number | null;
	actions: string | null;
	created_at: number;
}

// ── Compliance ────────────────────────────────────────────
export interface PolicyItem {
	policy_id: string;
	rules_json: string;
	version: number;
	created_at: number;
	updated_at: number;
}

export interface DecisionItem {
	decision_id: string;
	envelope_hash: string;
	from_agent: string | null;
	to_agent: string | null;
	capability: string | null;
	decision: string;
	reasons: string | null;
	created_at: number;
}

export interface ViolationItem {
	violation_id: string;
	agent_id: string;
	envelope_hash: string | null;
	reason: string;
	created_at: number;
}

// ── Auditor ───────────────────────────────────────────────
export interface IntentItem {
	intent_id: string;
	payer: string;
	payee: string;
	amount: number;
	memo: string | null;
	nonce: string | null;
	window_sec: number;
	status: string;
	created_at: number;
	expires_at: number | null;
}

export interface SettlementItem {
	settlement_id: string;
	tx_hash: string;
	frm: string;
	to_agent: string;
	amount: number;
	ts: number;
	sig: string | null;
	verified: number;
	created_at: number;
}

export interface ReconItem {
	recon_id: string;
	intent_id: string | null;
	tx_hash: string | null;
	verdict: string;
	delta: number | null;
	latency_ms: number | null;
	balances: string | null;
	created_at: number;
}

export interface WalletItem {
	agent_name: string;
	balance_minor: number;
	currency: string;
	scale: number;
	updated_at: number;
}

// ── Analytics ─────────────────────────────────────────────
export interface MetricItem {
	id: string;
	agent_id: string;
	period_type: string;
	uptime_pct: number | null;
	avg_response_ms: number | null;
	success_rate: number | null;
	reputation_score: number | null;
	badge_tier: string | null;
	total_requests: number;
	error_count: number;
	computed_at: number;
}

export interface ScanItem {
	id: string;
	agent_id: string;
	policy_id: string;
	decision: string;
	reasons: string | null;
	scan_type: string;
	created_at: number;
}

// ── Deprecation ───────────────────────────────────────────
export interface DeprecationItem {
	agent_id: string;
	agent_url: string;
	status: string;
	version: string | null;
	deprecated_at: number | null;
	sunset_at: number | null;
	updated_at: number | null;
}

// ── Network Explorer ──────────────────────────────────────
export interface NetworkAgent {
	agent_id: string;
	agent_url: string;
	status: string;
	capabilities: string | null;
	source?: string;
	registered_at: number;
}

export interface NetworkPeer {
	source: string;
	count: number;
	last_updated: number | null;
}

// ── Developer API Keys ────────────────────────────────────
export interface DevApiKey {
	id: string;
	keyPrefix: string;
	name: string | null;
	status: string;
	tier: string | null;
	rateLimitMonthly: number | null;
	usageCountMonthly: number | null;
	lastUsedAt: string | null;
	createdAt: string | null;
	revokedAt: string | null;
	expiresAt: string | null;
}

// ── Visitors ──────────────────────────────────────────────
export interface VisitorItem {
	id: string;
	email: string;
	name: string;
	source: string;
	status: string;
	notes: string | null;
	visit_count: number;
	created_at: number;
	updated_at: number;
	last_visited_at: number;
}
