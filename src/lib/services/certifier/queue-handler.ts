/**
 * Certification Queue Handler — Queue consumer for cert trial processing
 *
 * Processes CertJobMessage batches. Each message
 * represents a single trial: pick a test case, call the agent via A2A,
 * grade the response, store evidence in R2, and record the trial result.
 *
 * When all trials for a job are complete, triggers certificate issuance
 * via completeJob().
 *
 * Idempotent: checks for existing trial_results before INSERT to support
 * safe retries (up to 5× per wrangler config).
 */
import { eq, sql } from 'drizzle-orm';
import type { Env, CertJobMessage } from '../../types';
import { getChangeCount } from '../../utils/drizzle-helpers';
import { gradeItem, completeJob } from './service';
import { createLogger } from '../../utils/logger';
import { createDbClient } from '$lib/db/client';
import { certJobs, trialResults } from '$lib/db/schema';
import {
	checkTrialExists,
	getCertJob,
	getCompletedTrialCount,
	incrementCompletedTrials,
	getAgentUrl
} from '$lib/db/repositories';

const log = createLogger(undefined, 'certifier-queue');

// ---------------------------------------------------------------------------
// Test Bank — Stratified test cases per capability
// ---------------------------------------------------------------------------

/** Test case definition for capability trials (per Python reference: capability, topic, prompt, expected) */
interface TestCase {
	topic: string;
	prompt: string;
	expected: string;
}

/**
 * Test bank keyed by capability. Larger pool enables stratified sampling
 * across topics. Each certification run uses hash-based deterministic
 * random selection so retries get the same test case for a given trial.
 * Topics enable per-topic score breakdown (by_topic) in certificates.
 *
 * In production, consider migrating to database-backed test sets.
 */
const TEST_BANK: Record<string, TestCase[]> = {
	math: [
		// Arithmetic
		{ topic: 'arithmetic', prompt: 'What is 2+2?', expected: '4' },
		{ topic: 'arithmetic', prompt: 'What is 15% of 200?', expected: '30' },
		{ topic: 'arithmetic', prompt: 'What is 7 * 8?', expected: '56' },
		{ topic: 'arithmetic', prompt: 'What is 100 / 4?', expected: '25' },
		{ topic: 'arithmetic', prompt: 'What is 17 + 28?', expected: '45' },
		{ topic: 'arithmetic', prompt: 'What is 1000 - 373?', expected: '627' },
		{ topic: 'arithmetic', prompt: 'What is 12 * 12?', expected: '144' },
		{ topic: 'arithmetic', prompt: 'What is 250 + 750?', expected: '1000' },
		{ topic: 'arithmetic', prompt: 'What is 81 / 9?', expected: '9' },
		{ topic: 'arithmetic', prompt: 'What is 33% of 300?', expected: '99' },
		// Algebra
		{ topic: 'algebra', prompt: 'What is sqrt(144)?', expected: '12' },
		{ topic: 'algebra', prompt: 'What is 3^3?', expected: '27' },
		{ topic: 'algebra', prompt: 'What is 2^10?', expected: '1024' },
		{ topic: 'algebra', prompt: 'What is sqrt(81)?', expected: '9' },
		{ topic: 'algebra', prompt: 'Solve: 2x = 10. What is x?', expected: '5' },
		{ topic: 'algebra', prompt: 'What is 5 factorial (5!)?', expected: '120' }
	],
	'text-generation': [
		// Summarization
		{
			topic: 'summarization',
			prompt: 'Summarize in keywords: The quick brown fox jumps over the lazy dog',
			expected: 'fox,quick,brown,dog,lazy'
		},
		{
			topic: 'summarization',
			prompt: 'Summarize in one word: a vehicle with four wheels used for transport',
			expected: 'car'
		},
		{
			topic: 'summarization',
			prompt: 'Summarize in keywords: Machine learning uses data to improve performance',
			expected: 'machine,learning,data,performance'
		},
		// Enumeration
		{ topic: 'enumeration', prompt: 'List the primary colors', expected: 'red,blue,yellow' },
		{
			topic: 'enumeration',
			prompt: 'Name the first three planets from the sun',
			expected: 'mercury,venus,earth'
		},
		{
			topic: 'enumeration',
			prompt: 'List common web browsers',
			expected: 'chrome,firefox,safari,edge'
		},
		{
			topic: 'enumeration',
			prompt: 'Name three programming paradigms',
			expected: 'object-oriented,functional,procedural'
		},
		{
			topic: 'enumeration',
			prompt: 'List types of machine learning',
			expected: 'supervised,unsupervised,reinforcement'
		},
		{ topic: 'enumeration', prompt: 'Name three states of matter', expected: 'solid,liquid,gas' },
		{
			topic: 'enumeration',
			prompt: 'List the four cardinal directions',
			expected: 'north,south,east,west'
		},
		{
			topic: 'enumeration',
			prompt: 'Name common relational databases',
			expected: 'postgresql,mysql,sqlite,oracle'
		},
		{ topic: 'enumeration', prompt: 'List HTTP methods', expected: 'GET,POST,PUT,DELETE,PATCH' }
	],
	'qa.general': [
		// Science
		{
			topic: 'science',
			prompt: 'What gas do plants absorb during photosynthesis?',
			expected: 'carbon dioxide'
		},
		{ topic: 'science', prompt: 'What is the chemical symbol for water?', expected: 'H2O' },
		{ topic: 'science', prompt: 'What planet is known as the Red Planet?', expected: 'Mars' },
		{
			topic: 'science',
			prompt: 'What is the speed of light in km/s (approximate)?',
			expected: '300000'
		},
		{ topic: 'science', prompt: 'What is the boiling point of water in Celsius?', expected: '100' },
		{ topic: 'science', prompt: 'What is the largest organ in the human body?', expected: 'skin' },
		{ topic: 'science', prompt: 'What is the chemical symbol for gold?', expected: 'Au' },
		{ topic: 'science', prompt: 'How many chromosomes do humans have?', expected: '46' },
		// Geography
		{ topic: 'geography', prompt: 'What is the largest ocean on Earth?', expected: 'Pacific' },
		{ topic: 'geography', prompt: 'What is the longest river in the world?', expected: 'Nile' },
		{ topic: 'geography', prompt: 'What is the smallest continent?', expected: 'Australia' },
		{ topic: 'geography', prompt: 'What is the capital of Japan?', expected: 'Tokyo' },
		// Technology
		{
			topic: 'technology',
			prompt: 'What does HTTP stand for?',
			expected: 'HyperText Transfer Protocol'
		},
		{
			topic: 'technology',
			prompt: 'What does CPU stand for?',
			expected: 'Central Processing Unit'
		},
		{ topic: 'technology', prompt: 'What year was the World Wide Web invented?', expected: '1989' },
		{
			topic: 'technology',
			prompt: 'What programming language is most associated with web browsers?',
			expected: 'JavaScript'
		}
	]
};

/** Fallback test case when capability is not found in TEST_BANK */
const FALLBACK_TEST: TestCase = {
	topic: 'general',
	prompt: 'What is 1+1?',
	expected: '2'
};

/**
 * DJB2 string hash — deterministic, fast, zero-dependency.
 * Used to pick test cases so the same (job_id, trial_num) pair always
 * selects the same test case, even across retries.
 */
function djb2Hash(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0; // unsigned 32-bit
	}
	return hash;
}

/** Pick a test case deterministically using job_id + trial_num as seed */
export function pickTestCase(capability: string, jobId: string, trialNum: number): TestCase {
	const bank = TEST_BANK[capability] ?? [FALLBACK_TEST];
	const index = djb2Hash(`${jobId}:${trialNum}`) % bank.length;
	return bank[index];
}

// ---------------------------------------------------------------------------
// Queue Consumer
// ---------------------------------------------------------------------------

/**
 * Process a batch of certification trial messages.
 *
 * For each message:
 *   1. Parse the CertJobMessage
 *   2. Pick a test case from TEST_BANK (hash-based deterministic selection)
 *   3. Call the agent via A2A and measure latency
 *   4. Grade the response
 *   5. Store evidence in R2
 *   6. INSERT trial result into D1
 *   7. Increment completed_trials; if all done → completeJob()
 *   8. Acknowledge the message
 *
 * On error: retry via msg.retry() (auto-retries up to 5×)
 *
 * @param batch — Queue message batch
 * @param env   — Worker environment bindings
 */
export async function processCertBatch(
	batch: MessageBatch<CertJobMessage>,
	env: Env
): Promise<void> {
	for (const msg of batch.messages) {
		try {
			await processSingleTrial(msg.body, env);
			msg.ack();
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			log.error(
				'processCertBatch',
				`Trial failed job=${msg.body.job_id} trial=${msg.body.trial_num} attempt=${msg.attempts}`,
				{ error: errMsg }
			);
			// P3-5: Retry guardrail — if at max attempts, ack to let DLQ handle it
			if (msg.attempts >= 5) {
				log.error(
					'processCertBatch',
					`Max retries reached for job=${msg.body.job_id} trial=${msg.body.trial_num} — acking to DLQ`
				);
				msg.ack();
			} else {
				msg.retry();
			}
		}
	}
}

/**
 * Process a single certification trial. Exported for use by both the batch
 * handler and the SvelteKit queue route endpoint (self-fetch pattern).
 *
 * @param body — CertJobMessage payload
 * @param env  — Worker environment bindings
 */
export async function processSingleTrial(body: CertJobMessage, env: Env): Promise<void> {
	const { job_id, agent_id, capability, trial_num, pass_threshold } = body;
	const db = createDbClient(env.DB);

	// Idempotency guard — skip if trial already recorded
	const existing = await checkTrialExists(db, job_id, trial_num);

	if (existing) {
		// Re-check job completion in case prior attempt inserted but crashed before incrementing
		const jobRow = await getCertJob(db, job_id);
		if (jobRow && (jobRow.completedTrials ?? 0) < (jobRow.numTrials ?? 5)) {
			// Recalculate from actual trial_results count
			const actualCount = await getCompletedTrialCount(db, job_id);
			if (actualCount > (jobRow.completedTrials ?? 0)) {
				await db
					.update(certJobs)
					.set({ completedTrials: actualCount, updatedAt: sql`(unixepoch())` })
					.where(eq(certJobs.jobId, job_id));
				if (actualCount >= (jobRow.numTrials ?? 5)) {
					await completeJob(env, job_id);
				}
			}
		}
		return;
	}

	// Pick test case (hash-based deterministic selection — same job+trial always picks same test)
	const testCase = pickTestCase(capability, job_id, trial_num);

	// Look up agent URL from registry
	const agent = await getAgentUrl(db, agent_id);

	if (!agent?.agentUrl) {
		log.error('processTrial', 'Agent URL not found in registry — cannot execute trial', {
			agentId: agent_id,
			jobId: job_id
		});
		// Record a failed trial so the job can still complete
		await db
			.insert(trialResults)
			.values({
				id: crypto.randomUUID(),
				jobId: job_id,
				trialNum: trial_num,
				topic: testCase.topic,
				prompt: testCase.prompt,
				expected: testCase.expected,
				actual: `<error: Agent URL not found for ${agent_id}>`,
				score: 0,
				passed: 0,
				latencyMs: 0,
				evidenceR2Key: null
			})
			.onConflictDoNothing();
		await incrementCompletedTrials(db, job_id);
		return;
	}

	const agentUrl = agent.agentUrl;

	// Execute trial — call agent via A2A JSON-RPC
	let actual = '';
	let latencyMs = 0;
	const startTime = Date.now();

	try {
		const a2aPayload = {
			jsonrpc: '2.0',
			method: 'message/send',
			id: `trial-${job_id}-${trial_num}`,
			params: {
				message: {
					role: 'user',
					parts: [{ text: testCase.prompt }]
				}
			}
		};

		const response = await fetch(`${agentUrl}/a2a`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(a2aPayload)
		});

		latencyMs = Date.now() - startTime;

		if (response.ok) {
			const data = (await response.json()) as Record<string, unknown>;
			// Extract text from JSON-RPC result → parts[0].text
			const result = data.result as Record<string, unknown> | undefined;
			const parts = result?.parts as Array<Record<string, string>> | undefined;
			actual = parts?.[0]?.text ?? JSON.stringify(data);
		} else {
			actual = `<http_error: ${response.status} ${response.statusText}>`;
		}
	} catch (fetchErr) {
		latencyMs = Date.now() - startTime;
		actual = `<error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}>`;
	}

	// Grade the response (score comes from gradeItem, pass/fail from pass_threshold per Python ref line 211)
	const grading = gradeItem(testCase.expected, actual);
	const passed = grading.score >= (pass_threshold ?? 0.8);

	// Store evidence in R2
	const evidenceKey = `evidence/${job_id}/${trial_num}.json`;
	const evidence = {
		job_id,
		agent_id,
		capability,
		trial_num,
		prompt: testCase.prompt,
		expected: testCase.expected,
		actual,
		passed,
		score: grading.score,
		latency_ms: latencyMs,
		graded_at: new Date().toISOString()
	};

	await env.KYM_NANDA_EVIDENCE.put(evidenceKey, JSON.stringify(evidence), {
		httpMetadata: { contentType: 'application/json' },
		customMetadata: { job_id, trial_num: String(trial_num), agent_id }
	});

	// Insert trial result into D1 (INSERT OR IGNORE to handle concurrent duplicate deliveries)
	const trialId = crypto.randomUUID();
	// Insert trial result into D1 (onConflictDoNothing to handle concurrent duplicate deliveries)
	const insertResult = await db
		.insert(trialResults)
		.values({
			id: trialId,
			jobId: job_id,
			trialNum: trial_num,
			topic: testCase.topic,
			prompt: testCase.prompt,
			expected: testCase.expected,
			actual,
			score: grading.score,
			passed: passed ? 1 : 0,
			latencyMs: latencyMs,
			evidenceR2Key: evidenceKey
		})
		.onConflictDoNothing();

	// If a concurrent delivery already inserted this trial, skip incrementing
	// D1 driver returns meta.changes for conflict-aware insert results
	const changes = getChangeCount(insertResult, 1);
	if (changes === 0) {
		return;
	}

	// Increment completed_trials and check for job completion
	await incrementCompletedTrials(db, job_id);

	const jobRow = await getCertJob(db, job_id);

	if (jobRow && (jobRow.completedTrials ?? 0) >= (jobRow.numTrials ?? 5)) {
		await completeJob(env, job_id);
	}
}
