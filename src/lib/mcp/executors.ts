/**
 * MCP Tool Executors for NANDA Infrastructure Services
 *
 * Each executor backs an MCP tool, calling existing
 * NANDA services and repositories. Read and write tools.
 */

import type { DbClient } from '$lib/db/client';
import type { Env } from '$lib/types';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'mcp-executors');
import {
	lookupAgent,
	searchAgents,
	listAgents,
	registerAgent,
	getAgentFacts
} from '$lib/services/registry';
import { getLatestReputations } from '$lib/db/repositories/observer';
import { getLatestCertGrades } from '$lib/db/repositories/certifier';
import { isRevoked } from '$lib/services/certifier/revocation';
import { agentAddrs } from '$lib/db/schema';
import { resolveAndSign, importSigningKey } from '$lib/crypto/sign-agent';
import { sql } from 'drizzle-orm';
import { getFederationStatus, getFederationV2Status } from '$lib/services/federation';
import { LeanIndexService } from '$lib/services/lean-index';
import { getTrustScoreForAgent, listTrustScores } from '$lib/services/trust/trust-score-api';
import { createWorkflowWithSteps, startWorkflowRun } from '$lib/services/orchestration';
import type { DagDefinition } from '$lib/services/orchestration';

// ===================================================================
// nanda_lookup_agent
// ===================================================================

export async function execLookupAgent(db: DbClient, params: { agent_id: string }) {
	const result = await lookupAgent(db, params.agent_id);
	if (!result) return { error: 'Agent not found', agent_id: params.agent_id };
	return result;
}

// ===================================================================
// nanda_search_agents
// ===================================================================

export async function execSearchAgents(
	db: DbClient,
	params: { query?: string; capabilities?: string[]; tags?: string[] }
) {
	const results = await searchAgents(db, params.query, params.capabilities, params.tags);
	return { results, total: results.length };
}

// ===================================================================
// nanda_list_agents
// ===================================================================

export async function execListAgents(db: DbClient) {
	const result = await listAgents(db);
	return { agents: result, total: result.length };
}

// ===================================================================
// nanda_get_reputation
// ===================================================================

export async function execGetReputation(db: DbClient, params: { agent_id?: string }) {
	const [reputations, certGrades] = await Promise.all([
		getLatestReputations(db),
		getLatestCertGrades(db)
	]);

	const certMap = new Map(certGrades.map((c) => [c.agentId, c]));

	function safeParseActions(actions: string | null): string[] {
		if (!actions) return [];
		try {
			const parsed = JSON.parse(actions);
			return Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === 'string') : [];
		} catch {
			return [];
		}
	}

	// Merge reputation + cert data per agent
	const allAgents = reputations.map((r) => {
		const cert = certMap.get(r.agent_id);
		return {
			agent_id: r.agent_id,
			reputation: r.reputation,
			availability: r.availability,
			error_rate: r.error_rate,
			fraud_rate: r.fraud_rate,
			p95_latency_ms: r.p95_latency_ms,
			probe_success: r.probe_success,
			cert_score: cert?.score ?? r.cert_score ?? null,
			actions: safeParseActions(r.actions),
			snapshot_at: r.created_at,
			cert_grade: cert?.grade ?? null,
			cert_capability: cert?.capability ?? null,
			cert_issued_at: cert?.issuedAt ?? null
		};
	});

	// Include agents that have certs but no reputation snapshot
	for (const [agentId, cert] of certMap) {
		if (!reputations.find((r) => r.agent_id === agentId)) {
			allAgents.push({
				agent_id: agentId,
				reputation: null,
				availability: null,
				error_rate: null,
				fraud_rate: null,
				p95_latency_ms: null,
				probe_success: null,
				cert_score: cert.score,
				actions: [],
				snapshot_at: null,
				cert_grade: cert.grade,
				cert_capability: cert.capability,
				cert_issued_at: cert.issuedAt
			});
		}
	}

	// Filter to a single agent if agent_id provided
	if (params.agent_id) {
		const match = allAgents.find((a) => a.agent_id === params.agent_id);
		if (!match) return { error: 'No reputation data found', agent_id: params.agent_id };
		return match;
	}

	return { agents: allAgents, total: allAgents.length };
}

// ===================================================================
// nanda_check_cert
// ===================================================================

export async function execCheckCert(db: DbClient, params: { cert_id: string }) {
	return await isRevoked(db, params.cert_id);
}

// ===================================================================
// nanda_check_health
// ===================================================================

export async function execCheckHealth(env: Env, db: DbClient) {
	// DB check
	let dbStatus: 'ok' | 'error' = 'error';
	let agentCount = 0;
	try {
		const [row] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(agentAddrs);
		agentCount = row?.cnt ?? 0;
		dbStatus = 'ok';
	} catch (err) {
		log.error('checkHealth', 'DB check failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		dbStatus = 'error';
	}

	const r2: 'ok' | 'error' = env.KYM_NANDA_EVIDENCE ? 'ok' : 'error';
	const kv: 'ok' | 'error' = env.NANDA_NODE_CACHE ? 'ok' : 'error';
	const allChecks = [dbStatus, r2, kv];
	const overallStatus = allChecks.every((c) => c === 'ok') ? 'ok' : 'degraded';

	return {
		status: overallStatus,
		timestamp: new Date().toISOString(),
		agents: agentCount,
		checks: { db: dbStatus, r2, kv }
	};
}

// ===================================================================
// nanda_register_agent
// ===================================================================

export async function execRegisterAgent(
	db: DbClient,
	env: Env,
	params: {
		agent_id: string;
		agent_url: string;
		api_url?: string;
		facts_url?: string;
		capabilities?: string[];
		tags?: string[];
	}
) {
	const sig = await resolveAndSign(params.agent_id, env as Parameters<typeof resolveAndSign>[1]);
	await registerAgent(db, {
		agent_id: params.agent_id,
		agent_url: params.agent_url,
		api_url: params.api_url,
		facts_url: params.facts_url,
		capabilities: params.capabilities,
		tags: params.tags,
		...sig
	});
	return { ok: true, agent_id: params.agent_id, message: 'Agent registered successfully' };
}

// ===================================================================
// nanda_get_agentfacts
// ===================================================================

export async function execGetAgentFacts(db: DbClient, params: { agent_id: string }) {
	const facts = await getAgentFacts(db, params.agent_id);
	if (!facts) return { error: 'AgentFacts not found', agent_id: params.agent_id };
	return facts;
}

// ===================================================================
// nanda_resolve_agent
// ===================================================================

export async function execResolveAgent(db: DbClient, env: Env, params: { agent_id: string }) {
	const service = new LeanIndexService(
		db,
		env.NANDA_NODE_CACHE
		// read-only resolve — no signing key needed
	);
	const resolution = await service.resolve(params.agent_id);
	if (!resolution) return { error: 'Agent not indexed', agent_id: params.agent_id };
	return resolution;
}

// ===================================================================
// nanda_federation_status
// ===================================================================

export async function execFederationStatus(db: DbClient, env: Env) {
	const sigKey = await importSigningKey(env as Parameters<typeof importSigningKey>[0]);
	const [v1Status, v2Status] = await Promise.all([
		getFederationStatus(db),
		getFederationV2Status(db, env as unknown as Record<string, unknown>, sigKey)
	]);
	return { v1: v1Status, v2: v2Status };
}

// ===================================================================
// nanda_create_workflow
// ===================================================================

export async function execCreateWorkflow(
	db: DbClient,
	params: {
		name: string;
		description?: string;
		steps: Array<{
			step_id: string;
			agent_id?: string;
			action?: string;
			depends_on?: string[];
		}>;
	}
) {
	// Build DAG from steps
	const dag: DagDefinition = {
		nodes: params.steps.map((s) => ({
			id: s.step_id,
			type: s.action ?? 'task'
		})),
		edges: params.steps
			.filter((s) => s.depends_on?.length)
			.flatMap((s) =>
				(s.depends_on ?? []).map((dep) => ({
					source: dep,
					target: s.step_id
				}))
			)
	};

	const workflow = await createWorkflowWithSteps(db, {
		name: params.name,
		description: params.description,
		ownerId: 'mcp-client',
		dag,
		metadata: { created_via: 'mcp' }
	});

	return { ok: true, workflow_id: workflow.id, name: workflow.name, status: workflow.status };
}

// ===================================================================
// nanda_run_workflow
// ===================================================================

export async function execRunWorkflow(
	db: DbClient,
	params: { workflow_id: string; input?: Record<string, unknown> }
) {
	const runId = await startWorkflowRun(db, params.workflow_id, params.input ?? {}, 'mcp');
	return { ok: true, run_id: runId, workflow_id: params.workflow_id, status: 'pending' };
}

// ===================================================================
// nanda_trust_scores
// ===================================================================

export async function execTrustScores(db: DbClient, params: { agent_id?: string }) {
	if (params.agent_id) {
		const score = await getTrustScoreForAgent(db, params.agent_id);
		if (!score) return { error: 'No trust data found', agent_id: params.agent_id };
		return score;
	}
	return await listTrustScores(db);
}

// ===================================================================
// nanda_compliance_check
// ===================================================================

export async function execComplianceCheck(db: DbClient, params: { agent_id: string }) {
	// Retrieve latest compliance decisions for this agent (from_agent or to_agent match)
	const { complianceDecisions } = await import('$lib/db/schema');
	const { eq, desc, or } = await import('drizzle-orm');
	const decisions = await db
		.select()
		.from(complianceDecisions)
		.where(
			or(
				eq(complianceDecisions.fromAgent, params.agent_id),
				eq(complianceDecisions.toAgent, params.agent_id)
			)
		)
		.orderBy(desc(complianceDecisions.createdAt))
		.limit(5);

	if (!decisions.length) {
		return {
			agent_id: params.agent_id,
			status: 'no_data',
			message: 'No compliance evaluations found'
		};
	}

	const latest = decisions[0];
	return {
		agent_id: params.agent_id,
		status: latest.decision,
		capability: latest.capability,
		created_at: latest.createdAt,
		history: decisions.map((d) => ({
			decision: d.decision,
			capability: d.capability,
			from_agent: d.fromAgent,
			to_agent: d.toAgent,
			created_at: d.createdAt
		}))
	};
}

// ===================================================================
// nanda_subscribe_webhook
// ===================================================================

export async function execSubscribeWebhook(
	db: DbClient,
	params: { url: string; events: string[]; secret?: string }
) {
	const { webhookSubscriptions } = await import('$lib/db/schema');
	const { nanoid } = await import('nanoid');
	const id = nanoid();
	const signingSecret = params.secret ?? nanoid(32);

	await db.insert(webhookSubscriptions).values({
		id,
		callbackUrl: params.url,
		events: JSON.stringify(params.events),
		secret: signingSecret,
		status: 'active'
	});

	return { ok: true, subscription_id: id, url: params.url, events: params.events };
}

// ── Switchboard executors ──

export async function execDiscoverAgent(db: DbClient, env: Env, params: { url: string }) {
	const { SwitchboardService } = await import('$lib/services/switchboard');
	const service = new SwitchboardService(db);
	const result = await service.autoRegister(params.url, env.ENVIRONMENT);
	if (!result) return { error: 'No supported protocols detected', url: params.url };
	return result;
}

export async function execListAdapters(db: DbClient, params: { agent_id: string }) {
	const { SwitchboardService } = await import('$lib/services/switchboard');
	const service = new SwitchboardService(db);
	const adapters = await service.listAdapters(params.agent_id);
	return { agent_id: params.agent_id, adapters };
}

export async function execExportAgent(
	db: DbClient,
	params: { agent_id: string; target_protocol: string }
) {
	const { SwitchboardService } = await import('$lib/services/switchboard');
	const { getAgentById } = await import('$lib/db/repositories/registry');
	const agent = await getAgentById(db, params.agent_id);
	if (!agent) return { error: 'Agent not found', agent_id: params.agent_id };

	const staticEndpoints: Array<{ url: string; protocol: string }> = [];
	if (agent.agentUrl) staticEndpoints.push({ url: agent.agentUrl, protocol: 'nanda' });
	const facts = {
		agent_name: agent.agentId,
		version: agent.version ?? '1.0.0',
		capabilities: { modalities: agent.capabilities ? JSON.parse(agent.capabilities) : [] },
		endpoints: { static: staticEndpoints }
	};

	const service = new SwitchboardService(db);
	const exported = service.exportAs(facts, params.target_protocol as 'a2a' | 'mcp' | 'nlweb');
	return { agent_id: params.agent_id, target_protocol: params.target_protocol, exported };
}

// ── Payment executors ──

export async function execGetExchangeRates(env: Env, params: { from?: string; to?: string }) {
	const { getExchangeRate } = await import('$lib/services/payment/exchange-rates');
	const { getActiveCurrencies } = await import('$lib/services/payment/currencies');

	if (params.from && params.to) {
		const result = await getExchangeRate(params.from, params.to, env);
		return { from: params.from, to: params.to, rate: result.rate };
	}

	// Return all pairs
	const currencies = getActiveCurrencies();
	const codes = currencies.map((c) => c.symbol);
	const rates: Record<string, Record<string, number>> = {};
	for (const f of codes) {
		rates[f] = {};
		for (const t of codes) {
			if (f === t) {
				rates[f][t] = 1;
				continue;
			}
			try {
				const result = await getExchangeRate(f, t, env);
				rates[f][t] = result.rate;
			} catch {
				rates[f][t] = 0;
			}
		}
	}
	return { rates, currencies: codes };
}

export async function execGetWalletBalance(db: DbClient, params: { agent_id: string }) {
	const { getMultiCurrencyBalances } = await import('$lib/services/payment/multi-wallet');
	const balances = await getMultiCurrencyBalances(db, params.agent_id);
	return { agent_id: params.agent_id, balances };
}

export async function execConvertCurrency(
	env: Env,
	params: { from: string; to: string; amount: number }
) {
	const { getExchangeRate } = await import('$lib/services/payment/exchange-rates');
	const result = await getExchangeRate(params.from, params.to, env);
	return {
		from: params.from,
		to: params.to,
		amount: params.amount,
		converted: params.amount * result.rate,
		rate: result.rate
	};
}
