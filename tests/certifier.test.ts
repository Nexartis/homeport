/**
 * Certifier Tests — Wilson CI, grading, HMAC signing, job lifecycle, certificate issuance
 * Uses @cloudflare/vitest-pool-workers with real local D1 + R2 bindings.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env } from 'cloudflare:test';
import {
	wilsonCI,
	grade,
	gradeItem,
	signCertHMAC,
	startCertification,
	getJobStatus,
	getCertificate,
	completeJob
} from '../src/lib/services/certifier/service';
import { processCertBatch, pickTestCase } from '../src/lib/services/certifier/queue-handler';
import {
	revokeCertificate,
	isRevoked,
	getRevocationList
} from '../src/lib/services/certifier/revocation';
import { createDbClient } from '../src/lib/db/client';
import type { CertJobMessage } from '../src/lib/types';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		KYM_NANDA_HMAC_SECRET: string;
		KYM_NANDA_ED25519_PRIVATE_KEY_v1: string;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
		NANDA_ED25519_PUBLIC_KEY_v1: string;
	}
}

// D1 table setup — matches sql/schema.sql exactly
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
	`CREATE TABLE IF NOT EXISTS trial_results (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES cert_jobs(job_id),
    trial_num INTEGER NOT NULL, topic TEXT DEFAULT 'general',
    prompt TEXT NOT NULL, expected TEXT NOT NULL,
    actual TEXT, score REAL, passed INTEGER, latency_ms INTEGER,
    evidence_r2_key TEXT, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_results_job_trial
    ON trial_results(job_id, trial_num)`,
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
    ON cert_revocations(status_list_index)`
];

beforeAll(async () => {
	await env.DB.batch(TABLES.map((sql) => env.DB.prepare(sql)));

	// Generate a test Ed25519 keypair for buildVCProof in completeJob tests.
	// The secret store bindings are not available in local vitest runs,
	// so we generate an ephemeral key and inject it into the test env.
	const keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
		'sign',
		'verify'
	])) as CryptoKeyPair;
	const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
	const base64Key = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(env as any).KYM_NANDA_ED25519_PRIVATE_KEY_v1 = base64Key;

	// Ensure HMAC secret is set for signCertHMAC inside completeJob
	if (!env.KYM_NANDA_HMAC_SECRET) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(env as any).KYM_NANDA_HMAC_SECRET = 'test-hmac-secret';
	}
});

// ---------- Wilson Confidence Interval Tests ----------

describe('wilsonCI', () => {
	it('should return correct score for 4/5 passed', () => {
		const result = wilsonCI(4, 5);
		// Wilson centre for p=0.8, n=5: ≈ 0.6696
		expect(result.score).toBeCloseTo(0.6696, 2);
		expect(result.ci95_lo).toBeCloseTo(0.3755, 2);
		expect(result.ci95_hi).toBeCloseTo(0.9638, 2);
	});

	it('should return zeros for 0 total trials', () => {
		const result = wilsonCI(0, 0);
		expect(result.score).toBe(0);
		expect(result.ci95_lo).toBe(0);
		expect(result.ci95_hi).toBe(0);
	});

	it('should maintain bound ordering: ci95_lo < score < ci95_hi', () => {
		const result = wilsonCI(3, 10);
		expect(result.ci95_lo).toBeLessThan(result.score);
		expect(result.score).toBeLessThan(result.ci95_hi);
	});

	it('should return perfect score for all passed', () => {
		const result = wilsonCI(100, 100);
		expect(result.score).toBeGreaterThan(0.95);
		expect(result.ci95_hi).toBeLessThanOrEqual(1.0);
	});
});

// ---------- Grade Tests ----------

describe('grade', () => {
	it('should return correct letter for each boundary', () => {
		expect(grade(0.95)).toBe('A');
		expect(grade(0.9)).toBe('A');
		expect(grade(0.89)).toBe('B');
		expect(grade(0.75)).toBe('B');
		expect(grade(0.74)).toBe('C');
		expect(grade(0.5)).toBe('C');
		expect(grade(0.49)).toBe('D');
		expect(grade(0.25)).toBe('D');
		expect(grade(0.24)).toBe('F');
		expect(grade(0.1)).toBe('F');
		expect(grade(0.0)).toBe('F');
	});
});

// ---------- gradeItem Tests ----------

describe('gradeItem', () => {
	it('should return passed=true, score=1.0 for exact match', () => {
		const result = gradeItem('4', '4');
		expect(result.passed).toBe(true);
		expect(result.score).toBe(1.0);
	});

	it('should handle case-insensitive exact match', () => {
		const result = gradeItem('Mars', '  mars  ');
		expect(result.passed).toBe(true);
		expect(result.score).toBe(1.0);
	});

	it('should compute F1 for multi-label (comma-separated)', () => {
		// Expected: fox,quick,brown — Actual: fox,quick
		// tp=2, fp=0, fn=1 → precision=1.0, recall=2/3 → F1 = 0.8
		const result = gradeItem('fox,quick,brown', 'fox,quick');
		expect(result.score).toBeCloseTo(0.8, 2);
		expect(result.passed).toBe(true); // F1 >= 0.5
	});

	it('should return passed=false for complete mismatch', () => {
		const result = gradeItem('42', 'banana');
		expect(result.passed).toBe(false);
		expect(result.score).toBe(0.0);
	});

	it('should return passed=false for multi-label with zero overlap', () => {
		const result = gradeItem('a,b,c', 'x,y,z');
		expect(result.passed).toBe(false);
		expect(result.score).toBe(0.0);
	});
});

// ---------- HMAC Signing Tests ----------

describe('signCertHMAC', () => {
	it('should produce a consistent hex signature', async () => {
		const sig1 = await signCertHMAC('test-secret', 'cert-1', 'agent-1', 'math', 0.85, 'B');
		const sig2 = await signCertHMAC('test-secret', 'cert-1', 'agent-1', 'math', 0.85, 'B');
		expect(sig1).toBe(sig2); // Deterministic
		expect(sig1).toMatch(/^[0-9a-f]{64}$/); // 64 hex chars = SHA-256
	});

	it('should produce different signatures for different inputs', async () => {
		const sig1 = await signCertHMAC('test-secret', 'cert-1', 'agent-1', 'math', 0.85, 'B');
		const sig2 = await signCertHMAC('test-secret', 'cert-2', 'agent-1', 'math', 0.85, 'B');
		expect(sig1).not.toBe(sig2);
	});

	it('should produce different signatures for different secrets', async () => {
		const sig1 = await signCertHMAC('secret-a', 'cert-1', 'agent-1', 'math', 0.85, 'B');
		const sig2 = await signCertHMAC('secret-b', 'cert-1', 'agent-1', 'math', 0.85, 'B');
		expect(sig1).not.toBe(sig2);
	});
});

// ---------- startCertification Tests ----------

describe('startCertification', () => {
	it('should create a job in D1 and process trials inline', async () => {
		const result = await startCertification(env as never, 'test-agent', 'math', 3);
		expect(result.job_id).toBeDefined();
		expect(result.status).toBe('running');

		// Verify in D1 — inline processing means trials run synchronously,
		// so job may already be complete by the time we check
		const row = await env.DB.prepare('SELECT * FROM cert_jobs WHERE job_id = ?')
			.bind(result.job_id)
			.first<Record<string, unknown>>();
		expect(row).not.toBeNull();
		expect(row!.agent_id).toBe('test-agent');
		expect(row!.capability).toBe('math');
		expect(['running', 'complete', 'failed']).toContain(row!.status);
		expect(row!.num_trials).toBe(3);
		expect(row!.pass_threshold).toBe(0.8); // default per Python reference
	});

	it('should store custom pass_threshold on job', async () => {
		const result = await startCertification(env as never, 'thresh-agent', 'math', 3, 0.5);
		const row = await env.DB.prepare('SELECT pass_threshold FROM cert_jobs WHERE job_id = ?')
			.bind(result.job_id)
			.first<{ pass_threshold: number }>();
		expect(row!.pass_threshold).toBe(0.5);
	});

	it('should throw on invalid pass_threshold', async () => {
		await expect(startCertification(env as never, 'agent-x', 'math', 5, 1.5)).rejects.toThrow(
			'passThreshold must be between 0 and 1'
		);
		await expect(startCertification(env as never, 'agent-x', 'math', 5, -0.1)).rejects.toThrow(
			'passThreshold must be between 0 and 1'
		);
	});

	it('should throw on empty agentId', async () => {
		await expect(startCertification(env as never, '', 'math')).rejects.toThrow('agentId');
	});

	it('should throw on empty capability', async () => {
		await expect(startCertification(env as never, 'agent-x', '')).rejects.toThrow('capability');
	});

	it('should throw on numTrials = 0', async () => {
		await expect(startCertification(env as never, 'agent-x', 'math', 0)).rejects.toThrow(
			'numTrials must be an integer between 1 and 100'
		);
	});

	it('should throw on negative numTrials', async () => {
		await expect(startCertification(env as never, 'agent-x', 'math', -5)).rejects.toThrow(
			'numTrials must be an integer between 1 and 100'
		);
	});

	it('should throw on numTrials > 100', async () => {
		await expect(startCertification(env as never, 'agent-x', 'math', 101)).rejects.toThrow(
			'numTrials must be an integer between 1 and 100'
		);
	});

	it('should throw on NaN numTrials', async () => {
		await expect(startCertification(env as never, 'agent-x', 'math', NaN)).rejects.toThrow(
			'numTrials must be an integer between 1 and 100'
		);
	});
});

// ---------- getJobStatus Tests ----------

describe('getJobStatus', () => {
	it('should return correct job fields', async () => {
		const { job_id } = await startCertification(env as never, 'status-agent', 'math', 5);
		const db = createDbClient(env.DB);
		const status = await getJobStatus(db, job_id);
		expect(status).not.toBeNull();
		expect(status!.job_id).toBe(job_id);
		// Inline processing: job completes synchronously, status may be 'complete' or 'failed'
		expect(['running', 'complete', 'failed']).toContain(status!.status);
		expect(status!.num_trials).toBe(5);
	});

	it('should return null for nonexistent job', async () => {
		const db = createDbClient(env.DB);
		const status = await getJobStatus(db, 'nonexistent-job-id');
		expect(status).toBeNull();
	});
});

// ---------- getCertificate Tests ----------

describe('getCertificate', () => {
	it('should return null for nonexistent cert_id', async () => {
		const db = createDbClient(env.DB);
		const cert = await getCertificate(db, 'nonexistent-cert-id');
		expect(cert).toBeNull();
	});
});

// ---------- completeJob Tests ----------

describe('completeJob', () => {
	it('should create certificate with valid HMAC signature after completing trials', async () => {
		// Setup: create a job manually and insert trial results
		const jobId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials)
       VALUES (?, 'complete-agent', 'math', 'running', 5, 5)`
		)
			.bind(jobId)
			.run();

		// Insert 5 trial results: 4 passed, 1 failed (with topics for by_topic)
		const topics = ['arithmetic', 'arithmetic', 'algebra', 'arithmetic', 'algebra'];
		for (let i = 1; i <= 5; i++) {
			const passed = i <= 4 ? 1 : 0;
			await env.DB.prepare(
				`INSERT INTO trial_results (id, job_id, trial_num, topic, prompt, expected, actual, score, passed, latency_ms)
         VALUES (?, ?, ?, ?, 'What is 2+2?', '4', '4', ?, ?, 100)`
			)
				.bind(crypto.randomUUID(), jobId, i, topics[i - 1], passed ? 1.0 : 0.0, passed)
				.run();
		}

		// Complete the job
		await completeJob(env as never, jobId);

		// Verify job status is complete
		const job = await env.DB.prepare('SELECT status, score, grade FROM cert_jobs WHERE job_id = ?')
			.bind(jobId)
			.first<{ status: string; score: number; grade: string }>();
		expect(job).not.toBeNull();
		expect(job!.status).toBe('complete');
		expect(job!.score).toBeGreaterThan(0);
		expect(typeof job!.grade).toBe('string');

		// Verify certificate was created
		const cert = await env.DB.prepare('SELECT * FROM certificates WHERE agent_id = ?')
			.bind('complete-agent')
			.first<Record<string, unknown>>();
		expect(cert).not.toBeNull();
		expect(cert!.agent_id).toBe('complete-agent');
		expect(cert!.capability).toBe('math');
		expect(typeof cert!.hmac_signature).toBe('string');
		expect((cert!.hmac_signature as string).length).toBe(64); // SHA-256 hex
		expect(cert!.n_trials).toBe(5);
		expect(cert!.evidence_uri).toBe(`evidence/${jobId}/`);

		// Verify VC JSON structure
		const vc = JSON.parse(cert!.ed25519_vc as string) as Record<string, unknown>;
		expect(vc['@context']).toContain('https://www.w3.org/2018/credentials/v1');
		expect(vc.type).toContain('VerifiableCredential');
		expect(vc.type).toContain('CapabilityCertificate');
		expect(vc.proof).toBeDefined();

		// Verify by_topic breakdown (P1-6)
		const subject = vc.credentialSubject as Record<string, unknown>;
		expect(subject.by_topic).toBeDefined();
		const byTopic = subject.by_topic as Record<string, number>;
		// 3 arithmetic trials (all passed), 2 algebra trials (1 passed, 1 failed)
		expect(byTopic.arithmetic).toBe(1); // 3/3 = 1.0
		expect(byTopic.algebra).toBe(0.5); // 1/2 = 0.5
	});
});

// ---------- Queue Handler Tests ----------

describe('processCertBatch (batch processor)', () => {
	it('should process messages and store trial results', async () => {
		// Setup: create a job with 1 trial
		const jobId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials)
       VALUES (?, 'queue-test-agent', 'math', 'running', 1, 0)`
		)
			.bind(jobId)
			.run();

		// Insert agent for URL lookup
		await env.DB.prepare(
			`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, 'test', 'test', 'test')`
		)
			.bind('queue-test-agent', 'https://mock-agent.test')
			.run();

		// Compute the expected test case using the same hash-based selection as the batch handler
		const expectedTest = pickTestCase('math', jobId, 1);

		// Mock fetch to return the correct expected answer for the selected test case
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					jsonrpc: '2.0',
					id: 'test',
					result: { parts: [{ text: expectedTest.expected }] }
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		try {
			const ackFn = vi.fn();
			const retryFn = vi.fn();

			const mockBatch = {
				messages: [
					{
						body: {
							job_id: jobId,
							agent_id: 'queue-test-agent',
							capability: 'math',
							trial_num: 1,
							pass_threshold: 0.8
						},
						id: 'msg-1',
						timestamp: new Date(),
						attempts: 1,
						ack: ackFn,
						retry: retryFn
					}
				],
				ackAll: vi.fn(),
				retryAll: vi.fn()
			} as unknown as MessageBatch<CertJobMessage>;

			await processCertBatch(mockBatch, env as never);

			// Verify ack was called (not retry)
			expect(ackFn).toHaveBeenCalledOnce();
			expect(retryFn).not.toHaveBeenCalled();

			// Verify trial result was inserted
			const trial = await env.DB.prepare('SELECT * FROM trial_results WHERE job_id = ?')
				.bind(jobId)
				.first<Record<string, unknown>>();
			expect(trial).not.toBeNull();
			expect(trial!.job_id).toBe(jobId);
			expect(trial!.trial_num).toBe(1);
			expect(trial!.prompt).toBe(expectedTest.prompt);
			expect(trial!.expected).toBe(expectedTest.expected);
			expect(trial!.actual).toBe(expectedTest.expected);
			expect(trial!.passed).toBe(1);

			// Verify evidence was stored in R2
			const evidenceObj = await env.KYM_NANDA_EVIDENCE.get(`evidence/${jobId}/1.json`);
			expect(evidenceObj).not.toBeNull();

			// Verify job was completed (num_trials=1, now completed)
			const job = await env.DB.prepare(
				'SELECT status, score, grade FROM cert_jobs WHERE job_id = ?'
			)
				.bind(jobId)
				.first<{ status: string; score: number; grade: string }>();
			expect(job!.status).toBe('complete');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

// ---------- P4-1: Cert Revocation Integration Test ----------

describe('Certificate Revocation (P4-1)', () => {
	it('revokeCertificate → isRevoked → getRevocationList end-to-end', async () => {
		// 1. Create a certificate to revoke
		const certId = `cert-revoke-${crypto.randomUUID()}`;
		await env.DB.prepare(
			`INSERT INTO certificates (cert_id, agent_id, capability, score, grade, ci95_lo, ci95_hi, n_trials, hmac_signature, issued_at, expires_at)
       VALUES (?, 'revoke-test-agent', 'math', 0.85, 'B', 0.6, 0.95, 5, 'test-hmac', unixepoch(), unixepoch() + 86400)`
		)
			.bind(certId)
			.run();

		// 2. Verify not revoked initially
		const db = createDbClient(env.DB);
		const before = await isRevoked(db, certId);
		expect(before.revoked).toBe(false);

		// 3. Revoke the certificate
		const revokeResult = await revokeCertificate(db, certId, 'Test revocation');
		expect(revokeResult.ok).toBe(true);
		expect(typeof revokeResult.statusListIndex).toBe('number');

		// 4. Verify is now revoked
		const after = await isRevoked(db, certId);
		expect(after.revoked).toBe(true);
		expect(after.reason).toBe('Test revocation');
		expect(after.revokedAt).toBeDefined();

		// 5. Verify revocation list contains the bit
		const list = await getRevocationList(db, 'https://test.local');
		expect(list.type).toContain('StatusList2021Credential');
		const subject = list.credentialSubject as Record<string, unknown>;
		expect(subject.type).toBe('StatusList2021');
		expect(subject.statusPurpose).toBe('revocation');
		expect(typeof subject.encodedList).toBe('string');
		expect((subject.encodedList as string).length).toBeGreaterThan(0);

		// 6. Verify double-revoke returns error
		const doubleRevoke = await revokeCertificate(db, certId, 'Second attempt');
		expect(doubleRevoke.ok).toBe(false);
		expect(doubleRevoke.error).toBe('Certificate already revoked');
	});

	it('revokeCertificate returns error for nonexistent cert', async () => {
		const db = createDbClient(env.DB);
		const result = await revokeCertificate(db, 'nonexistent-cert-id', 'Test');
		expect(result.ok).toBe(false);
		expect(result.error).toBe('Certificate not found');
	});
});

// ---------- P4-5: by_topic Aggregation Test ----------

describe('by_topic aggregation (P4-5)', () => {
	it('produces per-topic pass rates in certificate VC', async () => {
		// Create a job with mixed-topic trials
		const jobId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials, pass_threshold)
       VALUES (?, 'topic-agent', 'qa', 'running', 6, 6, 0.8)`
		)
			.bind(jobId)
			.run();

		// 6 trials: 3 math (all pass), 2 text (1 pass, 1 fail), 1 general (pass)
		const trials = [
			{ topic: 'math', passed: 1 },
			{ topic: 'math', passed: 1 },
			{ topic: 'math', passed: 1 },
			{ topic: 'text', passed: 1 },
			{ topic: 'text', passed: 0 },
			{ topic: 'general', passed: 1 }
		];

		for (let i = 0; i < trials.length; i++) {
			await env.DB.prepare(
				`INSERT INTO trial_results (id, job_id, trial_num, topic, prompt, expected, actual, score, passed, latency_ms)
         VALUES (?, ?, ?, ?, 'Q?', 'A', 'A', ?, ?, 50)`
			)
				.bind(
					crypto.randomUUID(),
					jobId,
					i + 1,
					trials[i].topic,
					trials[i].passed ? 1.0 : 0.0,
					trials[i].passed
				)
				.run();
		}

		await completeJob(env as never, jobId);

		// Get the certificate and check by_topic
		const cert = await env.DB.prepare('SELECT ed25519_vc FROM certificates WHERE agent_id = ?')
			.bind('topic-agent')
			.first<{ ed25519_vc: string }>();
		expect(cert).not.toBeNull();

		const vc = JSON.parse(cert!.ed25519_vc) as Record<string, unknown>;
		const subject = vc.credentialSubject as Record<string, unknown>;
		expect(subject.by_topic).toBeDefined();

		const byTopic = subject.by_topic as Record<string, number>;
		expect(byTopic.math).toBe(1.0); // 3/3
		expect(byTopic.text).toBe(0.5); // 1/2
		expect(byTopic.general).toBe(1.0); // 1/1
	});
});

// ---------- P4-6: Concurrent Queue Processing Test ----------

describe('Concurrent queue processing / idempotency (P4-6)', () => {
	it('handles duplicate trial_num for same job_id idempotently', async () => {
		// Setup: create a job with 2 trials
		const jobId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO cert_jobs (job_id, agent_id, capability, status, num_trials, completed_trials)
       VALUES (?, 'idempotent-agent', 'math', 'running', 2, 0)`
		)
			.bind(jobId)
			.run();

		// Insert agent
		await env.DB.prepare(
			`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, public_key_hex, signature_hex, signer_id) VALUES (?, ?, 'test', 'test', 'test')`
		)
			.bind('idempotent-agent', 'https://mock-agent.test')
			.run();

		// Mock fetch
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					jsonrpc: '2.0',
					id: 'test',
					result: { parts: [{ text: '4' }] }
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		try {
			const ackFn1 = vi.fn();
			const ackFn2 = vi.fn();

			// Send two messages with the SAME trial_num=1
			const mockBatch = {
				messages: [
					{
						body: {
							job_id: jobId,
							agent_id: 'idempotent-agent',
							capability: 'math',
							trial_num: 1,
							pass_threshold: 0.8
						},
						id: 'msg-dup-1',
						timestamp: new Date(),
						attempts: 1,
						ack: ackFn1,
						retry: vi.fn()
					},
					{
						body: {
							job_id: jobId,
							agent_id: 'idempotent-agent',
							capability: 'math',
							trial_num: 1,
							pass_threshold: 0.8
						},
						id: 'msg-dup-2',
						timestamp: new Date(),
						attempts: 1,
						ack: ackFn2,
						retry: vi.fn()
					}
				],
				ackAll: vi.fn(),
				retryAll: vi.fn()
			} as unknown as MessageBatch<CertJobMessage>;

			await processCertBatch(mockBatch, env as never);

			// Both should be acked (second one hits idempotency guard)
			expect(ackFn1).toHaveBeenCalledOnce();
			expect(ackFn2).toHaveBeenCalledOnce();

			// Only one trial_result row should exist
			const { results } = await env.DB.prepare(
				'SELECT * FROM trial_results WHERE job_id = ? AND trial_num = 1'
			)
				.bind(jobId)
				.all();
			expect(results.length).toBe(1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
