/**
 * Registry Tests — D1 CRUD, HTTP routes, AgentFacts validation
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { resolveAndSign } from '$lib/crypto/sign-agent';
import {
	registerAgent,
	lookupAgent,
	listAgents,
	searchAgents,
	deleteAgent,
	updateAgentStatus,
	getStats,
	validateAgentFacts,
	storeAgentFacts,
	getAgentFacts
} from '../src/lib/services/registry';
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
		NANDA_FEDERATION_ADMIN_KEY: string;
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
	`CREATE TABLE IF NOT EXISTS agent_facts (
    agent_id TEXT PRIMARY KEY REFERENCES agent_addrs(agent_id),
    facts_json TEXT NOT NULL, agent_name TEXT, provider_did TEXT,
    jurisdiction TEXT, cert_level TEXT, schema_version TEXT DEFAULT '1.0.0',
    fetched_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS clients (
    client_id TEXT PRIMARY KEY, assigned_agent_id TEXT REFERENCES agent_addrs(agent_id),
    created_at INTEGER DEFAULT (unixepoch()))`,
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
	`CREATE TABLE IF NOT EXISTS cert_jobs (
    job_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, capability TEXT NOT NULL,
    status TEXT DEFAULT 'pending', num_trials INTEGER DEFAULT 5,
    completed_trials INTEGER DEFAULT 0, pass_threshold REAL DEFAULT 0.8,
    score REAL, grade TEXT,
    created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`
];

// ALTER TABLE fallbacks in case another test file already created the table without newer columns
const ALTER_COLUMNS = [
	`ALTER TABLE agents ADD COLUMN version TEXT DEFAULT '1.0.0'`,
	`ALTER TABLE agents ADD COLUMN deprecated_at INTEGER`,
	`ALTER TABLE agents ADD COLUMN sunset_at INTEGER`,
	// Phase 6 — Agent Bali: AgentFacts v2 columns
	`ALTER TABLE agent_facts ADD COLUMN trust_score REAL`,
	`ALTER TABLE agent_facts ADD COLUMN compliance_status TEXT`,
	`ALTER TABLE agent_facts ADD COLUMN compliance_checked_at TEXT`,
	`ALTER TABLE agent_facts ADD COLUMN vc_json TEXT`,
	`ALTER TABLE agent_facts ADD COLUMN vc_issued_at INTEGER`,
	`ALTER TABLE agent_facts ADD COLUMN vc_expires_at INTEGER`,
	`ALTER TABLE agent_facts ADD COLUMN disclosure_policy TEXT DEFAULT 'public'`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
	// Apply ALTER TABLE fallbacks (ignore errors if columns already exist)
	for (const alter of ALTER_COLUMNS) {
		try {
			await env.DB.prepare(alter).run();
		} catch {
			// Column already exists — safe to ignore
		}
	}
});

// ---------- Service Layer Tests ----------

const db = createDbClient(env.DB);

/** Helper: sign and register an agent (avoids repeating resolveAndSign in every test) */
async function registerSignedAgent(
	agentData: Parameters<typeof registerAgent>[1] extends infer T
		? Omit<T, 'publicKeyHex' | 'signatureHex' | 'signerId'>
		: never
) {
	const sig = await resolveAndSign(agentData.agent_id, env);
	return registerAgent(db, { ...agentData, ...sig });
}

describe('Registry Service', () => {
	it('should register an agent', async () => {
		await registerSignedAgent({
			agent_id: 'agent-1',
			agent_url: 'https://agent1.example.com',
			capabilities: ['text-generation', 'chat'],
			tags: ['llm', 'fast']
		});
		const agent = await lookupAgent(db, 'agent-1');
		expect(agent).not.toBeNull();
		expect(agent!.agent_id).toBe('agent-1');
		expect(agent!.agent_url).toBe('https://agent1.example.com');
		expect(agent!.capabilities).toEqual(['text-generation', 'chat']);
		expect(agent!.tags).toEqual(['llm', 'fast']);
		expect(agent!.status).toBe('alive');
	});

	it('should return null for unknown agent', async () => {
		const agent = await lookupAgent(db, 'nonexistent');
		expect(agent).toBeNull();
	});

	it('should list agents as flat dict', async () => {
		await registerSignedAgent({ agent_id: 'agent-2', agent_url: 'https://agent2.example.com' });
		const list = await listAgents(db);
		expect(list['agent-1']).toBe('https://agent1.example.com');
		expect(list['agent-2']).toBe('https://agent2.example.com');
	});

	it('should search agents by query substring', async () => {
		const results = await searchAgents(db, 'agent-1');
		expect(results.length).toBe(1);
		expect(results[0].agent_id).toBe('agent-1');
	});

	it('should search agents by capability', async () => {
		const results = await searchAgents(db, undefined, ['chat']);
		expect(results.some((a) => a.agent_id === 'agent-1')).toBe(true);
	});

	it('should update agent status', async () => {
		const updated = await updateAgentStatus(db, 'agent-1', 'offline');
		expect(updated).toBe(true);
		const agent = await lookupAgent(db, 'agent-1');
		expect(agent!.status).toBe('offline');
	});

	it('should get stats', async () => {
		const stats = await getStats(db);
		expect(stats.total_agents).toBeGreaterThanOrEqual(2);
		expect(stats.alive_agents).toBeGreaterThanOrEqual(1); // agent-2 is alive, agent-1 is offline
		expect(stats.total_clients).toBe(0);
	});

	it('should delete an agent', async () => {
		const deleted = await deleteAgent(db, 'agent-2');
		expect(deleted).toBe(true);
		const agent = await lookupAgent(db, 'agent-2');
		expect(agent).toBeNull();
	});

	it('should return false when deleting nonexistent agent', async () => {
		const deleted = await deleteAgent(db, 'nonexistent');
		expect(deleted).toBe(false);
	});
});

// ---------- AgentFacts Validation Tests ----------

describe('AgentFacts Validation', () => {
	const VALID_FACTS = {
		id: 'urn:agent:nanda:test-agent',
		agent_name: 'test-agent',
		label: 'Test Agent',
		description: 'A test agent',
		version: '1.0.0',
		provider: { name: 'TestCorp', did: 'did:web:testcorp.example' },
		endpoints: [{ url: 'https://agent.example.com' }],
		capabilities: ['text-generation'],
		skills: [{ id: 'chat', name: 'Chat' }]
	};

	it('should validate a complete AgentFacts document', () => {
		const errors = validateAgentFacts(VALID_FACTS);
		expect(errors).toEqual([]);
	});

	it('should report missing required fields', () => {
		const errors = validateAgentFacts({ id: 'test' });
		expect(errors.length).toBe(8); // missing 8 of 9 required fields
		expect(errors[0]).toContain('Missing required field');
	});

	it('should store and retrieve AgentFacts', async () => {
		await registerSignedAgent({ agent_id: 'facts-agent', agent_url: 'https://facts.example.com' });
		const result = await storeAgentFacts(db, 'facts-agent', VALID_FACTS);
		expect(result.ok).toBe(true);
		const facts = await getAgentFacts(db, 'facts-agent');
		expect(facts).not.toBeNull();
		expect(facts!.id).toBe('urn:agent:nanda:test-agent');
		expect(facts!.agent_name).toBe('test-agent');
	});

	it('should reject invalid AgentFacts on store', async () => {
		const result = await storeAgentFacts(db, 'facts-agent', { id: 'incomplete' });
		expect(result.ok).toBe(false);
		expect(result.errors!.length).toBeGreaterThan(0);
	});

	it('should return null for missing AgentFacts', async () => {
		const facts = await getAgentFacts(db, 'no-facts-agent');
		expect(facts).toBeNull();
	});
});

// ---------- HTTP Route Tests (via SELF) ----------

describe('Registry HTTP Routes', () => {
	it('GET /health returns 200 with agent count', async () => {
		const res = await SELF.fetch('https://fake.host/health');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('ok');
		expect(typeof body.agents).toBe('number');
	});

	it('POST /register creates an agent', async () => {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'http-agent', agent_url: 'https://http.example.com' })
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('success');
	});

	it('POST /register rejects missing fields', async () => {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'no-url' })
		});
		expect(res.status).toBe(400);
	});

	it('GET /lookup/:id returns registered agent', async () => {
		const res = await SELF.fetch('https://fake.host/lookup/http-agent');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.agent_id).toBe('http-agent');
	});

	it('GET /lookup/:id returns 404 for unknown', async () => {
		const res = await SELF.fetch('https://fake.host/lookup/ghost');
		expect(res.status).toBe(404);
	});

	it('GET /list returns flat dict', async () => {
		const res = await SELF.fetch('https://fake.host/list');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, string>;
		expect(body['http-agent']).toBe('https://http.example.com');
	});

	it('GET /search returns results', async () => {
		const res = await SELF.fetch('https://fake.host/search?q=http');
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body.length).toBeGreaterThan(0);
	});

	it('GET /stats returns counts', async () => {
		const res = await SELF.fetch('https://fake.host/stats');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, number>;
		expect(typeof body.total_agents).toBe('number');
	});

	it('PUT /agents/:id without auth returns 401', async () => {
		const res = await SELF.fetch('https://fake.host/agents/http-agent', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tags: ['updated'] })
		});
		expect(res.status).toBe(401);
	});

	it('PUT /agents/:id updates agent fields', async () => {
		// Re-register so we have an agent to update
		await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'http-agent', agent_url: 'https://http.example.com' })
		});

		const res = await SELF.fetch('https://fake.host/agents/http-agent', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`
			},
			body: JSON.stringify({ tags: ['updated-tag'] })
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.agent_id).toBe('http-agent');
	});

	it('PUT /agents/:id returns 404 for unknown agent', async () => {
		const res = await SELF.fetch('https://fake.host/agents/nonexistent-agent', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}`
			},
			body: JSON.stringify({ tags: ['x'] })
		});
		expect(res.status).toBe(404);
	});

	it('POST /agents/:id/refresh without auth returns 401', async () => {
		const res = await SELF.fetch('https://fake.host/agents/http-agent/refresh', {
			method: 'POST'
		});
		expect(res.status).toBe(401);
	});

	it('POST /agents/:id/refresh returns 404 for unknown agent', async () => {
		const res = await SELF.fetch('https://fake.host/agents/nonexistent-agent/refresh', {
			method: 'POST',
			headers: { Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}` }
		});
		expect(res.status).toBe(404);
	});

	it('DELETE /agents/:id deletes agent', async () => {
		const res = await SELF.fetch('https://fake.host/agents/http-agent', {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}` }
		});
		expect(res.status).toBe(200);
		const lookup = await SELF.fetch('https://fake.host/lookup/http-agent');
		expect(lookup.status).toBe(404);
	});

	it('returns error for unknown routes', async () => {
		const res = await SELF.fetch('https://fake.host/unknown');
		// SvelteKit returns 404 or 500 depending on error page availability
		expect([404, 500]).toContain(res.status);
	});
});

// ---------- A2A Protocol Tests ----------

describe('A2A Protocol Handler', () => {
	it('rejects non-JSON-RPC request', async () => {
		const res = await SELF.fetch('https://fake.host/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ not: 'jsonrpc' })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect((body.error as Record<string, unknown>).code).toBe(-32600);
	});

	it('starts certification via A2A start action', async () => {
		const res = await SELF.fetch('https://fake.host/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'message/send',
				id: 'test-1',
				params: {
					message: {
						role: 'user',
						parts: [{ text: JSON.stringify({ action: 'start', agent_id: 'a', capability: 'c' }) }]
					}
				}
			})
		});
		// cert.start runs trials inline — in test env without a real agent endpoint,
		// the trial processing may fail with a catch-wrapped error (400) or succeed (200).
		expect([200, 400]).toContain(res.status);
		const body = (await res.json()) as Record<string, unknown>;
		if (res.status === 200) {
			const resultText = (
				(body.result as Record<string, unknown>).parts as Array<Record<string, string>>
			)[0].text;
			const parsed = JSON.parse(resultText);
			expect(parsed.status).toBe('running');
			expect(typeof parsed.job_id).toBe('string');
		} else {
			// In test env, trial processing fails because agent URL is unreachable
			expect(body.error).toBeDefined();
		}
	});

	it('rejects unknown action', async () => {
		const res = await SELF.fetch('https://fake.host/a2a', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'message/send',
				id: 'test-2',
				params: {
					message: { role: 'user', parts: [{ text: JSON.stringify({ action: 'nope' }) }] }
				}
			})
		});
		expect(res.status).toBe(400);
	});
});

// ---------- Revocation List Endpoint Tests ----------

describe('Revocation List Endpoint', () => {
	it('GET /credentials/status/1 returns valid StatusList2021Credential', async () => {
		const res = await SELF.fetch('https://fake.host/credentials/status/1');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body['@context']).toBeDefined();
		expect(body.type).toContain('VerifiableCredential');
		expect(body.type).toContain('StatusList2021Credential');
		expect(body.id).toBeDefined();
		expect(body.issuer).toBeDefined();
		expect(body.issuanceDate).toBeDefined();
		// credentialSubject should contain the encoded list
		const subject = body.credentialSubject as Record<string, unknown>;
		expect(subject.type).toBe('StatusList2021');
		expect(subject.statusPurpose).toBe('revocation');
		expect(typeof subject.encodedList).toBe('string');
		// Cache header should be present
		expect(res.headers.get('Cache-Control')).toContain('public');
	});
});

// ---------- Federation Route Tests ----------

describe('Federation Routes', () => {
	// v1 sync endpoints (/federation/sync, /federation/sync-peer) removed — gossip only

	it('GET /federation/agents returns agent list', async () => {
		const res = await SELF.fetch('https://fake.host/federation/agents', {
			headers: { Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}` }
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(typeof body.count).toBe('number');
		expect(Array.isArray(body.agents)).toBe(true);
	});

	it('GET /federation/status returns status object', async () => {
		const res = await SELF.fetch('https://fake.host/federation/status', {
			headers: { Authorization: `Bearer ${env.NANDA_FEDERATION_ADMIN_KEY}` }
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toHaveProperty('configured_peer');
		expect(body).toHaveProperty('peers');
	});

	it('GET /federation/unknown returns error', async () => {
		const res = await SELF.fetch('https://fake.host/federation/unknown');
		// SvelteKit returns 404 or 500 depending on error page availability
		expect([404, 500]).toContain(res.status);
	});
});

// ---------- Input Validation Tests ----------

describe('Register Input Validation', () => {
	it('POST /register rejects non-string agent_id', async () => {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: { nested: 'obj' }, agent_url: 'https://x.com' })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toContain('string');
	});

	it('POST /register rejects non-array capabilities', async () => {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent_id: 'val-agent',
				agent_url: 'https://x.com',
				capabilities: 'not-array'
			})
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toContain('capabilities');
	});

	it('POST /register rejects non-string items in tags', async () => {
		const res = await SELF.fetch('https://fake.host/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: 'val-agent', agent_url: 'https://x.com', tags: [123, true] })
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toContain('tags');
	});
});
