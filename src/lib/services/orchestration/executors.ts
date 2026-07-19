/**
 * Step Executors — Pluggable execution strategies for workflow steps.
 * Phase 6 — Sprint 14: A2A Routing + Sub-agent Delegation
 *
 * Provides concrete StepExecutor implementations:
 *  - NoOpExecutor: passthrough for testing
 *  - A2ACallExecutor: makes A2A JSON-RPC calls to target agents
 *  - DelegationExecutor: delegates via routing + delegation service
 *  - CompositeExecutor: routes to the right executor based on step type
 */

import type { DbClient } from '$lib/db/client';
import type { WorkflowStepRecord } from '$lib/db/schema';
import type { StepExecutor } from './engine';
import { delegateTask, type DelegationExecutor } from './delegation';

import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'executors');

/**
 * No-op executor — echoes input for testing and dry runs.
 */
export class NoOpExecutor implements StepExecutor {
	async execute(
		step: WorkflowStepRecord,
		_runInput: string,
		_previousOutputs: Map<string, string>
	): Promise<unknown> {
		return {
			stepId: step.id,
			stepType: step.stepType,
			action: step.action,
			echo: 'no-op',
			inputReceived: true
		};
	}
}

/**
 * A2A Call Executor — sends JSON-RPC calls to a target agent's endpoint.
 * The target agent URL is resolved from the step's agentId.
 */
export class A2ACallExecutor implements StepExecutor {
	constructor(
		private db: DbClient,
		private fetchFn: typeof fetch = fetch
	) {}

	async execute(
		step: WorkflowStepRecord,
		runInput: string,
		previousOutputs: Map<string, string>
	): Promise<unknown> {
		if (!step.agentId) {
			throw new Error(`Step ${step.id} has no agentId for A2A call`);
		}

		const action = step.action ?? 'default';
		let config: Record<string, unknown> = {};
		let parsedInput: Record<string, unknown> = {};
		try {
			config = step.configJson ? JSON.parse(step.configJson) : {};
		} catch {
			log.warn('execute', `Corrupt configJson for step ${step.id}`);
		}
		try {
			parsedInput = JSON.parse(runInput);
		} catch {
			log.warn('execute', `Corrupt runInput for step ${step.id}`);
		}
		const input = {
			...parsedInput,
			...config,
			previousOutputs: Object.fromEntries(previousOutputs)
		};

		// Build JSON-RPC request
		const rpcRequest = {
			jsonrpc: '2.0',
			method: 'message/send',
			id: crypto.randomUUID(),
			params: {
				message: {
					role: 'user',
					parts: [{ text: JSON.stringify({ action, ...input }) }]
				}
			}
		};

		// Resolve agent URL from registry
		const agent = await this.db.query.agentAddrs.findFirst({
			where: (agentAddrs, { eq }) => eq(agentAddrs.agentId, step.agentId!)
		});

		if (!agent) {
			throw new Error(`Agent ${step.agentId} not found in registry`);
		}

		const targetUrl = agent.apiUrl ?? agent.agentUrl;
		if (!targetUrl) {
			throw new Error(`Agent ${step.agentId} has no endpoint URL`);
		}

		log.info('execute', `A2A call to ${step.agentId}: ${action}`, { targetUrl });

		const response = await this.fetchFn(targetUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(rpcRequest)
		});

		if (!response.ok) {
			throw new Error(
				`A2A call to ${step.agentId} failed: ${response.status} ${response.statusText}`
			);
		}

		const result = await response.json();
		return result;
	}
}

/**
 * Delegation Step Executor — delegates to the best agent via routing service.
 * Used for steps with stepType='delegation'.
 */
export class DelegationStepExecutor implements StepExecutor {
	constructor(
		private db: DbClient,
		private delegationExecutor?: DelegationExecutor
	) {}

	async execute(
		step: WorkflowStepRecord,
		runInput: string,
		previousOutputs: Map<string, string>
	): Promise<unknown> {
		const action = step.action ?? 'default';
		let config: Record<string, unknown> = {};
		let parsedInput: Record<string, unknown> = {};
		try {
			config = step.configJson ? JSON.parse(step.configJson) : {};
		} catch {
			log.warn('execute', `Corrupt configJson for step ${step.id}`);
		}
		try {
			parsedInput = JSON.parse(runInput);
		} catch {
			log.warn('execute', `Corrupt runInput for step ${step.id}`);
		}
		const input = {
			...parsedInput,
			...config,
			previousOutputs: Object.fromEntries(previousOutputs)
		};
		const capabilities = config.requiredCapabilities as string[] | undefined;

		const result = await delegateTask(
			this.db,
			{
				delegatorId: step.agentId ?? 'system',
				action,
				input,
				parentWorkflowId: step.workflowId,
				parentStepId: step.id,
				requiredCapabilities: capabilities,
				targetAgentId: step.agentId ?? undefined,
				timeoutMs: step.timeoutMs ?? 30000,
				maxRetries: step.retryCount ?? 3
			},
			this.delegationExecutor
		);

		if (result.status === 'failed') {
			throw new Error(result.error ?? `Delegation to ${result.delegateId} failed`);
		}

		return result.output;
	}
}

/**
 * Composite Executor — routes to the appropriate executor based on step type.
 */
export class CompositeExecutor implements StepExecutor {
	private executors: Map<string, StepExecutor>;
	private fallback: StepExecutor;

	constructor(db: DbClient, delegationExecutor?: DelegationExecutor, fetchFn?: typeof fetch) {
		this.fallback = new NoOpExecutor();
		this.executors = new Map<string, StepExecutor>([
			['agent_call', new A2ACallExecutor(db, fetchFn)],
			['a2a_call', new A2ACallExecutor(db, fetchFn)],
			['delegation', new DelegationStepExecutor(db, delegationExecutor)],
			['no_op', new NoOpExecutor()],
			['passthrough', new NoOpExecutor()]
		]);
	}

	/** Register a custom executor for a step type */
	registerExecutor(stepType: string, executor: StepExecutor): void {
		this.executors.set(stepType, executor);
	}

	async execute(
		step: WorkflowStepRecord,
		runInput: string,
		previousOutputs: Map<string, string>
	): Promise<unknown> {
		const executor = this.executors.get(step.stepType) ?? this.fallback;
		log.info(
			'execute',
			`Dispatching step ${step.id} (type=${step.stepType}) to ${executor.constructor.name}`
		);
		return executor.execute(step, runInput, previousOutputs);
	}
}
