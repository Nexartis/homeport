/**
 * A2A Protocol Route Tests — POST /a2a
 * JSON-RPC 2.0 envelope validation and action dispatch via SELF.fetch()
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		KYM_NANDA_HMAC_SECRET: string;
		KYM_NANDA_RADIUS_SECRET: string;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

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
	`CREATE TABLE IF NOT EXISTS cert_jobs (
    job_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    status TEXT DEFAULT 'pending', num_trials INTEGER DEFAULT 5,
    completed_trials INTEGER DEFAULT 0, pass_threshold REAL DEFAULT 0.8,
    score REAL, grade TEXT,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS certificates (
    cert_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    score REAL NOT NULL, grade TEXT NOT NULL, ci95_lo REAL, ci95_hi REAL,
    n_trials INTEGER NOT NULL, hmac_signature TEXT NOT NULL, ed25519_vc TEXT,
    evidence_uri TEXT, issued_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
	`CREATE TABLE IF NOT EXISTS cert_revocations (
    cert_id TEXT PRIMARY KEY REFERENCES certificates(cert_id),
    reason TEXT NOT NULL, status_list_index INTEGER,
    revoked_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_rev_status_list_index
    ON cert_revocations(status_list_index)`,
	`CREATE TABLE IF NOT EXISTS telemetry_events (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    latency_ms INTEGER, success INTEGER, status_code INTEGER,
    fraud_flag INTEGER DEFAULT 0, note TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_te_agent ON telemetry_events(agent_id, created_at)`,
	`CREATE TABLE IF NOT EXISTS probe_runs (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    endpoint TEXT, capability TEXT,
    probes_sent INTEGER, success_count INTEGER, p95_latency_ms INTEGER,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    availability REAL, error_rate REAL, fraud_rate REAL,
    p95_latency_ms INTEGER, probe_success REAL, cert_score REAL,
    reputation REAL, actions TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS compliance_policies (
    policy_id TEXT PRIMARY KEY, rules_json TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS compliance_decisions (
    decision_id TEXT PRIMARY KEY, envelope_hash TEXT NOT NULL,
    from_agent TEXT, to_agent TEXT, capability TEXT,
    decision TEXT NOT NULL, reasons TEXT,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS compliance_violations (
    violation_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
    envelope_hash TEXT, reason TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS audit_intents (
    intent_id TEXT PRIMARY KEY, payer TEXT NOT NULL, payee TEXT NOT NULL,
    amount INTEGER NOT NULL, memo TEXT, nonce TEXT,
    window_sec INTEGER DEFAULT 3600, status TEXT DEFAULT 'open',
    created_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER)`,
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
    agent_name TEXT NOT NULL, balance_minor INTEGER DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NP', scale INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (agent_name, currency))`,
	`CREATE TABLE IF NOT EXISTS protocol_adapters (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, protocol TEXT NOT NULL,
    detected_at INTEGER DEFAULT (unixepoch()), metadata_json TEXT, last_synced_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_pa_agent ON protocol_adapters(agent_id)`,
	`CREATE TABLE IF NOT EXISTS currencies (
    symbol TEXT PRIMARY KEY, name TEXT NOT NULL, decimals INTEGER NOT NULL DEFAULT 6,
    chain TEXT, contract_address TEXT, active INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'stablecoin', created_at INTEGER DEFAULT (unixepoch()))`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

// ==================================================================
// Helpers
// ==================================================================

function a2aRequest(payload: Record<string, unknown>, id: number | string = 1) {
	return new Request('http://localhost/a2a', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			method: 'message/send',
			params: {
				message: {
					role: 'user',
					parts: [{ text: JSON.stringify(payload) }]
				}
			},
			id
		})
	});
}

async function parseJson(res: Response): Promise<any> {
	return res.json();
}

// ==================================================================
// JSON-RPC envelope validation
// ==================================================================

describe('POST /a2a — envelope validation', () => {
	it('returns parse error for invalid JSON body', async () => {
		const res = await SELF.fetch('http://localhost/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not-json'
		});
		expect(res.status).toBe(400);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32700);
		expect(body.error.message).toContain('Parse error');
	});

	it('returns error for missing jsonrpc field', async () => {
		const res = await SELF.fetch('http://localhost/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ method: 'message/send', id: 1 })
		});
		expect(res.status).toBe(400);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32600);
	});

	it('returns error for missing method field', async () => {
		const res = await SELF.fetch('http://localhost/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 2 })
		});
		expect(res.status).toBe(400);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32600);
	});

	it('returns error when message text is missing', async () => {
		const res = await SELF.fetch('http://localhost/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '2.0', method: 'message/send', params: {}, id: 3 })
		});
		expect(res.status).toBe(400);
		const body = await parseJson(res);
		expect(body.error.message).toContain('Missing message text');
	});

	it('returns error when message text is not valid JSON', async () => {
		const res = await SELF.fetch('http://localhost/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'message/send',
				params: { message: { role: 'user', parts: [{ text: 'not-json' }] } },
				id: 4
			})
		});
		expect(res.status).toBe(400);
		const body = await parseJson(res);
		expect(body.error.message).toContain('Invalid JSON in message text');
	});

	it('returns error when action field is missing', async () => {
		const res = await SELF.fetch(a2aRequest({ no_action: true }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32600);
		expect(body.error.message).toContain('Missing or invalid action');
	});

	it('returns error for unknown action', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'nonexistent.action' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown action');
	});
});

// ==================================================================
// Certifier action dispatch
// ==================================================================

describe('POST /a2a — certifier actions', () => {
	it('start: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'start', capability: 'math' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('start: rejects missing capability', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'start', agent_id: 'a1' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('capability');
	});

	it('status: rejects missing job_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'status' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('job_id');
	});

	it('status: returns not found for unknown job', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'status', job_id: 'no-such-job' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32000);
		expect(body.error.message).toContain('not found');
	});

	it('certificate: rejects missing cert_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'certificate' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
	});

	it('certificate.revoke: rejects missing cert_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'certificate.revoke' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
	});

	it('certificate.check: rejects missing cert_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'certificate.check' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
	});
});

// ==================================================================
// Observer action dispatch
// ==================================================================

describe('POST /a2a — observer actions', () => {
	it('telemetry.ingest: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'telemetry.ingest' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('telemetry.ingest: succeeds with valid data', async () => {
		const res = await SELF.fetch(
			a2aRequest({
				action: 'telemetry.ingest',
				agent_id: 'a2a-obs-agent',
				latency_ms: 50,
				success: true,
				status_code: 200
			})
		);
		expect(res.status).toBe(200);
		const body = await parseJson(res);
		expect(body.result).toBeDefined();
		const result = JSON.parse(body.result.parts[0].text);
		expect(result.id).toBeDefined();
	});

	it('observer.health: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'observer.health' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
	});

	it('observer.probe.run: rejects missing agent_id', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'observer.probe.run', agent_url: 'https://x.com' })
		);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('observer.probe.run: rejects missing agent_url', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'observer.probe.run', agent_id: 'a1' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_url');
	});

	it('reputation: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'reputation' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
	});

	it('returns error for unknown observer action', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'observer.unknown' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown observer action');
	});
});

// ==================================================================
// Auditor action dispatch
// ==================================================================

describe('POST /a2a — auditor actions', () => {
	it('audit.status: rejects missing intent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'audit.status' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('intent_id');
	});

	it('returns error for unknown audit action', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'audit.unknown' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown audit action');
	});
});

// ==================================================================
// Switchboard action dispatch
// ==================================================================

describe('POST /a2a — switchboard actions', () => {
	it('switchboard.discover: rejects missing url', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'switchboard.discover' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('url');
	});

	it('switchboard.discover: blocks SSRF URLs', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'switchboard.discover', url: 'http://192.168.1.1' })
		);
		const body = await parseJson(res);
		// SSRF blocked returns -32001 (no protocols detected)
		expect(body.error.code).toBe(-32001);
	});

	it('switchboard.export: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'switchboard.export', protocol: 'a2a' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('switchboard.export: rejects invalid protocol', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'switchboard.export', agent_id: 'test-agent', protocol: 'grpc' })
		);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('protocol');
	});

	it('switchboard.export: returns error for nonexistent agent', async () => {
		const res = await SELF.fetch(
			a2aRequest({
				action: 'switchboard.export',
				agent_id: 'nonexistent-agent',
				protocol: 'a2a'
			})
		);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32001);
		expect(body.error.message).toContain('not found');
	});

	it('switchboard.resync: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'switchboard.resync' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('switchboard.adapters: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'switchboard.adapters' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('switchboard.adapters: returns empty list for unknown agent', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'switchboard.adapters', agent_id: 'no-such-agent' })
		);
		expect(res.status).toBe(200);
		const body = await parseJson(res);
		const result = JSON.parse(body.result.parts[0].text);
		expect(result.agent_id).toBe('no-such-agent');
		expect(result.adapters).toEqual([]);
	});

	it('returns error for unknown switchboard action', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'switchboard.unknown' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown switchboard action');
	});
});

// ==================================================================
// Payment action dispatch
// ==================================================================

describe('POST /a2a — payment actions', () => {
	it('payment.rates: rejects missing currency codes', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'payment.rates' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('currency code');
	});

	it('payment.rates: returns rate for valid pair', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'payment.rates', from: 'NP', to: 'USDC' }));
		expect(res.status).toBe(200);
		const body = await parseJson(res);
		const result = JSON.parse(body.result.parts[0].text);
		expect(result.from).toBe('NP');
		expect(result.to).toBe('USDC');
		expect(typeof result.rate).toBe('number');
		expect(result.rate).toBeGreaterThan(0);
	});

	it('payment.rates: rejects unknown currency', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'payment.rates', from: 'BTC', to: 'USDC' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32000);
		expect(body.error.message).toContain('Unknown currency');
	});

	it('payment.balance: rejects missing agent_id', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'payment.balance' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('agent_id');
	});

	it('payment.balance: returns empty balances for unknown agent', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'payment.balance', agent_id: 'unknown-agent' })
		);
		expect(res.status).toBe(200);
		const body = await parseJson(res);
		const result = JSON.parse(body.result.parts[0].text);
		expect(result.agent_id).toBe('unknown-agent');
		expect(typeof result.balances).toBe('object');
	});

	it('payment.convert: rejects missing currency codes', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'payment.convert', amount: 100 }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
	});

	it('payment.convert: rejects non-positive amount', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'payment.convert', from: 'NP', to: 'USDC', amount: -5 })
		);
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32602);
		expect(body.error.message).toContain('positive');
	});

	it('payment.convert: returns converted amount', async () => {
		const res = await SELF.fetch(
			a2aRequest({ action: 'payment.convert', from: 'NP', to: 'USDC', amount: 1000 })
		);
		expect(res.status).toBe(200);
		const body = await parseJson(res);
		const result = JSON.parse(body.result.parts[0].text);
		expect(result.from).toBe('NP');
		expect(result.to).toBe('USDC');
		expect(result.amount).toBe(1000);
		expect(typeof result.converted).toBe('number');
		expect(result.converted).toBeGreaterThan(0);
		expect(typeof result.rate).toBe('number');
	});

	it('returns error for unknown payment action', async () => {
		const res = await SELF.fetch(a2aRequest({ action: 'payment.unknown' }));
		const body = await parseJson(res);
		expect(body.error.code).toBe(-32601);
		expect(body.error.message).toContain('Unknown payment action');
	});
});
