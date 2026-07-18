/**
 * Orchestration Tests — Phase 6 (Sprints 13–14: Multi-Agent Orchestration)
 *
 * Tests for DAG validation, workflow engine, templates, routing, delegation,
 * and step executors.
 * Uses @cloudflare/vitest-pool-workers with real local D1 bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import { nanoid } from 'nanoid';

// DAG validation
import {
	validateDag,
	parseDagJson,
	getDependencies,
	getDependents,
	type DagDefinition
} from '../src/lib/services/orchestration/dag';

// Workflow engine
import {
	createWorkflowWithSteps,
	updateWorkflowDag,
	startWorkflowRun,
	executeWorkflowRun,
	type StepExecutor
} from '../src/lib/services/orchestration/engine';

// Templates
import {
	seedBuiltinTemplates,
	BUILTIN_TEMPLATES
} from '../src/lib/services/orchestration/templates';

// Routing (Sprint 14)
import { routeToAgent, type RoutingRequest } from '../src/lib/services/orchestration/routing';

// Delegation (Sprint 14)
import {
	delegateTask,
	getWorkflowDelegations,
	cancelDelegation,
	type DelegateInput,
	type DelegationExecutor
} from '../src/lib/services/orchestration/delegation';

// Step Executors (Sprint 14)
import { NoOpExecutor, CompositeExecutor } from '../src/lib/services/orchestration/executors';

// Conflict Resolution (Sprint 15)
import {
	raiseConflict,
	getRunConflicts,
	getPendingConflicts,
	manuallyResolveConflict,
	type RaiseConflictInput,
	type ConflictCandidate
} from '../src/lib/services/orchestration/conflicts';

// Streaming (Sprint 15)
import {
	emitEvent,
	getRunEventHistory,
	type WorkflowEventType
} from '../src/lib/services/orchestration/streaming';

// Repository
import {
	getWorkflowById,
	getWorkflowSteps,
	listWorkflowsByOwner,
	updateWorkflow,
	deleteWorkflow,
	getWorkflowRunById,
	getStepRunsForRun,
	listAllPatterns,
	getPatternById,
	createPattern,
	deletePattern,
	createDelegationTask,
	getDelegationTaskById,
	listDelegationsByDelegator,
	listDelegationsByStatus,
	updateDelegationTask,
	deleteDelegationTask,
	createRoutingDecision,
	getRoutingDecisionById,
	listRoutingDecisionsBySource,
	updateRoutingDecisionOutcome,
	createWorkflowEvent,
	getWorkflowEventById,
	listEventsByRun,
	listUnconsumedEvents,
	markEventsConsumed,
	createConflictResolution,
	getConflictResolutionById,
	listConflictsByRun,
	listUnresolvedConflicts,
	resolveConflict
} from '../src/lib/db/repositories';

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

/** D1 table creation for orchestration tables */
const ORCH_TABLES = [
	// agents table needed by Routing & Delegation service tests
	`CREATE TABLE IF NOT EXISTS agent_addrs (
    agent_id TEXT PRIMARY KEY, public_key_hex TEXT NOT NULL, signature_hex TEXT NOT NULL,
    signer_id TEXT NOT NULL, facts_url TEXT, private_url TEXT, resolver_url TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()), expires_at INTEGER,
    source TEXT NOT NULL DEFAULT 'local', quilt_type TEXT NOT NULL DEFAULT 'native', content_id TEXT,
    agent_url TEXT, api_url TEXT, capabilities TEXT, tags TEXT, status TEXT DEFAULT 'alive',
    version TEXT DEFAULT '1.0.0', deprecated_at INTEGER, sunset_at INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()))`,
	// reputation_snapshots needed by routing trust-score lookups
	`CREATE TABLE IF NOT EXISTS reputation_snapshots (
		id TEXT PRIMARY KEY, agent_id TEXT NOT NULL,
		availability REAL, error_rate REAL, fraud_rate REAL,
		p95_latency_ms INTEGER, probe_success REAL, cert_score REAL,
		reputation REAL, actions TEXT,
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE TABLE IF NOT EXISTS workflows (
		id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
		owner_id TEXT NOT NULL, dag_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
		status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
		template_id TEXT, metadata TEXT DEFAULT '{}',
		created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_wf_owner ON workflows(owner_id)`,
	`CREATE INDEX IF NOT EXISTS idx_wf_status ON workflows(status)`,
	`CREATE TABLE IF NOT EXISTS workflow_steps (
		id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id),
		step_type TEXT NOT NULL DEFAULT 'agent_call', agent_id TEXT, action TEXT,
		config_json TEXT DEFAULT '{}', position_x REAL DEFAULT 0, position_y REAL DEFAULT 0,
		depends_on TEXT DEFAULT '[]', timeout_ms INTEGER DEFAULT 30000,
		retry_count INTEGER DEFAULT 0, retry_delay_ms INTEGER DEFAULT 1000,
		condition_json TEXT, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_ws_workflow ON workflow_steps(workflow_id)`,
	`CREATE TABLE IF NOT EXISTS workflow_runs (
		id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id),
		status TEXT NOT NULL DEFAULT 'pending', trigger_type TEXT NOT NULL DEFAULT 'manual',
		input_json TEXT DEFAULT '{}', output_json TEXT, error_message TEXT,
		started_at INTEGER, completed_at INTEGER,
		created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_wr_workflow ON workflow_runs(workflow_id, created_at)`,
	`CREATE INDEX IF NOT EXISTS idx_wr_status ON workflow_runs(status)`,
	`CREATE TABLE IF NOT EXISTS workflow_step_runs (
		id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES workflow_runs(id),
		step_id TEXT NOT NULL REFERENCES workflow_steps(id),
		status TEXT NOT NULL DEFAULT 'pending', input_json TEXT, output_json TEXT,
		error_message TEXT, attempt INTEGER DEFAULT 1,
		started_at INTEGER, completed_at INTEGER, duration_ms INTEGER,
		delegated_to TEXT, created_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_wsr_run ON workflow_step_runs(run_id)`,
	`CREATE TABLE IF NOT EXISTS orchestrator_patterns (
		id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
		category TEXT NOT NULL DEFAULT 'general', dag_template_json TEXT NOT NULL,
		input_schema_json TEXT, tags TEXT DEFAULT '[]',
		usage_count INTEGER DEFAULT 0, is_builtin INTEGER DEFAULT 0,
		created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_op_category ON orchestrator_patterns(category)`,
	// Delegation & Routing tables (Sprint 14)
	`CREATE TABLE IF NOT EXISTS delegation_tasks (
		id TEXT PRIMARY KEY, parent_workflow_id TEXT, parent_step_id TEXT,
		delegator_id TEXT NOT NULL, delegate_id TEXT NOT NULL,
		task_type TEXT NOT NULL DEFAULT 'a2a_call', action TEXT NOT NULL,
		input_json TEXT NOT NULL DEFAULT '{}', output_json TEXT,
		status TEXT NOT NULL DEFAULT 'pending', error_message TEXT,
		delegation_token TEXT, timeout_ms INTEGER NOT NULL DEFAULT 30000,
		retry_count INTEGER NOT NULL DEFAULT 0, max_retries INTEGER NOT NULL DEFAULT 3,
		granted_scope TEXT, expires_at INTEGER, granted_by_proof_hash TEXT,
		parent_delegation_id TEXT, revocable INTEGER NOT NULL DEFAULT 1,
		started_at INTEGER, completed_at INTEGER,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_dt_parent_delegation ON delegation_tasks(parent_delegation_id)`,
	`CREATE INDEX IF NOT EXISTS idx_dt_expires_at ON delegation_tasks(expires_at)`,
	`CREATE INDEX IF NOT EXISTS idx_dt_delegator ON delegation_tasks(delegator_id)`,
	`CREATE INDEX IF NOT EXISTS idx_dt_delegate ON delegation_tasks(delegate_id)`,
	`CREATE INDEX IF NOT EXISTS idx_dt_status ON delegation_tasks(status)`,
	`CREATE INDEX IF NOT EXISTS idx_dt_workflow ON delegation_tasks(parent_workflow_id)`,
	`CREATE TABLE IF NOT EXISTS routing_decisions (
		id TEXT PRIMARY KEY, request_id TEXT NOT NULL,
		source_agent_id TEXT NOT NULL, target_agent_id TEXT NOT NULL,
		action TEXT NOT NULL, strategy TEXT NOT NULL DEFAULT 'capability',
		score REAL NOT NULL DEFAULT 0.0, context_json TEXT,
		candidates_json TEXT, selected_reason TEXT,
		latency_ms INTEGER, success INTEGER DEFAULT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_rd_source ON routing_decisions(source_agent_id)`,
	`CREATE INDEX IF NOT EXISTS idx_rd_action ON routing_decisions(action)`,
	// Workflow Events + Conflict Resolutions tables (Sprint 15)
	`CREATE TABLE IF NOT EXISTS workflow_events (
		id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id),
		run_id TEXT REFERENCES workflow_runs(id), step_id TEXT,
		event_type TEXT NOT NULL DEFAULT 'step_status',
		payload_json TEXT NOT NULL DEFAULT '{}',
		emitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
		consumed INTEGER NOT NULL DEFAULT 0)`,
	`CREATE INDEX IF NOT EXISTS idx_we_workflow ON workflow_events(workflow_id)`,
	`CREATE INDEX IF NOT EXISTS idx_we_run ON workflow_events(run_id)`,
	`CREATE INDEX IF NOT EXISTS idx_we_emitted ON workflow_events(emitted_at)`,
	`CREATE INDEX IF NOT EXISTS idx_we_consumed ON workflow_events(consumed, emitted_at)`,
	`CREATE TABLE IF NOT EXISTS conflict_resolutions (
		id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id),
		run_id TEXT REFERENCES workflow_runs(id), step_id TEXT,
		conflict_type TEXT NOT NULL DEFAULT 'competing_response',
		strategy TEXT NOT NULL DEFAULT 'highest_score',
		candidates_json TEXT NOT NULL DEFAULT '[]',
		winner_agent_id TEXT, winner_response TEXT,
		resolution_score REAL, resolved INTEGER NOT NULL DEFAULT 0,
		resolved_at INTEGER, metadata_json TEXT DEFAULT '{}',
		created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
	`CREATE INDEX IF NOT EXISTS idx_cr_workflow ON conflict_resolutions(workflow_id)`,
	`CREATE INDEX IF NOT EXISTS idx_cr_run ON conflict_resolutions(run_id)`,
	`CREATE INDEX IF NOT EXISTS idx_cr_resolved ON conflict_resolutions(resolved)`,
	`CREATE INDEX IF NOT EXISTS idx_cr_type ON conflict_resolutions(conflict_type)`
];

const db = createDbClient(env.DB);

beforeAll(async () => {
	await env.DB.batch(ORCH_TABLES.map((sql) => env.DB.prepare(sql)));
});

// ===================================================================
// DAG Validation
// ===================================================================
describe('DAG Validation', () => {
	it('should validate a simple linear DAG', () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'a', type: 'agent' },
				{ id: 'b', type: 'agent' },
				{ id: 'c', type: 'output' }
			],
			edges: [
				{ source: 'a', target: 'b' },
				{ source: 'b', target: 'c' }
			]
		};
		const result = validateDag(dag);
		expect(result.valid).toBe(true);
		expect(result.executionOrder).toEqual(['a', 'b', 'c']);
		expect(result.rootNodes).toEqual(['a']);
		expect(result.leafNodes).toEqual(['c']);
	});

	it('should validate a parallel DAG', () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'input', type: 'input' },
				{ id: 'a', type: 'agent' },
				{ id: 'b', type: 'agent' },
				{ id: 'output', type: 'output' }
			],
			edges: [
				{ source: 'input', target: 'a' },
				{ source: 'input', target: 'b' },
				{ source: 'a', target: 'output' },
				{ source: 'b', target: 'output' }
			]
		};
		const result = validateDag(dag);
		expect(result.valid).toBe(true);
		expect(result.rootNodes).toEqual(['input']);
		expect(result.leafNodes).toEqual(['output']);
		expect(result.executionOrder[0]).toBe('input');
		expect(result.executionOrder[result.executionOrder.length - 1]).toBe('output');
	});

	it('should reject a DAG with a cycle', () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'a', type: 'agent' },
				{ id: 'b', type: 'agent' }
			],
			edges: [
				{ source: 'a', target: 'b' },
				{ source: 'b', target: 'a' }
			]
		};
		const result = validateDag(dag);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('cycle'))).toBe(true);
	});

	it('should reject an empty DAG', () => {
		const result = validateDag({ nodes: [], edges: [] });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('no nodes');
	});

	it('should reject edges referencing non-existent nodes', () => {
		const dag: DagDefinition = {
			nodes: [{ id: 'a', type: 'agent' }],
			edges: [{ source: 'a', target: 'missing' }]
		};
		const result = validateDag(dag);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('missing');
	});

	it('should reject duplicate node IDs', () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'a', type: 'agent' },
				{ id: 'a', type: 'agent' }
			],
			edges: []
		};
		const result = validateDag(dag);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('duplicate');
	});

	it('should get dependencies and dependents', () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'a', type: 'agent' },
				{ id: 'b', type: 'agent' },
				{ id: 'c', type: 'output' }
			],
			edges: [
				{ source: 'a', target: 'b' },
				{ source: 'b', target: 'c' }
			]
		};
		expect(getDependencies(dag, 'b')).toEqual(['a']);
		expect(getDependents(dag, 'a')).toEqual(['b']);
		expect(getDependencies(dag, 'a')).toEqual([]);
		expect(getDependents(dag, 'c')).toEqual([]);
	});

	it('should parse valid DAG JSON', () => {
		const json = '{"nodes":[{"id":"a","type":"agent"}],"edges":[]}';
		const dag = parseDagJson(json);
		expect(dag).not.toBeNull();
		expect(dag!.nodes).toHaveLength(1);
	});

	it('should return null for invalid DAG JSON', () => {
		expect(parseDagJson('not json')).toBeNull();
		expect(parseDagJson('{"nodes":"bad"}')).toBeNull();
	});
});

// ===================================================================
// Workflow Engine
// ===================================================================
describe('Workflow Engine', () => {
	const ownerId = 'test-owner-' + nanoid(6);

	it('should create a workflow with steps', async () => {
		const dag: DagDefinition = {
			nodes: [
				{
					id: 'step1',
					type: 'agent',
					data: { stepType: 'agent_call', agentId: 'agent-1', action: 'review' }
				},
				{ id: 'step2', type: 'output', data: { stepType: 'transform', action: 'aggregate' } }
			],
			edges: [{ source: 'step1', target: 'step2' }]
		};

		const workflow = await createWorkflowWithSteps(db, {
			name: 'Test Workflow',
			description: 'A test workflow',
			ownerId,
			dag
		});

		expect(workflow.id).toBeTruthy();
		expect(workflow.name).toBe('Test Workflow');
		expect(workflow.status).toBe('draft');

		const steps = await getWorkflowSteps(db, workflow.id);
		expect(steps).toHaveLength(2);
		expect(steps.find((s) => s.id.endsWith(':step1'))?.stepType).toBe('agent_call');
	});

	it('should reject workflow with invalid DAG', async () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'a', type: 'agent' },
				{ id: 'b', type: 'agent' }
			],
			edges: [
				{ source: 'a', target: 'b' },
				{ source: 'b', target: 'a' }
			]
		};

		await expect(createWorkflowWithSteps(db, { name: 'Bad', ownerId, dag })).rejects.toThrow(
			'Invalid DAG'
		);
	});

	it('should list workflows by owner', async () => {
		const workflows = await listWorkflowsByOwner(db, ownerId);
		expect(workflows.length).toBeGreaterThanOrEqual(1);
		expect(workflows[0].ownerId).toBe(ownerId);
	});

	it('should update workflow DAG', async () => {
		const dag: DagDefinition = {
			nodes: [{ id: 'only', type: 'agent', data: { stepType: 'agent_call' } }],
			edges: []
		};
		const wf = await createWorkflowWithSteps(db, { name: 'Update Test', ownerId, dag });

		const newDag: DagDefinition = {
			nodes: [
				{ id: 'new1', type: 'agent', data: { stepType: 'agent_call' } },
				{ id: 'new2', type: 'output', data: { stepType: 'transform' } }
			],
			edges: [{ source: 'new1', target: 'new2' }]
		};

		const updated = await updateWorkflowDag(db, wf.id, newDag);
		expect(updated).not.toBeNull();

		const steps = await getWorkflowSteps(db, wf.id);
		expect(steps).toHaveLength(2);
		expect(steps.find((s) => s.id.endsWith(':new1'))).toBeTruthy();
	});

	it('should start and execute a workflow run', async () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 's1', type: 'agent', data: { stepType: 'agent_call' } },
				{ id: 's2', type: 'output', data: { stepType: 'transform' } }
			],
			edges: [{ source: 's1', target: 's2' }]
		};
		const wf = await createWorkflowWithSteps(db, { name: 'Run Test', ownerId, dag });

		// Activate workflow
		await updateWorkflow(db, wf.id, { status: 'active' });

		const runId = await startWorkflowRun(db, wf.id, { input: 'hello' });
		expect(runId).toBeTruthy();

		// Mock step executor
		const executor: StepExecutor = {
			async execute(step, _runInput, _prev) {
				return { result: `executed-${step.id}` };
			}
		};

		const result = await executeWorkflowRun(db, runId, executor);
		expect(result.status).toBe('completed');
		expect(result.stepResults).toHaveLength(2);
		expect(result.stepResults.every((sr) => sr.status === 'completed')).toBe(true);
	});

	it('should handle step failure in workflow run', async () => {
		const dag: DagDefinition = {
			nodes: [
				{ id: 'fail_step', type: 'agent', data: { stepType: 'agent_call' } },
				{ id: 'never_reached', type: 'output', data: { stepType: 'transform' } }
			],
			edges: [{ source: 'fail_step', target: 'never_reached' }]
		};
		const wf = await createWorkflowWithSteps(db, { name: 'Fail Test', ownerId, dag });
		await updateWorkflow(db, wf.id, { status: 'active' });

		const runId = await startWorkflowRun(db, wf.id);

		const executor: StepExecutor = {
			async execute(step) {
				if (step.id.endsWith(':fail_step')) throw new Error('Boom');
				return { ok: true };
			}
		};

		const result = await executeWorkflowRun(db, runId, executor);
		expect(result.status).toBe('failed');
		expect(result.stepResults.find((sr) => sr.stepId.endsWith(':fail_step'))?.status).toBe(
			'failed'
		);
	});

	it('should reject starting a run on a draft workflow', async () => {
		const dag: DagDefinition = {
			nodes: [{ id: 'x', type: 'agent' }],
			edges: []
		};
		const wf = await createWorkflowWithSteps(db, { name: 'Draft', ownerId, dag });

		await expect(startWorkflowRun(db, wf.id)).rejects.toThrow('not active');
	});

	it('should delete a workflow (after deleting steps)', async () => {
		const dag: DagDefinition = {
			nodes: [{ id: 'del', type: 'agent' }],
			edges: []
		};
		const wf = await createWorkflowWithSteps(db, { name: 'Delete Me', ownerId, dag });
		// Must delete child steps first due to FK constraints
		const { deleteWorkflowSteps } = await import('../src/lib/db/repositories');
		await deleteWorkflowSteps(db, wf.id);
		await deleteWorkflow(db, wf.id);
		const found = await getWorkflowById(db, wf.id);
		expect(found).toBeNull();
	});
});

// ===================================================================
// Templates
// ===================================================================
describe('Workflow Templates', () => {
	it('should have valid builtin templates', () => {
		for (const tmpl of BUILTIN_TEMPLATES) {
			const result = validateDag(tmpl.dag);
			expect(result.valid).toBe(true);
			expect(tmpl.name).toBeTruthy();
			expect(tmpl.category).toBeTruthy();
		}
	});

	it('should seed builtin templates (idempotent)', async () => {
		const seeded1 = await seedBuiltinTemplates(db);
		expect(seeded1).toBe(BUILTIN_TEMPLATES.length);

		// Second call should seed 0
		const seeded2 = await seedBuiltinTemplates(db);
		expect(seeded2).toBe(0);
	});

	it('should list all patterns after seeding', async () => {
		const patterns = await listAllPatterns(db);
		expect(patterns.length).toBeGreaterThanOrEqual(BUILTIN_TEMPLATES.length);
	});

	it('should create and delete a custom pattern', async () => {
		const pattern = await createPattern(db, {
			id: nanoid(),
			name: 'Custom Pattern',
			description: 'Test custom pattern',
			category: 'general',
			dagTemplateJson: JSON.stringify({
				nodes: [{ id: 'a', type: 'agent' }],
				edges: []
			}),
			tags: JSON.stringify(['test']),
			isBuiltin: 0
		});

		expect(pattern.name).toBe('Custom Pattern');

		const found = await getPatternById(db, pattern.id);
		expect(found).not.toBeNull();
		expect(found!.name).toBe('Custom Pattern');

		await deletePattern(db, pattern.id);
		const deleted = await getPatternById(db, pattern.id);
		expect(deleted).toBeNull();
	});
});

// ===================================================================
// Delegation Repository CRUD (Sprint 14)
// ===================================================================
describe('Delegation Repository', () => {
	const delegatorId = 'delegator-' + nanoid(6);
	const delegateId = 'delegate-' + nanoid(6);
	let taskId: string;

	it('should create a delegation task', async () => {
		taskId = nanoid();
		const task = await createDelegationTask(db, {
			id: taskId,
			delegatorId,
			delegateId,
			taskType: 'a2a_call',
			action: 'nlp.summarize',
			inputJson: JSON.stringify({ text: 'hello world' }),
			status: 'pending',
			timeoutMs: 10000,
			maxRetries: 2,
			delegationToken: nanoid()
		});
		expect(task.id).toBe(taskId);
		expect(task.delegatorId).toBe(delegatorId);
		expect(task.status).toBe('pending');
	});

	it('should get delegation task by ID', async () => {
		const task = await getDelegationTaskById(db, taskId);
		expect(task).not.toBeNull();
		expect(task!.action).toBe('nlp.summarize');
	});

	it('should list delegations by delegator', async () => {
		const tasks = await listDelegationsByDelegator(db, delegatorId);
		expect(tasks.length).toBeGreaterThanOrEqual(1);
		expect(tasks[0].delegatorId).toBe(delegatorId);
	});

	it('should list delegations by status', async () => {
		const tasks = await listDelegationsByStatus(db, 'pending');
		expect(tasks.length).toBeGreaterThanOrEqual(1);
	});

	it('should update delegation task status', async () => {
		const updated = await updateDelegationTask(db, taskId, {
			status: 'completed',
			outputJson: JSON.stringify({ summary: 'done' }),
			completedAt: Math.floor(Date.now() / 1000)
		});
		expect(updated).not.toBeNull();
		expect(updated!.status).toBe('completed');
		expect(updated!.outputJson).toContain('done');
	});

	it('should delete a delegation task', async () => {
		await deleteDelegationTask(db, taskId);
		const found = await getDelegationTaskById(db, taskId);
		expect(found).toBeNull();
	});
});

// ===================================================================
// Routing Decision Repository CRUD (Sprint 14)
// ===================================================================
describe('Routing Decision Repository', () => {
	const sourceAgent = 'source-' + nanoid(6);
	let decisionId: string;

	it('should create a routing decision', async () => {
		decisionId = nanoid();
		const decision = await createRoutingDecision(db, {
			id: decisionId,
			requestId: nanoid(),
			sourceAgentId: sourceAgent,
			targetAgentId: 'target-agent-1',
			action: 'nlp.translate',
			strategy: 'capability',
			score: 0.85,
			contextJson: JSON.stringify({ caps: ['nlp.translate'] }),
			candidatesJson: JSON.stringify([{ id: 'target-agent-1', score: 0.85 }]),
			selectedReason: 'full_match',
			latencyMs: 12
		});
		expect(decision.id).toBe(decisionId);
		expect(decision.score).toBe(0.85);
	});

	it('should get routing decision by ID', async () => {
		const d = await getRoutingDecisionById(db, decisionId);
		expect(d).not.toBeNull();
		expect(d!.action).toBe('nlp.translate');
	});

	it('should list routing decisions by source agent', async () => {
		const decisions = await listRoutingDecisionsBySource(db, sourceAgent);
		expect(decisions.length).toBeGreaterThanOrEqual(1);
	});

	it('should update routing decision outcome', async () => {
		const updated = await updateRoutingDecisionOutcome(db, decisionId, true, 45);
		expect(updated).not.toBeNull();
		expect(updated!.success).toBe(1);
		expect(updated!.latencyMs).toBe(45);
	});
});

// ===================================================================
// Routing Service (Sprint 14)
// ===================================================================
describe('Routing Service', () => {
	const routeTestPrefix = 'rt-' + nanoid(6);
	const sourceAgent = `${routeTestPrefix}-source`;

	beforeAll(async () => {
		// Seed test agents with capabilities into the agents table
		await env.DB.batch([
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`
			).bind(
				`${routeTestPrefix}-nlp`,
				'https://nlp.example.com/a2a',
				JSON.stringify(['nlp.summarize', 'nlp.translate']),
				'alive'
			),
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`
			).bind(
				`${routeTestPrefix}-vision`,
				'https://vision.example.com/a2a',
				JSON.stringify(['vision.classify', 'vision.detect']),
				'alive'
			),
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`
			).bind(
				`${routeTestPrefix}-multi`,
				'https://multi.example.com/a2a',
				JSON.stringify(['nlp.summarize', 'vision.classify']),
				'alive'
			),
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`
			).bind(
				sourceAgent,
				'https://source.example.com/a2a',
				JSON.stringify(['orchestration']),
				'alive'
			)
		]);
	});

	it('should route to the best agent by capability', async () => {
		const result = await routeToAgent(db, {
			sourceAgentId: sourceAgent,
			action: 'nlp.summarize',
			requiredCapabilities: ['nlp.summarize']
		});

		expect(result.requestId).toBeTruthy();
		expect(result.selectedAgent).not.toBeNull();
		expect(result.candidates.length).toBeGreaterThanOrEqual(1);
		// The selected agent should have nlp.summarize
		expect(result.selectedAgent!.capabilities).toContain('nlp.summarize');
	});

	it('should exclude the source agent from candidates', async () => {
		const result = await routeToAgent(db, {
			sourceAgentId: sourceAgent,
			action: 'any'
		});

		const candidateIds = result.candidates.map((c) => c.agentId);
		expect(candidateIds).not.toContain(sourceAgent);
	});

	it('should exclude specific agents', async () => {
		const result = await routeToAgent(db, {
			sourceAgentId: sourceAgent,
			action: 'nlp.summarize',
			requiredCapabilities: ['nlp.summarize'],
			excludeAgents: [`${routeTestPrefix}-nlp`]
		});

		const candidateIds = result.candidates.map((c) => c.agentId);
		expect(candidateIds).not.toContain(`${routeTestPrefix}-nlp`);
		// multi agent also has nlp.summarize
		if (result.selectedAgent) {
			expect(result.selectedAgent.agentId).toBe(`${routeTestPrefix}-multi`);
		}
	});

	it('should return no agent when no candidates match', async () => {
		const result = await routeToAgent(db, {
			sourceAgentId: sourceAgent,
			action: 'nonexistent.capability',
			requiredCapabilities: ['nonexistent.capability']
		});

		expect(result.selectedAgent).toBeNull();
		expect(result.candidates).toHaveLength(0);
	});

	it('should rank candidates with higher capability match first', async () => {
		const result = await routeToAgent(db, {
			sourceAgentId: sourceAgent,
			action: 'nlp.summarize',
			requiredCapabilities: ['nlp.summarize', 'nlp.translate']
		});

		if (result.candidates.length >= 2) {
			// The nlp agent has both capabilities, multi has only one
			const nlpCandidate = result.candidates.find((c) => c.agentId === `${routeTestPrefix}-nlp`);
			const multiCandidate = result.candidates.find(
				(c) => c.agentId === `${routeTestPrefix}-multi`
			);
			if (nlpCandidate && multiCandidate) {
				expect(nlpCandidate.capabilityScore).toBeGreaterThan(multiCandidate.capabilityScore);
			}
		}
	});
});

// ===================================================================
// Delegation Service (Sprint 14)
// ===================================================================
describe('Delegation Service', () => {
	const delegatePrefix = 'del-' + nanoid(6);

	beforeAll(async () => {
		// Seed agents for delegation tests
		await env.DB.batch([
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`
			).bind(
				`${delegatePrefix}-worker`,
				'https://worker.example.com/a2a',
				JSON.stringify(['nlp.summarize']),
				'alive'
			),
			env.DB.prepare(
				`INSERT OR IGNORE INTO agent_addrs (agent_id, agent_url, capabilities, status, public_key_hex, signature_hex, signer_id) VALUES (?, ?, ?, ?, 'test', 'test', 'test')`
			).bind(
				`${delegatePrefix}-delegator`,
				'https://delegator.example.com/a2a',
				JSON.stringify(['orchestration']),
				'alive'
			)
		]);
	});

	it('should create delegation with explicit target (no executor)', async () => {
		const result = await delegateTask(db, {
			delegatorId: `${delegatePrefix}-delegator`,
			action: 'nlp.summarize',
			input: { text: 'test input' },
			targetAgentId: `${delegatePrefix}-worker`
		});

		expect(result.taskId).toBeTruthy();
		expect(result.delegateId).toBe(`${delegatePrefix}-worker`);
		// Without executor, returns pending/completed stub
		expect(result.status).toBe('completed');
	});

	it('should create delegation via routing (no executor)', async () => {
		const result = await delegateTask(db, {
			delegatorId: `${delegatePrefix}-delegator`,
			action: 'nlp.summarize',
			input: { text: 'route me' },
			requiredCapabilities: ['nlp.summarize']
		});

		expect(result.taskId).toBeTruthy();
		expect(result.delegateId).toBeTruthy();
		expect(result.status).toBe('completed');
	});

	it('should fail delegation when no agent matches', async () => {
		const result = await delegateTask(db, {
			delegatorId: `${delegatePrefix}-delegator`,
			action: 'nonexistent.action',
			input: {},
			requiredCapabilities: ['nonexistent.capability']
		});

		expect(result.status).toBe('failed');
		expect(result.error).toContain('No agent found');
	});

	it('should execute delegation with a mock executor', async () => {
		const mockExecutor: DelegationExecutor = {
			async execute(agentId, action, input) {
				return { agentId, action, processed: true, summary: 'Mock result' };
			}
		};

		const result = await delegateTask(
			db,
			{
				delegatorId: `${delegatePrefix}-delegator`,
				action: 'nlp.summarize',
				input: { text: 'execute me' },
				targetAgentId: `${delegatePrefix}-worker`,
				maxRetries: 0
			},
			mockExecutor
		);

		expect(result.status).toBe('completed');
		expect(result.output).toHaveProperty('processed', true);

		// Verify the delegation record was persisted
		const task = await getDelegationTaskById(db, result.taskId);
		expect(task).not.toBeNull();
		expect(task!.status).toBe('completed');
	});

	it('should cancel a pending delegation', async () => {
		const pending = await delegateTask(db, {
			delegatorId: `${delegatePrefix}-delegator`,
			action: 'nlp.summarize',
			input: {},
			targetAgentId: `${delegatePrefix}-worker`
		});
		// Mark it back to pending for this test
		await updateDelegationTask(db, pending.taskId, { status: 'pending' });

		const cancelled = await cancelDelegation(db, pending.taskId);
		expect(cancelled).not.toBeNull();
		expect(cancelled!.status).toBe('failed');
		expect(cancelled!.errorMessage).toContain('Cancelled');
	});
});

// ===================================================================
// Step Executors (Sprint 14)
// ===================================================================
describe('Step Executors', () => {
	it('NoOpExecutor should echo step info', async () => {
		const executor = new NoOpExecutor();
		const mockStep = {
			id: 'step-1',
			workflowId: 'wf-1',
			stepType: 'no_op',
			agentId: null,
			action: 'test.action',
			configJson: '{}',
			positionX: 0,
			positionY: 0,
			dependsOn: '[]',
			timeoutMs: 30000,
			retryCount: 0,
			retryDelayMs: 1000,
			conditionJson: null,
			createdAt: Math.floor(Date.now() / 1000)
		} as any;

		const result = await executor.execute(mockStep, '{}', new Map());
		expect(result).toHaveProperty('stepId', 'step-1');
		expect(result).toHaveProperty('echo', 'no-op');
		expect(result).toHaveProperty('inputReceived', true);
	});

	it('CompositeExecutor should dispatch no_op steps to NoOpExecutor', async () => {
		const composite = new CompositeExecutor(db);
		const mockStep = {
			id: 'step-composite-1',
			workflowId: 'wf-1',
			stepType: 'no_op',
			agentId: null,
			action: 'test',
			configJson: '{}',
			positionX: 0,
			positionY: 0,
			dependsOn: '[]',
			timeoutMs: 30000,
			retryCount: 0,
			retryDelayMs: 1000,
			conditionJson: null,
			createdAt: Math.floor(Date.now() / 1000)
		} as any;

		const result = await composite.execute(mockStep, '{}', new Map());
		expect(result).toHaveProperty('echo', 'no-op');
	});

	it('CompositeExecutor should dispatch passthrough steps to NoOpExecutor', async () => {
		const composite = new CompositeExecutor(db);
		const mockStep = {
			id: 'step-pt-1',
			workflowId: 'wf-1',
			stepType: 'passthrough',
			agentId: null,
			action: 'test',
			configJson: '{}',
			positionX: 0,
			positionY: 0,
			dependsOn: '[]',
			timeoutMs: 30000,
			retryCount: 0,
			retryDelayMs: 1000,
			conditionJson: null,
			createdAt: Math.floor(Date.now() / 1000)
		} as any;

		const result = await composite.execute(mockStep, '{}', new Map());
		expect(result).toHaveProperty('echo', 'no-op');
	});

	it('CompositeExecutor should fallback to NoOpExecutor for unknown types', async () => {
		const composite = new CompositeExecutor(db);
		const mockStep = {
			id: 'step-unknown-1',
			workflowId: 'wf-1',
			stepType: 'totally_unknown_type',
			agentId: null,
			action: 'test',
			configJson: '{}',
			positionX: 0,
			positionY: 0,
			dependsOn: '[]',
			timeoutMs: 30000,
			retryCount: 0,
			retryDelayMs: 1000,
			conditionJson: null,
			createdAt: Math.floor(Date.now() / 1000)
		} as any;

		const result = await composite.execute(mockStep, '{}', new Map());
		expect(result).toHaveProperty('echo', 'no-op');
	});

	it('CompositeExecutor should accept custom executor registration', async () => {
		const composite = new CompositeExecutor(db);
		const customExecutor: import('../src/lib/services/orchestration/engine').StepExecutor = {
			async execute(step, runInput, previousOutputs) {
				return { custom: true, stepId: step.id };
			}
		};
		composite.registerExecutor('custom_type', customExecutor);

		const mockStep = {
			id: 'step-custom-1',
			workflowId: 'wf-1',
			stepType: 'custom_type',
			agentId: null,
			action: 'test',
			configJson: '{}',
			positionX: 0,
			positionY: 0,
			dependsOn: '[]',
			timeoutMs: 30000,
			retryCount: 0,
			retryDelayMs: 1000,
			conditionJson: null,
			createdAt: Math.floor(Date.now() / 1000)
		} as any;

		const result = (await composite.execute(mockStep, '{}', new Map())) as any;
		expect(result).toHaveProperty('custom', true);
		expect(result).toHaveProperty('stepId', 'step-custom-1');
	});
});

// ===================================================================
// Sprint 15: Workflow Events Repository
// ===================================================================
describe('Workflow Events Repository', () => {
	const wfId = `wf-evt-${nanoid(6)}`;

	beforeAll(async () => {
		// Create a parent workflow for FK references
		await env.DB.prepare('INSERT INTO workflows (id, name, owner_id, dag_json) VALUES (?, ?, ?, ?)')
			.bind(wfId, 'Event Test Workflow', 'owner-evt', '{"nodes":[],"edges":[]}')
			.run();
	});

	it('should create and retrieve a workflow event', async () => {
		const id = nanoid();
		const event = await createWorkflowEvent(db, {
			id,
			workflowId: wfId,
			eventType: 'step_started',
			payloadJson: JSON.stringify({ stepId: 's1', agentId: 'a1' })
		});
		expect(event.id).toBe(id);
		expect(event.eventType).toBe('step_started');
		expect(event.consumed).toBe(0);

		const fetched = await getWorkflowEventById(db, id);
		expect(fetched).not.toBeNull();
		expect(fetched!.workflowId).toBe(wfId);
	});

	it('should list events by run', async () => {
		const runId = `run-evt-${nanoid(6)}`;
		await env.DB.prepare('INSERT INTO workflow_runs (id, workflow_id, status) VALUES (?, ?, ?)')
			.bind(runId, wfId, 'running')
			.run();

		for (let i = 0; i < 3; i++) {
			await createWorkflowEvent(db, {
				id: nanoid(),
				workflowId: wfId,
				runId,
				eventType: 'step_completed',
				payloadJson: JSON.stringify({ step: i })
			});
		}

		const events = await listEventsByRun(db, runId);
		expect(events.length).toBe(3);
	});

	it('should mark events as consumed', async () => {
		const runId = `run-consume-${nanoid(6)}`;
		await env.DB.prepare('INSERT INTO workflow_runs (id, workflow_id, status) VALUES (?, ?, ?)')
			.bind(runId, wfId, 'running')
			.run();

		const e1 = await createWorkflowEvent(db, {
			id: nanoid(),
			workflowId: wfId,
			runId,
			eventType: 'step_started',
			payloadJson: '{}'
		});

		const unconsumed = await listUnconsumedEvents(db, runId);
		expect(unconsumed.length).toBeGreaterThanOrEqual(1);

		await markEventsConsumed(db, [e1.id]);

		const afterConsume = await listUnconsumedEvents(db, runId);
		const found = afterConsume.find((e) => e.id === e1.id);
		expect(found).toBeUndefined();
	});
});

// ===================================================================
// Sprint 15: Conflict Resolution Repository
// ===================================================================
describe('Conflict Resolution Repository', () => {
	const wfId = `wf-cr-${nanoid(6)}`;

	beforeAll(async () => {
		await env.DB.prepare('INSERT INTO workflows (id, name, owner_id, dag_json) VALUES (?, ?, ?, ?)')
			.bind(wfId, 'Conflict Test Workflow', 'owner-cr', '{"nodes":[],"edges":[]}')
			.run();
	});

	it('should create and retrieve a conflict resolution', async () => {
		const id = nanoid();
		const cr = await createConflictResolution(db, {
			id,
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'highest_score',
			candidatesJson: JSON.stringify([
				{ agentId: 'a1', score: 0.9 },
				{ agentId: 'a2', score: 0.7 }
			])
		});
		expect(cr.id).toBe(id);
		expect(cr.resolved).toBe(0);

		const fetched = await getConflictResolutionById(db, id);
		expect(fetched).not.toBeNull();
		expect(fetched!.strategy).toBe('highest_score');
	});

	it('should resolve a conflict', async () => {
		const id = nanoid();
		await createConflictResolution(db, {
			id,
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'voting',
			candidatesJson: '[]'
		});

		const resolved = await resolveConflict(db, id, {
			winnerAgentId: 'agent-winner',
			winnerResponse: JSON.stringify({ answer: 42 }),
			resolutionScore: 0.95
		});
		expect(resolved).not.toBeNull();
		expect(resolved!.resolved).toBe(1);
		expect(resolved!.winnerAgentId).toBe('agent-winner');
		expect(resolved!.resolvedAt).toBeGreaterThan(0);
	});

	it('should list unresolved conflicts', async () => {
		const unresolvedId = nanoid();
		await createConflictResolution(db, {
			id: unresolvedId,
			workflowId: wfId,
			conflictType: 'timeout_race',
			strategy: 'first_wins',
			candidatesJson: '[]'
		});

		const unresolved = await listUnresolvedConflicts(db, wfId);
		const found = unresolved.find((c) => c.id === unresolvedId);
		expect(found).toBeDefined();
		expect(found!.resolved).toBe(0);
	});
});

// ===================================================================
// Sprint 15: Conflict Resolution Service
// ===================================================================
describe('Conflict Resolution Service', () => {
	const wfId = `wf-crs-${nanoid(6)}`;

	beforeAll(async () => {
		await env.DB.prepare('INSERT INTO workflows (id, name, owner_id, dag_json) VALUES (?, ?, ?, ?)')
			.bind(wfId, 'CRS Test Workflow', 'owner-crs', '{"nodes":[],"edges":[]}')
			.run();
	});

	const makeCandidates = (): ConflictCandidate[] => [
		{ agentId: 'agent-a', response: { answer: 'A' }, score: 0.85, timestamp: 1000 },
		{ agentId: 'agent-b', response: { answer: 'B' }, score: 0.92, timestamp: 1001 },
		{ agentId: 'agent-c', response: { answer: 'C' }, score: 0.78, timestamp: 999 }
	];

	it('should auto-resolve with highest_score strategy', async () => {
		const outcome = await raiseConflict(db, {
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'highest_score',
			candidates: makeCandidates()
		});
		expect(outcome.resolved).toBe(true);
		expect(outcome.winnerAgentId).toBe('agent-b');
		expect(outcome.resolutionScore).toBe(0.92);
	});

	it('should auto-resolve with first_wins strategy', async () => {
		const outcome = await raiseConflict(db, {
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'first_wins',
			candidates: makeCandidates()
		});
		expect(outcome.resolved).toBe(true);
		expect(outcome.winnerAgentId).toBe('agent-c'); // lowest timestamp = 999
	});

	it('should auto-resolve with voting strategy', async () => {
		const candidates: ConflictCandidate[] = [
			{ agentId: 'agent-x', response: 'yes', score: 1, timestamp: 1 },
			{ agentId: 'agent-x', response: 'yes', score: 1, timestamp: 2 },
			{ agentId: 'agent-y', response: 'no', score: 1, timestamp: 3 }
		];
		const outcome = await raiseConflict(db, {
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'voting',
			candidates
		});
		expect(outcome.resolved).toBe(true);
		expect(outcome.winnerAgentId).toBe('agent-x'); // 2 votes vs 1
	});

	it('should leave manual strategy unresolved', async () => {
		const outcome = await raiseConflict(db, {
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'manual',
			candidates: makeCandidates()
		});
		expect(outcome.resolved).toBe(false);
		expect(outcome.winnerAgentId).toBeUndefined();
	});

	it('should manually resolve a conflict', async () => {
		const outcome = await raiseConflict(db, {
			workflowId: wfId,
			conflictType: 'competing_response',
			strategy: 'manual',
			candidates: makeCandidates()
		});
		expect(outcome.resolved).toBe(false);

		const resolved = await manuallyResolveConflict(
			db,
			outcome.conflictId,
			'agent-manual',
			{ override: true },
			1.0
		);
		expect(resolved).not.toBeNull();
		expect(resolved!.resolved).toBe(1);
		expect(resolved!.winnerAgentId).toBe('agent-manual');
	});

	it('should get pending conflicts for a workflow', async () => {
		// Raise a manual (unresolved) conflict
		await raiseConflict(db, {
			workflowId: wfId,
			conflictType: 'timeout_race',
			strategy: 'manual',
			candidates: makeCandidates()
		});

		const pending = await getPendingConflicts(db, wfId);
		expect(pending.length).toBeGreaterThanOrEqual(1);
		expect(pending.every((c) => c.resolved === 0)).toBe(true);
	});
});

// ===================================================================
// Sprint 15: Workflow Event Streaming Service
// ===================================================================
describe('Workflow Event Streaming Service', () => {
	const wfId = `wf-stream-${nanoid(6)}`;
	const runId = `run-stream-${nanoid(6)}`;

	beforeAll(async () => {
		await env.DB.prepare('INSERT INTO workflows (id, name, owner_id, dag_json) VALUES (?, ?, ?, ?)')
			.bind(wfId, 'Stream Test Workflow', 'owner-stream', '{"nodes":[],"edges":[]}')
			.run();
		await env.DB.prepare('INSERT INTO workflow_runs (id, workflow_id, status) VALUES (?, ?, ?)')
			.bind(runId, wfId, 'running')
			.run();
	});

	it('should emit a workflow event', async () => {
		const event = await emitEvent(db, {
			workflowId: wfId,
			runId,
			stepId: 'step-1',
			eventType: 'step_started',
			payload: { agentId: 'agent-1', action: 'test' }
		});
		expect(event.id).toBeDefined();
		expect(event.eventType).toBe('step_started');
		expect(event.consumed).toBe(0);
		expect(JSON.parse(event.payloadJson)).toHaveProperty('agentId', 'agent-1');
	});

	it('should get event history for a run', async () => {
		// Emit several events
		for (const eventType of ['step_started', 'step_completed', 'run_completed'] as const) {
			await emitEvent(db, {
				workflowId: wfId,
				runId,
				eventType,
				payload: { status: eventType }
			});
		}

		const history = await getRunEventHistory(db, runId);
		expect(history.length).toBeGreaterThanOrEqual(3);
		expect(history.every((e) => e.runId === runId)).toBe(true);
	});

	it('should emit events with different types', async () => {
		const types: WorkflowEventType[] = [
			'delegation_started',
			'delegation_completed',
			'routing_decision',
			'conflict_raised',
			'conflict_resolved',
			'system'
		];

		for (const eventType of types) {
			const event = await emitEvent(db, {
				workflowId: wfId,
				runId,
				eventType,
				payload: { type: eventType }
			});
			expect(event.eventType).toBe(eventType);
		}

		const history = await getRunEventHistory(db, runId);
		for (const type of types) {
			expect(history.some((e) => e.eventType === type)).toBe(true);
		}
	});
});
