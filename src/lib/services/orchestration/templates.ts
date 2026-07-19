/**
 * Workflow Templates — Pre-built orchestration patterns.
 * Phase 6 — Sprint 13
 *
 * Provides builtin templates for common multi-agent workflows:
 *  1. Review Chain — sequential agent review pipeline
 *  2. Approval Flow — parallel review with consensus gate
 *  3. Certification Pipeline — cert + compliance + observer
 *  4. Health Monitor — periodic probe with alert escalation
 *  5. Federation Sync — multi-peer gossip orchestration
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import { createPattern, listBuiltinPatterns } from '$lib/db/repositories';
import type { DagDefinition } from './dag';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'workflow-templates');

export interface TemplateDefinition {
	name: string;
	description: string;
	category: string;
	dag: DagDefinition;
	inputSchema?: Record<string, unknown>;
	tags: string[];
}

// ===================================================================
// Builtin Templates
// ===================================================================

const REVIEW_CHAIN: TemplateDefinition = {
	name: 'Review Chain',
	description:
		'Sequential agent review pipeline — each agent reviews the output of the previous one.',
	category: 'review',
	dag: {
		nodes: [
			{ id: 'input', type: 'input', data: { stepType: 'transform', action: 'passthrough' } },
			{ id: 'reviewer_1', type: 'agent', data: { stepType: 'agent_call', action: 'review' } },
			{ id: 'reviewer_2', type: 'agent', data: { stepType: 'agent_call', action: 'review' } },
			{ id: 'output', type: 'output', data: { stepType: 'transform', action: 'aggregate' } }
		],
		edges: [
			{ source: 'input', target: 'reviewer_1' },
			{ source: 'reviewer_1', target: 'reviewer_2' },
			{ source: 'reviewer_2', target: 'output' }
		]
	},
	inputSchema: {
		type: 'object',
		properties: { content: { type: 'string' } },
		required: ['content']
	},
	tags: ['review', 'sequential', 'pipeline']
};

const APPROVAL_FLOW: TemplateDefinition = {
	name: 'Approval Flow',
	description:
		'Parallel review with consensus gate — multiple agents review independently, then a gate aggregates.',
	category: 'approval',
	dag: {
		nodes: [
			{ id: 'input', type: 'input', data: { stepType: 'transform', action: 'broadcast' } },
			{ id: 'approver_1', type: 'agent', data: { stepType: 'agent_call', action: 'approve' } },
			{ id: 'approver_2', type: 'agent', data: { stepType: 'agent_call', action: 'approve' } },
			{ id: 'gate', type: 'gate', data: { stepType: 'condition', action: 'consensus' } },
			{ id: 'output', type: 'output', data: { stepType: 'transform', action: 'finalize' } }
		],
		edges: [
			{ source: 'input', target: 'approver_1' },
			{ source: 'input', target: 'approver_2' },
			{ source: 'approver_1', target: 'gate' },
			{ source: 'approver_2', target: 'gate' },
			{ source: 'gate', target: 'output' }
		]
	},
	inputSchema: {
		type: 'object',
		properties: { proposal: { type: 'string' } },
		required: ['proposal']
	},
	tags: ['approval', 'parallel', 'consensus']
};

const CERT_PIPELINE: TemplateDefinition = {
	name: 'Certification Pipeline',
	description:
		'Full agent certification — compliance check → certification trials → observer probe.',
	category: 'pipeline',
	dag: {
		nodes: [
			{ id: 'compliance', type: 'agent', data: { stepType: 'agent_call', action: 'policy.eval' } },
			{ id: 'certify', type: 'agent', data: { stepType: 'agent_call', action: 'cert.start' } },
			{ id: 'probe', type: 'agent', data: { stepType: 'agent_call', action: 'probe.run' } },
			{ id: 'report', type: 'output', data: { stepType: 'transform', action: 'aggregate' } }
		],
		edges: [
			{ source: 'compliance', target: 'certify' },
			{ source: 'certify', target: 'probe' },
			{ source: 'probe', target: 'report' }
		]
	},
	tags: ['certification', 'compliance', 'pipeline']
};

const HEALTH_MONITOR: TemplateDefinition = {
	name: 'Health Monitor',
	description: 'Probe agent health and escalate alerts if degraded.',
	category: 'monitoring',
	dag: {
		nodes: [
			{ id: 'probe', type: 'agent', data: { stepType: 'agent_call', action: 'probe.run' } },
			{ id: 'evaluate', type: 'gate', data: { stepType: 'condition', action: 'threshold_check' } },
			{ id: 'alert', type: 'agent', data: { stepType: 'agent_call', action: 'alert.dispatch' } }
		],
		edges: [
			{ source: 'probe', target: 'evaluate' },
			{ source: 'evaluate', target: 'alert' }
		]
	},
	tags: ['monitoring', 'health', 'alerts']
};

export const BUILTIN_TEMPLATES: TemplateDefinition[] = [
	REVIEW_CHAIN,
	APPROVAL_FLOW,
	CERT_PIPELINE,
	HEALTH_MONITOR
];

/**
 * Seed builtin templates into the database (idempotent).
 */
export async function seedBuiltinTemplates(db: DbClient): Promise<number> {
	const existing = await listBuiltinPatterns(db);
	const existingNames = new Set(existing.map((p) => p.name));
	let seeded = 0;

	for (const tmpl of BUILTIN_TEMPLATES) {
		if (existingNames.has(tmpl.name)) continue;

		await createPattern(db, {
			id: nanoid(),
			name: tmpl.name,
			description: tmpl.description,
			category: tmpl.category,
			dagTemplateJson: JSON.stringify(tmpl.dag),
			inputSchemaJson: tmpl.inputSchema ? JSON.stringify(tmpl.inputSchema) : null,
			tags: JSON.stringify(tmpl.tags),
			isBuiltin: 1
		});
		seeded++;
	}

	if (seeded > 0) log.info('seedBuiltinTemplates', `Seeded ${seeded} builtin templates`);
	return seeded;
}
