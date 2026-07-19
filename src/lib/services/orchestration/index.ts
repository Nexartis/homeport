/**
 * Orchestration Service — Multi-Agent Workflow Orchestration
 * Phase 6 — Sprints 13–14
 *
 * Re-exports all orchestration modules for convenient imports.
 */

// DAG validation
export {
	validateDag,
	getDependencies,
	getDependents,
	parseDagJson,
	type DagNode,
	type DagEdge,
	type DagDefinition,
	type DagValidationResult
} from './dag';

// Workflow engine
export {
	createWorkflowWithSteps,
	updateWorkflowDag,
	startWorkflowRun,
	executeWorkflowRun,
	type CreateWorkflowInput,
	type StepDefinition,
	type WorkflowRunResult,
	type StepExecutor
} from './engine';

// Templates
export { seedBuiltinTemplates, BUILTIN_TEMPLATES, type TemplateDefinition } from './templates';

// Routing (Sprint 14)
export {
	routeToAgent,
	type RoutingRequest,
	type RoutingCandidate,
	type RoutingResult
} from './routing';

// Delegation (Sprint 14)
export {
	delegateTask,
	getWorkflowDelegations,
	cancelDelegation,
	type DelegateInput,
	type DelegationResult,
	type DelegationExecutor
} from './delegation';

// Step Executors (Sprint 14)
export {
	NoOpExecutor,
	A2ACallExecutor,
	DelegationStepExecutor,
	CompositeExecutor
} from './executors';

// Conflict Resolution (Sprint 15)
export {
	raiseConflict,
	getRunConflicts,
	getPendingConflicts,
	manuallyResolveConflict,
	type ConflictStrategy,
	type ConflictType,
	type ConflictCandidate,
	type RaiseConflictInput,
	type ConflictOutcome
} from './conflicts';

// Streaming (Sprint 15)
export {
	emitEvent,
	getRunEventHistory,
	createEventStream,
	type WorkflowEventType,
	type EmitEventInput
} from './streaming';
