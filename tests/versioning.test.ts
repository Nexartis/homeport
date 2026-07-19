/**
 * Versioning Tests — service layer + repository queries
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import {
	parseVersionedId,
	createVersion,
	listVersions,
	getVersion,
	getActiveVersions,
	resolveAgentAddress
} from '../src/lib/services/versioning/service';
import {
	insertAgentVersion,
	getAgentVersion,
	listAgentVersions,
	updateVersionStatus,
	getActiveVersions as repoGetActiveVersions
} from '../src/lib/db/repositories/versioning';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const CREATE_AGENTS = `CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL, signature_hex TEXT NOT NULL,
    signer_id TEXT NOT NULL, facts_url TEXT, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
    agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT, status TEXT DEFAULT 'alive',
    version TEXT DEFAULT '1.0.0', deprecated_at INTEGER, sunset_at INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()))`;

const CREATE_VERSIONS = `CREATE TABLE IF NOT EXISTS agent_versions (
	id TEXT PRIMARY KEY,
	agent_id TEXT NOT NULL,
	version TEXT NOT NULL,
	agent_url TEXT NOT NULL,
	api_url TEXT,
	facts_url TEXT,
	capabilities TEXT,
	changelog TEXT,
	status TEXT DEFAULT 'alive',
	created_at INTEGER DEFAULT (unixepoch()),
	deprecated_at INTEGER,
	sunset_at INTEGER)`;

const CREATE_IDX = `CREATE UNIQUE INDEX IF NOT EXISTS idx_av_agent_version ON agent_versions (agent_id, version)`;
const CREATE_STATUS_IDX = `CREATE INDEX IF NOT EXISTS idx_av_agent_status ON agent_versions (agent_id, status)`;

// ALTER TABLE fallbacks
const ALTER_COLUMNS = [
	// version, deprecated_at are already in agent_addrs table
	`ALTER TABLE agents ADD COLUMN sunset_at INTEGER`
];

const SEED = `INSERT OR REPLACE INTO agent_addrs (agent_id, agent_url, version, public_key_hex, signature_hex, signer_id) VALUES ('agent-a', 'https://a.example.com', '1.0.0', 'test', 'test', 'test')`;

beforeAll(async () => {
	await env.DB.batch(
		[CREATE_AGENTS, CREATE_VERSIONS, CREATE_IDX, CREATE_STATUS_IDX].map((s) => env.DB.prepare(s))
	);
	for (const alter of ALTER_COLUMNS) {
		try {
			await env.DB.prepare(alter).run();
		} catch {
			/* exists */
		}
	}
});

beforeEach(async () => {
	// Delete child tables referencing agents first to avoid FK constraint errors
	// Tables from other test suites may not exist, so delete individually
	for (const tbl of ['agent_facts', 'clients', 'agent_addrs', 'agent_versions']) {
		try {
			await env.DB.prepare(`DELETE FROM ${tbl}`).run();
		} catch {
			/* table may not exist */
		}
	}
	await env.DB.prepare(SEED).run();
});

const db = createDbClient(env.DB);

// ---------- parseVersionedId ----------

describe('parseVersionedId', () => {
	it('parses plain agent ID', () => {
		const r = parseVersionedId('agent-a');
		expect(r.agentId).toBe('agent-a');
		expect(r.version).toBeUndefined();
	});

	it('parses versioned agent ID', () => {
		const r = parseVersionedId('agent-a@1.2.0');
		expect(r.agentId).toBe('agent-a');
		expect(r.version).toBe('1.2.0');
	});

	it('returns full string when @ is first char', () => {
		const r = parseVersionedId('@1.2.0');
		expect(r.agentId).toBe('@1.2.0');
		expect(r.version).toBeUndefined();
	});

	it('returns full string when version has no dot', () => {
		const r = parseVersionedId('agent-a@beta');
		expect(r.agentId).toBe('agent-a@beta');
		expect(r.version).toBeUndefined();
	});
});

// ---------- Repository Layer ----------

describe('Versioning Repository', () => {
	it('insertAgentVersion creates a record', async () => {
		const record = await insertAgentVersion(db, {
			id: 'v-1',
			agentId: 'agent-a',
			version: '1.0.0',
			agentUrl: 'https://a.example.com',
			status: 'alive'
		});
		expect(record.id).toBe('v-1');
		expect(record.version).toBe('1.0.0');
	});

	it('getAgentVersion returns specific version', async () => {
		await insertAgentVersion(db, {
			id: 'v-2',
			agentId: 'agent-a',
			version: '2.0.0',
			agentUrl: 'https://a.example.com/v2',
			status: 'alive'
		});
		const r = await getAgentVersion(db, 'agent-a', '2.0.0');
		expect(r).not.toBeNull();
		expect(r!.agentUrl).toBe('https://a.example.com/v2');
	});

	it('getAgentVersion returns null for missing version', async () => {
		const r = await getAgentVersion(db, 'agent-a', '9.9.9');
		expect(r).toBeNull();
	});

	it('listAgentVersions returns newest first', async () => {
		await insertAgentVersion(db, {
			id: 'v-old',
			agentId: 'agent-a',
			version: '1.0.0',
			agentUrl: 'https://a.example.com',
			status: 'alive'
		});
		// Small delay to ensure different timestamps
		await insertAgentVersion(db, {
			id: 'v-new',
			agentId: 'agent-a',
			version: '2.0.0',
			agentUrl: 'https://a.example.com/v2',
			status: 'alive'
		});
		const list = await listAgentVersions(db, 'agent-a');
		expect(list.length).toBe(2);
	});

	it('updateVersionStatus changes status', async () => {
		await insertAgentVersion(db, {
			id: 'v-dep',
			agentId: 'agent-a',
			version: '1.0.0',
			agentUrl: 'https://a.example.com',
			status: 'alive'
		});
		const now = Math.floor(Date.now() / 1000);
		await updateVersionStatus(db, 'v-dep', 'deprecated', now, now + 86400 * 30);
		const r = await getAgentVersion(db, 'agent-a', '1.0.0');
		expect(r!.status).toBe('deprecated');
	});

	it('getActiveVersions returns only alive versions', async () => {
		await insertAgentVersion(db, {
			id: 'v-a1',
			agentId: 'agent-a',
			version: '1.0.0',
			agentUrl: 'https://a.example.com',
			status: 'alive'
		});
		await insertAgentVersion(db, {
			id: 'v-a2',
			agentId: 'agent-a',
			version: '2.0.0',
			agentUrl: 'https://a.example.com/v2',
			status: 'deprecated'
		});
		const active = await repoGetActiveVersions(db, 'agent-a');
		expect(active.length).toBe(1);
		expect(active[0].version).toBe('1.0.0');
	});
});

// ---------- Service Layer ----------

describe('Versioning Service', () => {
	it('createVersion inserts a version and updates main agent', async () => {
		const ver = await createVersion(db, 'agent-a', '2.0.0', {
			agentUrl: 'https://a.example.com/v2',
			changelog: 'Major rewrite'
		});
		expect(ver.agentId).toBe('agent-a');
		expect(ver.version).toBe('2.0.0');
		expect(ver.status).toBe('alive');
		expect(ver.changelog).toBe('Major rewrite');
	});

	it('createVersion throws for non-existent agent', async () => {
		await expect(
			createVersion(db, 'nonexistent', '1.0.0', { agentUrl: 'https://x.com' })
		).rejects.toThrow('Agent not found');
	});

	it('createVersion throws for duplicate version', async () => {
		await createVersion(db, 'agent-a', '1.0.0', { agentUrl: 'https://a.example.com' });
		await expect(
			createVersion(db, 'agent-a', '1.0.0', { agentUrl: 'https://a.example.com' })
		).rejects.toThrow('already exists');
	});

	it('listVersions returns all versions for agent', async () => {
		await createVersion(db, 'agent-a', '1.0.0', { agentUrl: 'https://a.example.com' });
		await createVersion(db, 'agent-a', '2.0.0', { agentUrl: 'https://a.example.com/v2' });
		const list = await listVersions(db, 'agent-a');
		expect(list.length).toBe(2);
	});

	it('getVersion returns specific version', async () => {
		await createVersion(db, 'agent-a', '3.0.0', { agentUrl: 'https://a.example.com/v3' });
		const ver = await getVersion(db, 'agent-a', '3.0.0');
		expect(ver).not.toBeNull();
		expect(ver!.agentUrl).toBe('https://a.example.com/v3');
	});

	it('getVersion returns null for missing version', async () => {
		const ver = await getVersion(db, 'agent-a', '99.0.0');
		expect(ver).toBeNull();
	});

	it('getActiveVersions filters out deprecated', async () => {
		const v1 = await createVersion(db, 'agent-a', '1.0.0', { agentUrl: 'https://a.example.com' });
		await createVersion(db, 'agent-a', '2.0.0', { agentUrl: 'https://a.example.com/v2' });
		// Deprecate v1
		await updateVersionStatus(db, v1.id, 'deprecated');
		const active = await getActiveVersions(db, 'agent-a');
		expect(active.length).toBe(1);
		expect(active[0].version).toBe('2.0.0');
	});

	it('resolveAgentAddress returns current agent for plain ID', async () => {
		const result = await resolveAgentAddress(db, 'agent-a');
		expect(result).not.toBeNull();
		expect(result!.agentId).toBe('agent-a');
		expect(result!.version).toBe('1.0.0');
		expect(result!.url).toBe('https://a.example.com');
	});

	it('resolveAgentAddress returns versioned record for ID@version', async () => {
		await createVersion(db, 'agent-a', '2.0.0', { agentUrl: 'https://a.example.com/v2' });
		const result = await resolveAgentAddress(db, 'agent-a@2.0.0');
		expect(result).not.toBeNull();
		expect(result!.version).toBe('2.0.0');
		expect(result!.url).toBe('https://a.example.com/v2');
	});

	it('resolveAgentAddress returns null for missing agent', async () => {
		const result = await resolveAgentAddress(db, 'nonexistent');
		expect(result).toBeNull();
	});

	it('resolveAgentAddress returns null for missing version', async () => {
		const result = await resolveAgentAddress(db, 'agent-a@99.0.0');
		expect(result).toBeNull();
	});
});
