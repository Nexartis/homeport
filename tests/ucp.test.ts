/**
 * UCP Integration Tests — manifest endpoint, capability schemas,
 * checkout session CRUD, and payment handler adapter.
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { getCapabilities, getCapabilityById, getCapabilityIds } from '../src/lib/ucp/schemas';
import { handleUcpPayment } from '../src/lib/ucp/payment-handler';
import type { UcpCheckoutSessionRecord } from '../src/lib/db/schema';
import type { UcpPaymentSubmission } from '../src/lib/types/ucp';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		KYM_NANDA_RADIUS_SECRET: string;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

const UCP_SESSION_TABLE = `CREATE TABLE IF NOT EXISTS ucp_checkout_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open',
  client_agent_id TEXT,
  owner_id TEXT,
  line_items TEXT NOT NULL,
  totals TEXT NOT NULL,
  payment TEXT,
  metadata TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER
)`;

const DEV_KEYS_TABLE = `CREATE TABLE IF NOT EXISTS developer_keys (
  id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL,
  name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT,
  status TEXT NOT NULL DEFAULT 'active', tier TEXT NOT NULL DEFAULT 'free',
  rate_limit_monthly INTEGER NOT NULL DEFAULT 1000, scopes TEXT,
  last_used_at INTEGER, usage_count_monthly INTEGER NOT NULL DEFAULT 0,
  usage_reset_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
  revoked_at INTEGER, expires_at INTEGER)`;

const DEV_KEYS_INDEXES = [
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_keys_key_hash ON developer_keys(key_hash)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_owner ON developer_keys(owner_id)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_status ON developer_keys(status)`,
	`CREATE INDEX IF NOT EXISTS idx_dev_keys_prefix ON developer_keys(key_prefix)`
];

const TEST_API_KEY_RAW = 'nanda_test_ucp_checkout_key_01234567890';
const TEST_OWNER_ID = 'user-ucp-test-owner';
let testKeyHash: string;

async function sha256(data: string): Promise<string> {
	const encoded = new TextEncoder().encode(data);
	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
	Authorization: `Bearer ${TEST_API_KEY_RAW}`,
	...extra
});

const AUDIT_TABLES = [
	`CREATE TABLE IF NOT EXISTS audit_intents (
    intent_id TEXT PRIMARY KEY, payer TEXT NOT NULL, payee TEXT NOT NULL,
    amount INTEGER NOT NULL, memo TEXT, nonce TEXT,
    window_sec INTEGER DEFAULT 3600, status TEXT DEFAULT 'open',
    created_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_ai_payer ON audit_intents(payer, status)`,
	`CREATE TABLE IF NOT EXISTS audit_settlements (
    settlement_id TEXT PRIMARY KEY, tx_hash TEXT NOT NULL,
    frm TEXT NOT NULL, to_agent TEXT NOT NULL,
    amount INTEGER NOT NULL, ts INTEGER NOT NULL,
    sig TEXT, verified INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_reconciliations (
    recon_id TEXT PRIMARY KEY,
    intent_id TEXT REFERENCES audit_intents(intent_id),
    tx_hash TEXT, verdict TEXT NOT NULL,
    delta INTEGER, latency_ms INTEGER, balances TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_wallets (
    agent_name TEXT PRIMARY KEY, balance_minor INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'NP', scale INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()))`
];

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare(UCP_SESSION_TABLE),
		env.DB.prepare(DEV_KEYS_TABLE),
		...DEV_KEYS_INDEXES.map((sql) => env.DB.prepare(sql)),
		...AUDIT_TABLES.map((sql) => env.DB.prepare(sql))
	]);

	testKeyHash = await sha256(TEST_API_KEY_RAW);
	await env.DB.prepare(
		`INSERT OR IGNORE INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, status, tier, rate_limit_monthly, usage_count_monthly, usage_reset_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	)
		.bind(
			'test-key-ucp-1',
			testKeyHash,
			TEST_API_KEY_RAW.slice(0, 12),
			'UCP Test Key',
			TEST_OWNER_ID,
			'ucp-test@example.com',
			'active',
			'free',
			1000,
			0,
			Math.floor(Date.now() / 1000) + 86400 * 30
		)
		.run();
});

beforeEach(async () => {
	await env.DB.exec('DELETE FROM ucp_checkout_sessions');
});

// ─────────────────────────────────────────────────────────────────────
// Capability Schemas
// ─────────────────────────────────────────────────────────────────────

describe('UCP Capability Schemas', () => {
	it('getCapabilities() returns at least 4 capabilities', () => {
		const caps = getCapabilities();
		expect(caps.length).toBeGreaterThanOrEqual(4);
		caps.forEach((c) => {
			expect(c.id).toBeTruthy();
			expect(c.name).toBeTruthy();
			expect(c.description).toBeTruthy();
			expect(c.price).toBeDefined();
			expect(c.price.currency).toBe('NP');
		});
	});

	it('getCapabilityById() returns correct capability', () => {
		const cap = getCapabilityById('agent-certification');
		expect(cap).toBeDefined();
		expect(cap!.name).toBe('Agent Certification');
		expect(cap!.price.amount).toBe(100);
	});

	it('getCapabilityById() returns undefined for unknown id', () => {
		expect(getCapabilityById('nonexistent')).toBeUndefined();
	});

	it('getCapabilityIds() returns a Set of all IDs', () => {
		const ids = getCapabilityIds();
		expect(ids).toBeInstanceOf(Set);
		expect(ids.has('agent-discovery')).toBe(true);
		expect(ids.has('agent-certification')).toBe(true);
		expect(ids.has('compliance-check')).toBe(true);
		expect(ids.has('health-probe')).toBe(true);
		expect(ids.has('nonexistent')).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────
// UCP Manifest Endpoint
// ─────────────────────────────────────────────────────────────────────

describe('UCP Manifest Endpoint', () => {
	it('GET /.well-known/ucp returns valid manifest', async () => {
		const res = await SELF.fetch('https://example.com/.well-known/ucp');
		expect(res.status).toBe(200);
		const manifest: any = await res.json();

		expect(manifest.name).toBe('Homeport');
		expect(manifest.spec_version).toBe('2026-01-11');
		expect(manifest.capabilities).toBeInstanceOf(Array);
		expect(manifest.capabilities.length).toBeGreaterThanOrEqual(4);
		expect(manifest.payment_methods).toBeInstanceOf(Array);
		expect(manifest.payment_methods[0].type).toBe('x402-np');
		expect(manifest.protocols).toContain('ucp');
		expect(manifest.protocols).toContain('a2a');
		expect(manifest.protocols).toContain('mcp');
	});

	it('manifest has correct cache headers', async () => {
		const res = await SELF.fetch('https://example.com/.well-known/ucp');
		expect(res.headers.get('Cache-Control')).toContain('public');
		expect(res.headers.get('X-UCP-Spec-Version')).toBe('2026-01-11');
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});
});

// ─────────────────────────────────────────────────────────────────────
// Checkout Session API
// ─────────────────────────────────────────────────────────────────────

describe('Checkout Session API', () => {
	it('POST creates a session with correct totals', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				capabilities: [{ id: 'agent-certification', quantity: 2 }]
			})
		});
		expect(res.status).toBe(201);
		const session: any = await res.json();

		expect(session.id).toBeTruthy();
		expect(session.status).toBe('open');
		expect(session.line_items).toHaveLength(1);
		expect(session.line_items[0].capability_id).toBe('agent-certification');
		expect(session.line_items[0].quantity).toBe(2);
		expect(session.line_items[0].total).toBe(200);
		expect(session.totals.total).toBe(200);
		expect(session.totals.currency).toBe('NP');
		expect(session.expires_at).toBeGreaterThan(session.created_at);
	});

	it('POST rejects empty capabilities', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ capabilities: [] })
		});
		expect(res.status).toBe(400);
	});

	it('POST rejects unknown capability ID', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ capabilities: [{ id: 'nonexistent', quantity: 1 }] })
		});
		expect(res.status).toBe(400);
		const body: any = await res.json();
		expect(body.error).toContain('Unknown capability ID');
	});

	it('POST rejects invalid quantity', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ capabilities: [{ id: 'agent-certification', quantity: 0 }] })
		});
		expect(res.status).toBe(400);
	});

	it('GET retrieves created session by ID', async () => {
		const createRes = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ capabilities: [{ id: 'health-probe', quantity: 3 }] })
		});
		const created: any = await createRes.json();

		const getRes = await SELF.fetch(
			`https://example.com/api/ucp/checkout-sessions?id=${created.id}`,
			{ headers: authHeaders() }
		);
		expect(getRes.status).toBe(200);
		const session: any = await getRes.json();
		expect(session.id).toBe(created.id);
		expect(session.totals.total).toBe(30);
	});

	it('GET returns 404 for unknown session', async () => {
		const res = await SELF.fetch(
			'https://example.com/api/ucp/checkout-sessions?id=nonexistent-id',
			{ headers: authHeaders() }
		);
		expect(res.status).toBe(404);
	});

	it('GET returns 400 when id param is missing', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			headers: authHeaders()
		});
		expect(res.status).toBe(400);
	});

	it('DELETE cancels an open session', async () => {
		const createRes = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({ capabilities: [{ id: 'compliance-check', quantity: 1 }] })
		});
		const created: any = await createRes.json();

		const delRes = await SELF.fetch(`https://example.com/api/ucp/checkout-sessions/${created.id}`, {
			method: 'DELETE',
			headers: authHeaders()
		});
		expect(delRes.status).toBe(200);
		const body: any = await delRes.json();
		expect(body.status).toBe('cancelled');
	});

	it('DELETE returns 404 for unknown session', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions/nonexistent-id', {
			method: 'DELETE',
			headers: authHeaders()
		});
		expect(res.status).toBe(404);
	});

	it('handles multiple capabilities in one session', async () => {
		const res = await SELF.fetch('https://example.com/api/ucp/checkout-sessions', {
			method: 'POST',
			headers: authHeaders({ 'Content-Type': 'application/json' }),
			body: JSON.stringify({
				capabilities: [
					{ id: 'agent-certification', quantity: 1 },
					{ id: 'compliance-check', quantity: 2 },
					{ id: 'health-probe', quantity: 5 }
				]
			})
		});
		expect(res.status).toBe(201);
		const session: any = await res.json();
		// 100 + (50*2) + (10*5) = 100 + 100 + 50 = 250
		expect(session.totals.total).toBe(250);
		expect(session.line_items).toHaveLength(3);
	});
});

// ─────────────────────────────────────────────────────────────────────
// Payment Handler Adapter
// ─────────────────────────────────────────────────────────────────────

describe('UCP Payment Handler', () => {
	it('rejects unsupported payment method', async () => {
		const db = createDbClient(env.DB);
		const session: UcpCheckoutSessionRecord = {
			id: 'test-session',
			status: 'open',
			clientAgentId: null,
			ownerId: null,
			lineItems: JSON.stringify([]),
			totals: JSON.stringify({ subtotal: 100, discount: 0, tax: 0, total: 100, currency: 'NP' }),
			payment: null,
			metadata: null,
			createdAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000),
			expiresAt: null
		};

		const payment: UcpPaymentSubmission = {
			method: 'stripe',
			agent: 'test-agent',
			tx_id: 'tx-123',
			amount: 100,
			signature: 'sig'
		};

		const result = await handleUcpPayment(session, payment, db, env as any);
		expect(result.success).toBe(false);
		expect(result.error).toContain('Unsupported payment method');
	});

	it('rejects mismatched payment amount', async () => {
		const db = createDbClient(env.DB);
		const session: UcpCheckoutSessionRecord = {
			id: 'test-session-2',
			status: 'open',
			clientAgentId: null,
			ownerId: null,
			lineItems: JSON.stringify([]),
			totals: JSON.stringify({ subtotal: 100, discount: 0, tax: 0, total: 100, currency: 'NP' }),
			payment: null,
			metadata: null,
			createdAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000),
			expiresAt: null
		};

		const payment: UcpPaymentSubmission = {
			method: 'x402-np',
			agent: 'test-agent',
			tx_id: 'tx-456',
			amount: 50, // wrong amount
			signature: 'sig'
		};

		const result = await handleUcpPayment(session, payment, db, env as any);
		expect(result.success).toBe(false);
		expect(result.error).toContain('does not match session total');
	});

	it('processes x402-np payment through auditor (HMAC fails in test env)', async () => {
		const db = createDbClient(env.DB);
		const session: UcpCheckoutSessionRecord = {
			id: 'test-session-3',
			status: 'open',
			clientAgentId: null,
			ownerId: null,
			lineItems: JSON.stringify([]),
			totals: JSON.stringify({ subtotal: 100, discount: 0, tax: 0, total: 100, currency: 'NP' }),
			payment: null,
			metadata: null,
			createdAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000),
			expiresAt: null
		};

		const payment: UcpPaymentSubmission = {
			method: 'x402-np',
			agent: 'test-agent',
			tx_id: crypto.randomUUID(),
			amount: 100,
			signature: 'test-sig'
		};

		const result = await handleUcpPayment(session, payment, db, env as any);
		// In test env, HMAC verification fails (sig doesn't match test-radius-secret),
		// so payment handler returns success=false with verification error.
		expect(result.success).toBe(false);
		expect(result.error).toContain('verification failed');
	});
});
