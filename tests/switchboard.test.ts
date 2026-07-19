/**
 * Switchboard Tests — Protocol Detection, Adapters, Orchestrator, SSRF, Skill Mapper
 * Phase 6 — Agent California (15+ tests)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { isSafeUrl } from '../src/lib/services/switchboard/protocol-detector';
import { A2AAdapter } from '../src/lib/services/switchboard/a2a-adapter';
import { McpAdapter } from '../src/lib/services/switchboard/mcp-adapter';
import { NLWebAdapter } from '../src/lib/services/switchboard/nlweb-adapter';
import { SwitchboardService } from '../src/lib/services/switchboard';
import { SkillMapper } from '../src/lib/services/switchboard/skill-mapper';
import type { A2AAgentCard, McpDescriptor, NLWebDescriptor } from '../src/lib/types/switchboard';
import type { AgentFactsV2Placeholder } from '../src/lib/types/resolver';

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

const TABLES = [
	`CREATE TABLE IF NOT EXISTS protocol_adapters (
    id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, protocol TEXT NOT NULL,
    detected_at INTEGER DEFAULT (unixepoch()), metadata_json TEXT, last_synced_at INTEGER)`,
	`CREATE INDEX IF NOT EXISTS idx_pa_agent ON protocol_adapters(agent_id)`,
	`CREATE INDEX IF NOT EXISTS idx_pa_protocol ON protocol_adapters(protocol)`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));
});

// ── SSRF Protection ──

describe('SSRF Protection (isSafeUrl)', () => {
	it('should block localhost', () => {
		expect(isSafeUrl('http://localhost:8080')).toBe(false);
	});

	it('should block private IPs (10.x)', () => {
		expect(isSafeUrl('http://10.0.0.1/api')).toBe(false);
	});

	it('should block private IPs (192.168.x)', () => {
		expect(isSafeUrl('http://192.168.1.1')).toBe(false);
	});

	it('should block private IPs (172.16-31.x)', () => {
		expect(isSafeUrl('http://172.16.0.1')).toBe(false);
	});

	it('should allow public HTTPS URLs', () => {
		expect(isSafeUrl('https://api.example.com')).toBe(true);
	});

	it('should block non-HTTPS in production', () => {
		expect(isSafeUrl('http://api.example.com', 'production')).toBe(false);
	});

	it('should allow HTTP in development', () => {
		expect(isSafeUrl('http://api.example.com', 'development')).toBe(true);
	});

	it('should block non-HTTP schemes', () => {
		expect(isSafeUrl('ftp://files.example.com')).toBe(false);
		expect(isSafeUrl('file:///etc/passwd')).toBe(false);
	});

	it('should block IPv6 loopback', () => {
		expect(isSafeUrl('http://[::1]:8080')).toBe(false);
	});
});

// ── A2A Adapter ──

describe('A2AAdapter', () => {
	const adapter = new A2AAdapter();

	it('should have correct registryId', () => {
		expect(adapter.registryId).toBe('a2a');
	});

	it('should translate A2A card to NANDA facts', () => {
		const card: A2AAgentCard = {
			name: 'TestAgent',
			description: 'A test agent',
			version: '1.0.0',
			protocolVersions: ['1.0'],
			supportedInterfaces: [
				{
					url: 'https://agent.example.com/a2a',
					protocolBinding: 'HTTP+JSON',
					protocolVersion: '1.0'
				}
			],
			defaultInputModes: ['application/json'],
			defaultOutputModes: ['application/json'],
			capabilities: {
				streaming: false,
				pushNotifications: false,
				stateTransitionHistory: false,
				extendedAgentCard: false
			},
			skills: [{ id: 'chat', name: 'Chat', description: 'Chat skill' }]
		};
		const facts = adapter.translateToNanda(card);
		expect(facts.agent_name).toBe('TestAgent');
		expect(facts.skills).toHaveLength(1);
		expect(facts.skills![0].id).toBe('chat');
		expect(facts.endpoints?.static).toHaveLength(1);
	});

	it('should translate NANDA facts to A2A card', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'ExportAgent',
			description: 'Exported agent',
			version: '2.0.0',
			skills: [{ id: 'code', name: 'Code', description: 'Code generation' }],
			endpoints: { static: [{ url: 'https://agent.example.com', protocol: 'a2a' }] }
		};
		const card = adapter.translateFromNanda(facts) as A2AAgentCard;
		expect(card.name).toBe('ExportAgent');
		expect(card.version).toBe('2.0.0');
		expect(card.skills).toHaveLength(1);
		expect(card.supportedInterfaces).toHaveLength(1);
	});

	it('should return adapter info', () => {
		const info = adapter.getRegistryInfo();
		expect(info.registryId).toBe('a2a');
		expect(info.status).toBe('active');
		expect(info.supportedProtocols).toContain('a2a');
	});

	it('should block SSRF in queryAgent', async () => {
		const result = await adapter.queryAgent('http://localhost:8080');
		expect(result).toBeNull();
	});
});

// ── MCP Adapter ──

describe('McpAdapter', () => {
	const adapter = new McpAdapter();

	it('should have correct registryId', () => {
		expect(adapter.registryId).toBe('mcp');
	});

	it('should translate MCP descriptor to NANDA facts', () => {
		const desc: McpDescriptor = {
			name: 'TestMCP',
			version: '1.0.0',
			transport: 'streamable-http',
			endpoint: 'https://mcp.example.com/mcp',
			tools: [
				{ name: 'lookup', description: 'Look up data', inputSchema: { type: 'object' } },
				{ name: 'search', description: 'Search data', inputSchema: { type: 'object' } }
			]
		};
		const facts = adapter.translateToNanda(desc);
		expect(facts.agent_name).toBe('TestMCP');
		expect(facts.skills).toHaveLength(2);
		expect(facts.endpoints?.static?.[0].protocol).toBe('mcp');
	});

	it('should translate NANDA facts to MCP descriptor', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'ExportMCP',
			version: '2.0.0',
			skills: [{ id: 'tool1', name: 'Tool 1', description: 'First tool' }],
			endpoints: { static: [{ url: 'https://mcp.example.com/mcp', protocol: 'mcp' }] }
		};
		const desc = adapter.translateFromNanda(facts) as McpDescriptor;
		expect(desc.name).toBe('ExportMCP');
		expect(desc.tools).toHaveLength(1);
		expect(desc.transport).toBe('streamable-http');
	});

	it('should block SSRF in queryAgent', async () => {
		const result = await adapter.queryAgent('http://10.0.0.1');
		expect(result).toBeNull();
	});
});

// ── NLWeb Adapter ──

describe('NLWebAdapter', () => {
	const adapter = new NLWebAdapter();

	it('should have correct registryId', () => {
		expect(adapter.registryId).toBe('nlweb');
	});

	it('should translate NLWeb descriptor to NANDA facts', () => {
		const desc: NLWebDescriptor = {
			url: 'https://nlweb.example.com',
			schemaOrgTypes: ['SoftwareApplication', 'WebAPI'],
			capabilities: ['search', 'query']
		};
		const facts = adapter.translateToNanda(desc);
		expect(facts.agent_name).toBe('nlweb.example.com');
		expect(facts.capabilities?.modalities).toContain('SoftwareApplication');
		expect(facts.skills).toHaveLength(2);
	});

	it('should translate NANDA facts to NLWeb descriptor', () => {
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'test',
			capabilities: { modalities: ['WebAPI'] },
			skills: [{ id: 'search' }],
			endpoints: { static: [{ url: 'https://nlweb.example.com', protocol: 'nlweb' }] }
		};
		const desc = adapter.translateFromNanda(facts) as NLWebDescriptor;
		expect(desc.url).toBe('https://nlweb.example.com');
		expect(desc.schemaOrgTypes).toContain('WebAPI');
	});
});

// ── Skill Mapper ──

describe('SkillMapper', () => {
	it('should load taxonomy data', () => {
		const mapper = new SkillMapper();
		mapper.loadFromData(
			{ nlp: { caption: 'Natural Language Processing', uid: 100 } },
			{
				natural_language_generation: {
					name: 'natural_language_generation',
					caption: 'NLG',
					uid: 101,
					extends: 'nlp'
				},
				text_summarization: {
					name: 'text_summarization',
					caption: 'Text Summarization',
					uid: 102,
					extends: 'nlp'
				}
			}
		);
		expect(mapper.isLoaded).toBe(true);
		expect(mapper.skillCount).toBe(2);
		expect(mapper.leafSkillCount).toBe(2);
	});

	it('should map exact skill name', () => {
		const mapper = new SkillMapper();
		mapper.loadFromData(
			{},
			{
				text_summarization: {
					name: 'text_summarization',
					caption: 'Text Summarization',
					uid: 102,
					extends: 'base_skill'
				}
			}
		);
		const result = mapper.mapCapability('text_summarization');
		expect(result).not.toBeNull();
		expect(result!.skill_id).toBe('text_summarization');
	});

	it('should fuzzy match chat → natural_language_generation', () => {
		const mapper = new SkillMapper();
		mapper.loadFromData(
			{},
			{
				natural_language_generation: {
					name: 'natural_language_generation',
					caption: 'NLG',
					uid: 101,
					extends: 'base_skill'
				}
			}
		);
		const result = mapper.mapCapability('chat');
		expect(result).not.toBeNull();
		expect(result!.skill_id).toBe('natural_language_generation');
	});

	it('should return null for unknown capability', () => {
		const mapper = new SkillMapper();
		mapper.loadFromData({}, {});
		const result = mapper.mapCapability('quantum_computing');
		expect(result).toBeNull();
	});

	it('should normalize capability names (spaces, dashes)', () => {
		const mapper = new SkillMapper();
		mapper.loadFromData(
			{},
			{
				code_generation: {
					name: 'code_generation',
					caption: 'Code Generation',
					uid: 200,
					extends: 'base_skill'
				}
			}
		);
		// Fuzzy match via 'code' rule
		const r1 = mapper.mapCapability('code-gen');
		expect(r1).not.toBeNull();
		const r2 = mapper.mapCapability('code generation');
		expect(r2).not.toBeNull();
	});
});

// ── Switchboard Service ──

describe('SwitchboardService', () => {
	it('should list available adapters', () => {
		const db = createDbClient(env.DB);
		const service = new SwitchboardService(db);
		const adapters = service.getAvailableAdapters();
		expect(adapters).toHaveLength(3);
		expect(adapters.map((a) => a.registryId)).toContain('a2a');
		expect(adapters.map((a) => a.registryId)).toContain('mcp');
		expect(adapters.map((a) => a.registryId)).toContain('nlweb');
	});

	it('should export AgentFacts as A2A card', () => {
		const db = createDbClient(env.DB);
		const service = new SwitchboardService(db);
		const facts: AgentFactsV2Placeholder = {
			agent_name: 'ExportTest',
			skills: [{ id: 'test-skill' }],
			endpoints: { static: [{ url: 'https://test.com', protocol: 'a2a' }] }
		};
		const card = service.exportAs(facts, 'a2a') as A2AAgentCard;
		expect(card.name).toBe('ExportTest');
		expect(card.skills).toHaveLength(1);
	});

	it('should throw for unknown protocol export', () => {
		const db = createDbClient(env.DB);
		const service = new SwitchboardService(db);
		const facts: AgentFactsV2Placeholder = { agent_name: 'test' };
		expect(() => service.exportAs(facts, 'agntcy')).toThrow('No adapter registered');
	});

	it('should block SSRF in autoRegister', async () => {
		const db = createDbClient(env.DB);
		const service = new SwitchboardService(db);
		const result = await service.autoRegister('http://192.168.1.1');
		expect(result).toBeNull();
	});
});

// ── Lane C HTTP Auth Matrix ──────────────────────────────────────
//
// /api/switchboard/discover, /export, /resync are tightened to
// requireApiKeyOrAdmin because they trigger outbound HTTP probes or
// re-export metadata. Anonymous callers must be rejected with 401; a
// bare session without apikey/admin must be rejected with 403. Apikey
// callers should pass the guard (downstream errors are out of scope).

const SWITCHBOARD_API_KEY_RAW = 'nanda_test_switchboard_key_abcdef0123456789';

async function sha256Hex(data: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

describe('Switchboard Lane C auth matrix', () => {
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

		const keyHash = await sha256Hex(SWITCHBOARD_API_KEY_RAW);
		await env.DB.prepare(
			`INSERT OR IGNORE INTO developer_keys (id, key_hash, key_prefix, name, owner_id, owner_email, status, tier, rate_limit_monthly, usage_count_monthly, usage_reset_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'active', 'free', 1000, 0, ?)`
		)
			.bind(
				'sb-auth-key-1',
				keyHash,
				SWITCHBOARD_API_KEY_RAW.slice(0, 12),
				'Switchboard Auth Test',
				'user-sb-auth',
				'sb-auth@test.com',
				Math.floor(Date.now() / 1000) + 86400 * 30
			)
			.run();
	});

	const endpoints = [
		{
			name: 'discover',
			path: '/api/switchboard/discover',
			body: { url: 'https://example.com' }
		},
		{
			name: 'export',
			path: '/api/switchboard/export',
			body: { agent_id: 'does-not-exist', target_protocol: 'a2a' }
		},
		{ name: 'resync', path: '/api/switchboard/resync', body: { agent_id: 'does-not-exist' } }
	] as const;

	for (const ep of endpoints) {
		it(`${ep.name}: rejects anonymous with 401`, async () => {
			const res = await SELF.fetch(`https://fake.host${ep.path}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'CF-Connecting-IP': '10.0.9.1'
				},
				body: JSON.stringify(ep.body)
			});
			expect(res.status).toBe(401);
		});

		it(`${ep.name}: rejects invalid bearer with 401`, async () => {
			const res = await SELF.fetch(`https://fake.host${ep.path}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					Authorization: 'Bearer nanda_not_a_real_key_xxxxxxxxxxxx',
					'CF-Connecting-IP': '10.0.9.2'
				},
				body: JSON.stringify(ep.body)
			});
			expect(res.status).toBe(401);
		});

		it(`${ep.name}: accepts valid developer API key (not 401/403)`, async () => {
			const res = await SELF.fetch(`https://fake.host${ep.path}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					Authorization: `Bearer ${SWITCHBOARD_API_KEY_RAW}`,
					'CF-Connecting-IP': '10.0.9.3'
				},
				body: JSON.stringify(ep.body)
			});
			// The handler may return 400/404/500 because of the synthetic body,
			// but the Lane C guard must not reject the call.
			expect(res.status).not.toBe(401);
			expect(res.status).not.toBe(403);
		});
	}

	it('adapters: rejects anonymous with 401 (Lane C requireAuthenticated)', async () => {
		const res = await SELF.fetch('https://fake.host/api/switchboard/adapters/anything', {
			headers: { Accept: 'application/json', 'CF-Connecting-IP': '10.0.9.4' }
		});
		expect(res.status).toBe(401);
	});

	it('adapters: accepts valid developer API key', async () => {
		const res = await SELF.fetch('https://fake.host/api/switchboard/adapters/anything', {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${SWITCHBOARD_API_KEY_RAW}`,
				'CF-Connecting-IP': '10.0.9.5'
			}
		});
		expect(res.status).not.toBe(401);
		expect(res.status).not.toBe(403);
	});
});
