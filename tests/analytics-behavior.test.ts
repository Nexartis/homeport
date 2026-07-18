/**
 * Behavior Analytics + Trends Tests — Agent Beta Phase 3
 *
 * Covers:
 *   - computeDailyMetrics: aggregates telemetry, payment, reputation into daily row
 *   - computeWeeklyMetrics: weekly aggregation
 *   - getAgentTrends: retrieves stored metrics
 *   - backfillMetrics: creates N days of historical metrics
 *   - computeTrend: linear regression slope + direction
 *   - detectAnomalies: 2-sigma outlier detection
 *   - movingAverage: simple moving average
 *   - formatTrendSummary: human-readable output
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import {
	computeDailyMetrics,
	computeWeeklyMetrics,
	getAgentTrends,
	backfillMetrics
} from '../src/lib/services/analytics/behavior';
import {
	computeTrend,
	detectAnomalies,
	movingAverage,
	formatTrendSummary
} from '../src/lib/services/analytics/trends';
import { createDbClient } from '../src/lib/db/client';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

// Table setup — only tables the behavior service queries
const TABLES = [
	`CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL, signature_hex TEXT NOT NULL,
    signer_id TEXT NOT NULL, facts_url TEXT, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
    agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT, status TEXT DEFAULT 'alive',
    version TEXT DEFAULT '1.0.0', deprecated_at INTEGER, sunset_at INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS telemetry_events (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    latency_ms REAL, success INTEGER DEFAULT 1,
    status_code INTEGER, fraud_flag INTEGER DEFAULT 0, note TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_intents (
    intent_id TEXT PRIMARY KEY, payer TEXT NOT NULL, payee TEXT NOT NULL,
    amount INTEGER NOT NULL, memo TEXT, nonce TEXT,
    window_sec INTEGER DEFAULT 3600,
    status TEXT DEFAULT 'open',
    created_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL, p95_latency_ms REAL,
    probe_success REAL, cert_score REAL, reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS agent_behavior_metrics (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    period_start INTEGER NOT NULL, period_end INTEGER NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'daily',
    uptime_pct REAL, avg_response_ms REAL, p95_response_ms INTEGER,
    success_rate REAL, total_requests INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0,
    payment_reliability REAL, reputation_score REAL, badge_tier TEXT,
    computed_at INTEGER DEFAULT (unixepoch()))`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

beforeEach(async () => {
	// Individual deletes to avoid D1 batch + FK issues in test pool
	await env.DB.prepare('DELETE FROM agent_behavior_metrics').run();
	await env.DB.prepare('DELETE FROM telemetry_events').run();
	await env.DB.prepare('DELETE FROM reputation_snapshots').run();
});

// ─── Helpers ────────────────────────────────────────────────────
const DAY_SEC = 86400;
const AGENT_ID = 'analytics-test-agent';
const DAY_START = 1770000000; // fixed reference timestamp

async function seedTelemetry(agentId: string, start: number, count: number, successRate = 1.0) {
	const stmts = [];
	for (let i = 0; i < count; i++) {
		const success = Math.random() < successRate ? 1 : 0;
		const latency = 50 + Math.random() * 200;
		stmts.push(
			env.DB.prepare(
				`INSERT INTO telemetry_events (id, agent_id, latency_ms, success, created_at)
         VALUES (?, ?, ?, ?, ?)`
			).bind(`tel-${agentId}-${i}`, agentId, latency, success, start + i * 60)
		);
	}
	await env.DB.batch(stmts);
}

async function seedReputation(agentId: string, reputation: number, createdAt: number) {
	await env.DB.prepare(
		`INSERT INTO reputation_snapshots (id, agent_id, availability, error_rate, fraud_rate, cert_score, reputation, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(`rep-${agentId}-${createdAt}`, agentId, 0.95, 0.02, 0.01, 0.8, reputation, createdAt)
		.run();
}

// ─── Behavior Analytics Tests ───────────────────────────────────

describe('computeDailyMetrics', () => {
	it('should create a daily metric row from telemetry data', async () => {
		await seedTelemetry(AGENT_ID, DAY_START, 20, 0.9);
		await seedReputation(AGENT_ID, 0.85, DAY_START - 100);

		const result = await computeDailyMetrics(db, AGENT_ID, DAY_START);

		expect(result.agent_id).toBe(AGENT_ID);
		expect(result.period_type).toBe('daily');
		expect(result.period_start).toBe(DAY_START);
		expect(result.period_end).toBe(DAY_START + DAY_SEC);
		expect(result.total_requests).toBe(20);
		expect(result.reputation_score).toBeCloseTo(0.85, 2);
		expect(result.badge_tier).toBeTruthy();
		expect(result.id).toBeTruthy();
	});

	it('should handle no telemetry data gracefully', async () => {
		const result = await computeDailyMetrics(db, AGENT_ID, DAY_START);

		expect(result.total_requests).toBe(0);
		expect(result.success_rate).toBeNull();
		expect(result.avg_response_ms).toBeNull();
	});
});

describe('computeWeeklyMetrics', () => {
	it('should create a weekly metric row', async () => {
		await seedTelemetry(AGENT_ID, DAY_START, 50, 0.95);
		const result = await computeWeeklyMetrics(db, AGENT_ID, DAY_START);

		expect(result.period_type).toBe('weekly');
		expect(result.period_end).toBe(DAY_START + 7 * DAY_SEC);
		expect(result.total_requests).toBe(50);
	});
});

describe('getAgentTrends', () => {
	it('should return stored metrics in descending order', async () => {
		// Create two daily metrics at different times
		await seedTelemetry(AGENT_ID, DAY_START, 10);
		await computeDailyMetrics(db, AGENT_ID, DAY_START);

		await seedTelemetry(AGENT_ID + '-2', DAY_START + DAY_SEC, 10);
		// Second metric for same agent at next day
		await env.DB.prepare('DELETE FROM telemetry_events').run();
		await seedTelemetry(AGENT_ID, DAY_START + DAY_SEC, 15);
		await computeDailyMetrics(db, AGENT_ID, DAY_START + DAY_SEC);

		const trends = await getAgentTrends(db, AGENT_ID, 'daily', 10);
		expect(trends.length).toBe(2);
		// Most recent first
		expect(trends[0].periodStart).toBe(DAY_START + DAY_SEC);
		expect(trends[1].periodStart).toBe(DAY_START);
	});
});

describe('backfillMetrics', () => {
	it('should create N days of metrics', async () => {
		const result = await backfillMetrics(db, AGENT_ID, 3);
		expect(result.created).toBe(3);

		const stored = await getAgentTrends(db, AGENT_ID, 'daily', 10);
		expect(stored.length).toBe(3);
	});
});

// ─── Trends (pure functions) ─────────────────────────────────────

describe('computeTrend', () => {
	it('should detect improving trend', () => {
		const result = computeTrend([0.5, 0.55, 0.6, 0.65, 0.7]);
		expect(result).not.toBeNull();
		expect(result!.direction).toBe('improving');
		expect(result!.slope).toBeGreaterThan(0);
		expect(result!.n).toBe(5);
	});

	it('should detect declining trend', () => {
		const result = computeTrend([0.9, 0.85, 0.8, 0.75, 0.7]);
		expect(result).not.toBeNull();
		expect(result!.direction).toBe('declining');
		expect(result!.slope).toBeLessThan(0);
	});

	it('should detect stable trend', () => {
		const result = computeTrend([0.5, 0.5, 0.5, 0.5]);
		expect(result).not.toBeNull();
		expect(result!.direction).toBe('stable');
	});

	it('should return null for fewer than 2 values', () => {
		expect(computeTrend([0.5])).toBeNull();
		expect(computeTrend([])).toBeNull();
	});
});

describe('detectAnomalies', () => {
	it('should detect outliers beyond 2 sigma', () => {
		const values = [1, 1, 1, 1, 1, 1, 1, 1, 1, 10];
		const anomalies = detectAnomalies(values);
		expect(anomalies.length).toBeGreaterThan(0);
		expect(anomalies[0].value).toBe(10);
		expect(anomalies[0].z_score).toBeGreaterThan(2);
	});

	it('should return empty for uniform data', () => {
		const anomalies = detectAnomalies([5, 5, 5, 5, 5]);
		expect(anomalies).toEqual([]);
	});

	it('should return empty for fewer than 3 values', () => {
		expect(detectAnomalies([1, 2])).toEqual([]);
	});
});

describe('movingAverage', () => {
	it('should compute moving average with given window', () => {
		const result = movingAverage([1, 2, 3, 4, 5], 3);
		expect(result.length).toBe(5);
		// Window of 3: avg of [3,4,5] = 4
		expect(result[4]).toBeCloseTo(4, 1);
	});

	it('should handle empty array', () => {
		expect(movingAverage([], 3)).toEqual([]);
	});
});

describe('formatTrendSummary', () => {
	it('should format improving trend', () => {
		const summary = formatTrendSummary({
			slope: 0.05,
			direction: 'improving',
			r_squared: 0.95,
			n: 10
		});
		expect(summary).toContain('Improving');
		expect(summary).toContain('10 periods');
	});

	it('should handle null trend', () => {
		const summary = formatTrendSummary(null);
		expect(summary).toContain('Insufficient data');
	});
});

// ── Lane C HTTP Auth Matrix ──────────────────────────────────────
//
// /api/analytics/behavior is Lane C (M2M): requires any authenticated
// caller — developer API key or admin session. Anonymous callers must
// receive 401 from the SvelteKit error handler; invalid bearer tokens
// must also map to 401 (hooks.server.ts rejects unknown keys before
// the handler runs). A seeded developer key must clear the guard.

import { SELF } from 'cloudflare:test';

const BEHAVIOR_API_KEY_RAW = 'nanda_test_behavior_key_abcdef0123456789';

async function sha256Hex(data: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

describe('/api/analytics/behavior — Lane C auth matrix', () => {
	beforeAll(async () => {
		await env.DB.prepare(
			`CREATE TABLE IF NOT EXISTS developer_keys (
				id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL,
				name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT,
				status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'free',
				rate_limit_monthly INTEGER NOT NULL DEFAULT 1000, scopes TEXT,
				last_used_at INTEGER, usage_count_monthly INTEGER NOT NULL DEFAULT 0,
				usage_reset_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
				revoked_at INTEGER, expires_at INTEGER)`
		).run();
		await env.DB.prepare(
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_keys_key_hash ON developer_keys(key_hash)`
		).run();
		const keyHash = await sha256Hex(BEHAVIOR_API_KEY_RAW);
		await env.DB.prepare(
			`INSERT OR IGNORE INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, status, tier, rate_limit_monthly, usage_count_monthly, usage_reset_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'active', 'free', 1000, 0, ?)`
		)
			.bind(
				'behavior-auth-key-1',
				keyHash,
				BEHAVIOR_API_KEY_RAW.slice(0, 12),
				'Behavior Auth Test',
				'user-behavior-auth',
				'behavior-auth@test.com',
				Math.floor(Date.now() / 1000) + 86400 * 30
			)
			.run();
	});

	it('rejects anonymous with 401', async () => {
		const res = await SELF.fetch('https://fake.host/api/analytics/behavior?agent=x', {
			headers: { Accept: 'application/json', 'CF-Connecting-IP': '10.0.11.1' }
		});
		expect(res.status).toBe(401);
	});

	it('rejects invalid bearer with 401', async () => {
		const res = await SELF.fetch('https://fake.host/api/analytics/behavior?agent=x', {
			headers: {
				Accept: 'application/json',
				Authorization: 'Bearer nanda_not_a_real_key_xxxxxxxxxxxx',
				'CF-Connecting-IP': '10.0.11.2'
			}
		});
		expect(res.status).toBe(401);
	});

	it('accepts valid developer API key (not 401/403)', async () => {
		const res = await SELF.fetch('https://fake.host/api/analytics/behavior?agent=x', {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${BEHAVIOR_API_KEY_RAW}`,
				'CF-Connecting-IP': '10.0.11.3'
			}
		});
		expect(res.status).not.toBe(401);
		expect(res.status).not.toBe(403);
	});
});
