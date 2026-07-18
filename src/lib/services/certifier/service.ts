/**
 * Capability Certifier Service — Core certification logic
 *
 * Provides Wilson CI scoring, grading, HMAC signing, job lifecycle,
 * and W3C Verifiable Credential issuance for agent capability certification.
 *
 * Reference: nexartis-forks/nanda-infrastructure/agents/capability_certifier/langchain_capability_certifier.py
 */
import type { Env, CertJobMessage } from '../../types';
import { buildVCProof } from './key-rotation';
import { createLogger } from '../../utils/logger';
import { resolveSecret } from '../../utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '../../utils/node-secrets';
import { createDbClient } from '$lib/db/client';
import type { DbClient } from '$lib/db/client';
import {
	insertCertJob,
	updateCertJobStatus,
	updateCertJobComplete,
	getCertJob,
	getJobStatus as repoGetJobStatus,
	getTrialResultsForJob,
	getCertificateCount,
	insertCertificate,
	getCertificateById
} from '$lib/db/repositories';

const log = createLogger(undefined, 'certifier');

// ---------------------------------------------------------------------------
// Wilson Confidence Interval
// ---------------------------------------------------------------------------

/**
 * Compute the Wilson score confidence interval (95% CI, z = 1.96).
 *
 * @param passed — Number of successful trials
 * @param total  — Total number of trials
 * @returns Wilson score centre and 95% confidence bounds
 */
export function wilsonCI(
	passed: number,
	total: number
): { score: number; ci95_lo: number; ci95_hi: number } {
	if (total === 0) {
		return { score: 0, ci95_lo: 0, ci95_hi: 0 };
	}

	const z = 1.96;
	const zSq = z * z;
	const phat = passed / total;
	const denom = 1 + zSq / total;
	const centre = phat + zSq / (2 * total);
	const spread = z * Math.sqrt((phat * (1 - phat) + zSq / (4 * total)) / total);

	return {
		score: centre / denom,
		ci95_lo: Math.max(0, (centre - spread) / denom),
		ci95_hi: Math.min(1, (centre + spread) / denom)
	};
}

// ---------------------------------------------------------------------------
// Letter Grading
// ---------------------------------------------------------------------------

/**
 * Map a score (0–1) to a letter grade.
 *
 * @param score — Numeric score between 0 and 1
 * @returns Letter grade: A, B, C, D, or F
 */
export function grade(score: number): string {
	if (score >= 0.9) return 'A';
	if (score >= 0.75) return 'B';
	if (score >= 0.5) return 'C';
	if (score >= 0.25) return 'D';
	return 'F';
}

// ---------------------------------------------------------------------------
// Individual Trial Grading
// ---------------------------------------------------------------------------

/**
 * Grade a single trial by comparing expected vs actual output.
 *
 * Grading strategy:
 *   1. Exact match (case-insensitive, trimmed): passed = true, score = 1.0
 *   2. Multi-label F1 (comma-separated tokens): passed = f1 >= 0.5
 *   3. Fallback: passed = false, score = 0.0
 *
 * @param expected — Ground-truth answer
 * @param actual   — Agent's response
 * @returns Grading result with pass/fail and numeric score
 */
export function gradeItem(expected: string, actual: string): { passed: boolean; score: number } {
	const normExpected = expected.trim().toLowerCase();
	const normActual = actual.trim().toLowerCase();

	// 1. Exact match
	if (normExpected === normActual) {
		return { passed: true, score: 1.0 };
	}

	// 2. Multi-label F1 (comma-separated tokens)
	if (expected.includes(',')) {
		const expectedSet = new Set(expected.split(',').map((s) => s.trim().toLowerCase()));
		const actualSet = new Set(actual.split(',').map((s) => s.trim().toLowerCase()));

		let tp = 0;
		for (const token of actualSet) {
			if (expectedSet.has(token)) tp++;
		}
		const fp = actualSet.size - tp;
		const fn = expectedSet.size - tp;

		if (tp === 0) {
			return { passed: false, score: 0.0 };
		}

		const precision = tp / (tp + fp);
		const recall = tp / (tp + fn);
		const denominator = precision + recall;

		if (denominator === 0) {
			return { passed: false, score: 0.0 };
		}

		const f1 = (2 * precision * recall) / denominator;
		return { passed: f1 >= 0.5, score: f1 };
	}

	// 3. Fallback — no match
	return { passed: false, score: 0.0 };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 Signing (internal integrity)
// ---------------------------------------------------------------------------

/**
 * Sign a certificate payload with HMAC-SHA256 for internal integrity verification.
 *
 * @param secret     — HMAC secret key
 * @param certId     — Certificate identifier
 * @param agentId    — Agent identifier
 * @param capability — Certified capability
 * @param score      — Numeric score
 * @param gradeStr   — Letter grade
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export async function signCertHMAC(
	secret: string,
	certId: string,
	agentId: string,
	capability: string,
	score: number,
	gradeStr: string
): Promise<string> {
	const message = `${certId}|${agentId}|${capability}|${score}|${gradeStr}`;
	const encoder = new TextEncoder();

	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);

	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Job Lifecycle — Start Certification
// ---------------------------------------------------------------------------

/**
 * Start a new capability certification job for an agent.
 * Creates a cert_jobs row and processes trial messages inline.
 *
 * @param env           — Worker environment bindings
 * @param agentId       — Agent to certify
 * @param capability    — Capability to test (e.g. 'math', 'text-generation')
 * @param numTrials     — Number of trials to run (default 5)
 * @param passThreshold — Per-trial pass threshold (default from env or 0.8 per Python reference)
 * @returns Job identifier and initial status
 */
export async function startCertification(
	env: Env,
	agentId: string,
	capability: string,
	numTrials?: number,
	passThreshold?: number
): Promise<{ job_id: string; status: string }> {
	if (!agentId || typeof agentId !== 'string') {
		throw new Error('agentId must be a non-empty string');
	}
	if (!capability || typeof capability !== 'string') {
		throw new Error('capability must be a non-empty string');
	}

	const trials = numTrials ?? 5;
	if (!Number.isFinite(trials) || trials < 1 || trials > 100) {
		throw new Error('numTrials must be an integer between 1 and 100');
	}

	// Resolve pass_threshold: explicit param > env var > 0.8 default (Python ref line 277)
	const threshold = passThreshold ?? parseFloat(env.CERT_PASS_THRESHOLD as string);
	if (threshold < 0 || threshold > 1) {
		throw new Error('passThreshold must be between 0 and 1');
	}

	const db = createDbClient(env.DB);
	const jobId = crypto.randomUUID();

	// Insert job record
	await insertCertJob(db, {
		jobId,
		agentId,
		capability,
		status: 'pending',
		numTrials: trials,
		passThreshold: threshold
	});

	// Process individual trials inline
	const { processSingleTrial } = await import('$lib/services/certifier/queue-handler');
	for (let i = 1; i <= trials; i++) {
		const msg: CertJobMessage = {
			job_id: jobId,
			agent_id: agentId,
			capability,
			trial_num: i,
			pass_threshold: threshold
		};
		await processSingleTrial(msg, env);
	}

	// Transition to running (only if still pending — inline processing may already have advanced)
	await updateCertJobStatus(db, jobId, 'running', 'pending');

	return { job_id: jobId, status: 'running' };
}

// ---------------------------------------------------------------------------
// Job Status Query
// ---------------------------------------------------------------------------

/**
 * Retrieve the current status of a certification job.
 *
 * @param db    — D1 database binding
 * @param jobId — Job identifier
 * @returns Job status record, or null if not found
 */
export async function getJobStatus(
	db: DbClient,
	jobId: string
): Promise<{
	job_id: string;
	status: string;
	completed_trials: number;
	num_trials: number;
	score?: number;
	grade?: string;
} | null> {
	const row = await repoGetJobStatus(db, jobId);
	if (!row) return null;

	return {
		job_id: row.jobId,
		status: row.status ?? 'pending',
		completed_trials: row.completedTrials ?? 0,
		num_trials: row.numTrials ?? 5,
		...(row.score !== null && row.score !== undefined ? { score: row.score } : {}),
		...(row.grade !== null && row.grade !== undefined ? { grade: row.grade } : {})
	};
}

// ---------------------------------------------------------------------------
// Certificate Retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieve a certificate by its identifier.
 *
 * @param db     — D1 database binding
 * @param certId — Certificate identifier
 * @returns Certificate record, or null if not found
 */
export async function getCertificate(
	db: DbClient,
	certId: string
): Promise<Record<string, unknown> | null> {
	const row = await getCertificateById(db, certId);
	if (!row) return null;
	return {
		cert_id: row.certId,
		agent_id: row.agentId,
		capability: row.capability,
		score: row.score,
		grade: row.grade,
		ci95_lo: row.ci95Lo,
		ci95_hi: row.ci95Hi,
		n_trials: row.nTrials,
		hmac_signature: row.hmacSignature,
		ed25519_vc: row.ed25519Vc,
		evidence_uri: row.evidenceUri,
		issued_at: row.issuedAt,
		expires_at: row.expiresAt
	};
}

// ---------------------------------------------------------------------------
// Job Completion — Aggregate, Sign, Issue Certificate
// ---------------------------------------------------------------------------

/**
 * Complete a certification job after all trials have been processed.
 * Aggregates trial results, computes Wilson CI, signs the certificate
 * with HMAC-SHA256 and issues a W3C Verifiable Credential with Ed25519 proof.
 *
 * @param env   — Worker environment bindings
 * @param jobId — Job identifier to complete
 */
export async function completeJob(env: Env, jobId: string): Promise<void> {
	const db = createDbClient(env.DB);

	// 1. Fetch the job record
	const job = await getCertJob(db, jobId);

	if (!job) {
		throw new Error(`cert_jobs row not found: ${jobId}`);
	}

	// Idempotency guard — skip if job is already complete
	if (job.status === 'complete') {
		return;
	}

	// 2. Fetch all trial results for this job (including topic for by_topic breakdown)
	const trialRows = await getTrialResultsForJob(db, jobId);

	const passedCount = trialRows.reduce((sum, r) => sum + (r.passed === 1 ? 1 : 0), 0);
	const totalTrials = job.numTrials ?? 5; // Use job's intended count, not row count

	if (trialRows.length !== totalTrials) {
		log.warn(
			'completeJob',
			`trial count mismatch: expected=${totalTrials}, actual=${trialRows.length}`
		);
	}
	if (totalTrials === 0) {
		throw new Error(`[completeJob] cannot complete job with 0 trials: ${jobId}`);
	}

	// 2b. Aggregate per-topic scores (P1-6 — matches Python reference by_topic_scores)
	const topicScores: Record<string, number[]> = {};
	for (const r of trialRows) {
		const t = r.topic || 'general';
		if (!topicScores[t]) topicScores[t] = [];
		topicScores[t].push(r.passed === 1 ? 1 : 0);
	}
	const byTopic: Record<string, number> = {};
	for (const [t, scores] of Object.entries(topicScores)) {
		byTopic[t] =
			Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 10000) / 10000;
	}

	// 3. Compute Wilson CI and grade
	const { score: wilsonScore, ci95_lo, ci95_hi } = wilsonCI(passedCount, totalTrials);
	const letterGrade = grade(wilsonScore);

	// 4. Update job as complete
	await updateCertJobComplete(db, jobId, {
		status: 'complete',
		score: wilsonScore,
		grade: letterGrade
	});

	// 5. Generate certificate
	const certId = crypto.randomUUID();
	const issuedAt = Math.floor(Date.now() / 1000);
	const validityDays = parseInt(env.CERT_VALIDITY_DAYS as string, 10);
	const expiresAt = issuedAt + validityDays * 24 * 60 * 60;

	// 6. HMAC-SHA256 internal integrity signature
	const hmacSecret = await resolveSecret(
		env.KYM_NANDA_HMAC_SECRET,
		kvFallback(env, SECRET_KEYS.HMAC_SECRET)
	);
	if (!hmacSecret) {
		throw new Error('[completeJob] KYM_NANDA_HMAC_SECRET not available');
	}
	const hmacSignature = await signCertHMAC(
		hmacSecret,
		certId,
		job.agentId,
		job.capability,
		wilsonScore,
		letterGrade
	);

	// 7. Allocate StatusList2021 index for the VC
	const statusListIndex = await getCertificateCount(db);

	// 8. Build W3C Verifiable Credential JSON-LD
	const issuerDid = `did:web:${env.NANDA_REGISTRY_URL.replace('https://', '')}`;
	const vc: Record<string, unknown> = {
		'@context': ['https://www.w3.org/2018/credentials/v1'],
		type: ['VerifiableCredential', 'CapabilityCertificate'],
		issuer: issuerDid,
		issuanceDate: new Date(issuedAt * 1000).toISOString(),
		expirationDate: new Date(expiresAt * 1000).toISOString(),
		credentialSubject: {
			id: job.agentId,
			capability: job.capability,
			score: wilsonScore,
			grade: letterGrade,
			ci95_lo,
			ci95_hi,
			n_trials: totalTrials,
			by_topic: byTopic
		},
		credentialStatus: {
			id: `${env.NANDA_REGISTRY_URL}/credentials/status/1#${statusListIndex}`,
			type: 'StatusList2021Entry',
			statusPurpose: 'revocation',
			statusListIndex: String(statusListIndex),
			statusListCredential: `${env.NANDA_REGISTRY_URL}/credentials/status/1`
		}
	};

	// 9. Ed25519 proof
	vc.proof = await buildVCProof(env, JSON.stringify(vc));

	// 10. Store the certificate
	const evidenceUri = `evidence/${jobId}/`;
	await insertCertificate(db, {
		certId,
		agentId: job.agentId,
		capability: job.capability,
		score: wilsonScore,
		grade: letterGrade,
		ci95Lo: ci95_lo,
		ci95Hi: ci95_hi,
		nTrials: totalTrials,
		hmacSignature,
		ed25519Vc: JSON.stringify(vc),
		evidenceUri,
		issuedAt,
		expiresAt
	});
}
