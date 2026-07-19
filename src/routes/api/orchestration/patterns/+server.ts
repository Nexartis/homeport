/**
 * GET  /api/orchestration/patterns — List orchestrator patterns
 * POST /api/orchestration/patterns — Create a custom pattern
 *
 * Phase 6 — Sprint 13: Multi-Agent Orchestration
 *
 * @swagger
 * /api/orchestration/patterns:
 *   get:
 *     summary: List orchestrator patterns
 *     description: Returns available workflow patterns (fan-out, pipeline, consensus, etc).
 *     tags:
 *       - Orchestration
 *     responses:
 *       200:
 *         description: Array of patterns
 *   post:
 *     summary: Create pattern
 *     description: Create a custom orchestrator pattern.
 *     tags:
 *       - Orchestration
 *     responses:
 *       201:
 *         description: Pattern created
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import {
	listAllPatterns,
	listPatternsByCategory,
	listBuiltinPatterns,
	createPattern
} from '$lib/db/repositories';
import { seedBuiltinTemplates } from '$lib/services/orchestration';
import { validateDag, type DagDefinition } from '$lib/services/orchestration';
import { nanoid } from 'nanoid';
import { parseJsonBody, requireDb } from '$lib/utils/request-helpers';
import { createLogger } from '$lib/utils/logger';
import { getActor, requireAuthenticated, requireAdminRole } from '$lib/server/auth-lanes';

const log = createLogger(undefined, 'api-orchestration-patterns');

export const GET: RequestHandler = async ({ url, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	const actor = getActor(locals);
	requireAuthenticated(actor, { log, fn: 'GET' });

	const category = url.searchParams.get('category');
	const builtinOnly = url.searchParams.get('builtin') === 'true';

	try {
		const db = createDbClient(platform!.env.DB);

		// Seed builtins on first access (idempotent)
		await seedBuiltinTemplates(db);

		let patterns;
		if (builtinOnly) {
			patterns = await listBuiltinPatterns(db);
		} else if (category) {
			patterns = await listPatternsByCategory(db, category);
		} else {
			patterns = await listAllPatterns(db);
		}

		return json({
			patterns: patterns.map((p) => ({
				...p,
				dagTemplate: JSON.parse(p.dagTemplateJson),
				inputSchema: p.inputSchemaJson ? JSON.parse(p.inputSchemaJson) : null,
				tags: JSON.parse(p.tags ?? '[]')
			}))
		});
	} catch (err) {
		log.error('GET', 'Failed to list patterns', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const dbErr = requireDb(platform?.env as Record<string, unknown> | undefined);
	if (dbErr) return dbErr;

	// Patterns are a globally-shared catalog; only admins may extend it.
	const actor = getActor(locals);
	requireAdminRole(actor, { log, fn: 'POST' });

	const [body, parseErr] = await parseJsonBody<{
		name?: string;
		description?: string;
		category?: string;
		dag_template?: { nodes: unknown[]; edges: unknown[] };
		input_schema?: Record<string, unknown>;
		tags?: string[];
	}>(request);
	if (parseErr) return parseErr;

	if (!body.name || typeof body.name !== 'string') {
		return json({ error: 'name is required and must be a string' }, { status: 400 });
	}
	if (!body.dag_template || !Array.isArray(body.dag_template.nodes)) {
		return json({ error: 'dag_template is required with nodes and edges arrays' }, { status: 400 });
	}

	// Validate the template DAG
	const validation = validateDag(body.dag_template as DagDefinition);
	if (!validation.valid) {
		return json(
			{ error: `Invalid DAG template: ${validation.errors.join('; ')}` },
			{ status: 400 }
		);
	}

	try {
		const db = createDbClient(platform!.env.DB);

		const pattern = await createPattern(db, {
			id: nanoid(),
			name: body.name,
			description: body.description ?? null,
			category: body.category ?? 'general',
			dagTemplateJson: JSON.stringify(body.dag_template),
			inputSchemaJson: body.input_schema ? JSON.stringify(body.input_schema) : null,
			tags: JSON.stringify(body.tags ?? []),
			isBuiltin: 0
		});

		return json({ status: 'created', pattern }, { status: 201 });
	} catch (err) {
		log.error('POST', 'Failed to create pattern', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
