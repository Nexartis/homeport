/**
 * Deprecation Tests — service layer + repository queries
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import {
	validateDeprecation,
	deprecateAgent,
	tombstoneAgent,
	listDeprecatedAgents,
	sweepSunsetAgents
} from '../src/lib/services/deprecation/service';
import {
	getDeprecatedAgents,
	getSunsetExpiredAgents,
	getAgentDeprecationInfo,
	getDeprecatedAndTombstonedAgents,
	markAgentDeprecated,
	tombstoneAgentRecord
} from '../src/lib/db/repositories/deprecation';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
	}
}

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL, signature_hex TEXT NOT NULL,
    signer_id TEXT NOT NULL, facts_url TEXT, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
    agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT, status TEXT DEFAULT 'alive',
    version TEXT DEFAULT '1.0.0', deprecated_at INTEGER, sunset_at INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()))`;

// ALTER TABLE fallbacks in case another test file already created the table without these columns
const ALTER_COLUMNS: string[] = [
	// version, deprecated_at, sunset_at are already in agent_addrs table
];

const SEED_AGENTS = [
	`INSERT OR REPLACE INTO agent_addrs (agent_id, agent_url, status, version, public_key_hex, signature_hex, signer_id) VALUES ('agent-alive', 'https://alive.example.com', 'alive', '1.0.0', 'test', 'test', 'test')`,
	`INSERT OR REPLACE INTO agent_addrs (agent_id, agent_url, status, version, deprecated_at, sunset_at, public_key_hex, signature_hex, signer_id) VALUES ('agent-dep', 'https://dep.example.com', 'deprecated', '1.2.0', ${Math.floor(Date.now() / 1000) - 86400 * 10}, ${Math.floor(Date.now() / 1000) + 86400 * 20}, 'test', 'test', 'test')`,
	`INSERT OR REPLACE INTO agent_addrs (agent_id, agent_url, status, version, deprecated_at, sunset_at, public_key_hex, signature_hex, signer_id) VALUES ('agent-expired', 'https://expired.example.com', 'deprecated', '0.9.0', ${Math.floor(Date.now() / 1000) - 86400 * 40}, ${Math.floor(Date.now() / 1000) - 86400 * 1}, 'test', 'test', 'test')`,
	`INSERT OR REPLACE INTO agent_addrs (agent_id, agent_url, status, version, public_key_hex, signature_hex, signer_id) VALUES ('agent-tomb', 'https://tomb.example.com', 'tombstoned', '0.5.0', 'test', 'test', 'test')`
];

beforeAll(async () => {
	await env.DB.prepare(CREATE_TABLE).run();
	// Add columns if table was already created by another test file without them
	for (const ddl of ALTER_COLUMNS) {
		try {
			await env.DB.prepare(ddl).run();
		} catch {
			// Column already exists — expected
		}
	}
});

beforeEach(async () => {
	// Delete child tables referencing agents first to avoid FK constraint errors
	// Tables from other test suites may not exist, so delete individually
	for (const tbl of ['agent_facts', 'clients', 'agent_versions', 'agent_addrs']) {
		try {
			await env.DB.prepare(`DELETE FROM ${tbl}`).run();
		} catch {
			/* table may not exist */
		}
	}
	await env.DB.batch(SEED_AGENTS.map((sql) => env.DB.prepare(sql)));
});

const db = createDbClient(env.DB);

// ---------- Validation ----------

describe('validateDeprecation', () => {
	it('allows deprecation of alive agent', () => {
		expect(validateDeprecation('alive')).toEqual({ valid: true });
	});

	it('allows deprecation of already-deprecated agent (extend)', () => {
		expect(validateDeprecation('deprecated')).toEqual({ valid: true });
	});

	it('rejects deprecation of tombstoned agent', () => {
		const result = validateDeprecation('tombstoned');
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('tombstoned');
	});

	it('rejects unknown status', () => {
		const result = validateDeprecation('unknown');
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('Unexpected');
	});
});

// ---------- Repository ----------

describe('Deprecation Repository', () => {
	it('getDeprecatedAgents returns only deprecated agents', async () => {
		const rows = await getDeprecatedAgents(db);
		expect(rows.length).toBe(2); // agent-dep + agent-expired
		for (const r of rows) {
			expect(r.status).toBe('deprecated');
		}
	});

	it('getSunsetExpiredAgents returns only past-sunset agents', async () => {
		const rows = await getSunsetExpiredAgents(db);
		expect(rows.length).toBe(1);
		expect(rows[0].agentId).toBe('agent-expired');
	});

	it('getAgentDeprecationInfo returns info for existing agent', async () => {
		const info = await getAgentDeprecationInfo(db, 'agent-dep');
		expect(info).not.toBeNull();
		expect(info!.status).toBe('deprecated');
		expect(info!.version).toBe('1.2.0');
	});

	it('getAgentDeprecationInfo returns null for non-existent agent', async () => {
		const info = await getAgentDeprecationInfo(db, 'nonexistent');
		expect(info).toBeNull();
	});

	it('getDeprecatedAndTombstonedAgents returns both types', async () => {
		const rows = await getDeprecatedAndTombstonedAgents(db);
		expect(rows.length).toBe(3); // agent-dep + agent-expired + agent-tomb
		const statuses = rows.map((r) => r.status);
		expect(statuses).toContain('deprecated');
		expect(statuses).toContain('tombstoned');
	});

	it('markAgentDeprecated updates status and timestamps', async () => {
		const now = Math.floor(Date.now() / 1000);
		const sunset = now + 86400 * 30;
		await markAgentDeprecated(db, 'agent-alive', now, sunset);

		const info = await getAgentDeprecationInfo(db, 'agent-alive');
		expect(info!.status).toBe('deprecated');
		expect(info!.deprecatedAt).toBe(now);
		expect(info!.sunsetAt).toBe(sunset);
	});

	it('tombstoneAgentRecord sets status to tombstoned', async () => {
		await tombstoneAgentRecord(db, 'agent-dep');
		const info = await getAgentDeprecationInfo(db, 'agent-dep');
		expect(info!.status).toBe('tombstoned');
	});
});

// ---------- Service Layer ----------

describe('Deprecation Service', () => {
	it('deprecateAgent succeeds for alive agent', async () => {
		const result = await deprecateAgent(db, {
			agentId: 'agent-alive',
			reason: 'End of life',
			gracePeriodDays: 30,
			notifyConsumers: false
		});
		expect(result.success).toBe(true);
		expect(result.agentId).toBe('agent-alive');
		expect(result.deprecatedAt).toBeGreaterThan(0);
		expect(result.sunsetAt).toBeGreaterThan(result.deprecatedAt);
	});

	it('deprecateAgent fails for tombstoned agent', async () => {
		const result = await deprecateAgent(db, {
			agentId: 'agent-tomb',
			reason: 'Already dead',
			gracePeriodDays: 30,
			notifyConsumers: false
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain('tombstoned');
	});

	it('deprecateAgent returns error for non-existent agent', async () => {
		const result = await deprecateAgent(db, {
			agentId: 'nonexistent',
			reason: 'Test',
			gracePeriodDays: 30,
			notifyConsumers: false
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain('not found');
	});

	it('tombstoneAgent succeeds for deprecated agent whose sunset has passed', async () => {
		const result = await tombstoneAgent(db, 'agent-expired');
		expect(result.success).toBe(true);

		const info = await getAgentDeprecationInfo(db, 'agent-expired');
		expect(info!.status).toBe('tombstoned');
	});

	it('tombstoneAgent rejects deprecated agent whose sunset has not passed', async () => {
		const result = await tombstoneAgent(db, 'agent-dep');
		expect(result.success).toBe(false);
		expect(result.error).toContain('Sunset date has not passed');
	});

	it('tombstoneAgent is idempotent for already tombstoned agent', async () => {
		const result = await tombstoneAgent(db, 'agent-tomb');
		expect(result.success).toBe(true);
	});

	it('tombstoneAgent fails for alive agent', async () => {
		const result = await tombstoneAgent(db, 'agent-alive');
		expect(result.success).toBe(false);
		expect(result.error).toContain('deprecated before');
	});

	it('listDeprecatedAgents returns deprecated and tombstoned', async () => {
		const list = await listDeprecatedAgents(db);
		expect(list.length).toBe(3);
	});

	it('sweepSunsetAgents tombstones only expired agents', async () => {
		const { tombstoned } = await sweepSunsetAgents(db);
		expect(tombstoned).toContain('agent-expired');
		expect(tombstoned).not.toContain('agent-dep'); // not expired yet

		// Verify the agent is now tombstoned
		const info = await getAgentDeprecationInfo(db, 'agent-expired');
		expect(info!.status).toBe('tombstoned');
	});
});
