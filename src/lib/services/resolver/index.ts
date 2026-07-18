/**
 * Resolver Service — Context-aware adaptive resolution engine
 * Phase 6 — Agent California
 *
 * Orchestrates endpoint resolution by:
 * 1. Looking up agent data (AgentAddr + AgentFacts)
 * 2. Selecting resolution strategy (static / rotating / adaptive)
 * 3. Pulling health + trust data from Observer / Trust services
 * 4. Scoring and ranking endpoints
 * 5. Logging resolution for analytics
 *
 * @see arXiv:2508.03113 — NANDA Adaptive Resolver
 */

import { eq, desc } from 'drizzle-orm';
import type { DbClient } from '$lib/db/client';
import { agentAddrs, probeRuns, reputationSnapshots } from '$lib/db/schema';
import { insertResolutionLog } from '$lib/db/repositories/resolution-log';
import type {
	ResolutionContext,
	ResolutionResult,
	ResolutionStrategy,
	ResolvedEndpoint,
	HealthProbeData,
	AgentFactsV2Placeholder
} from '$lib/types/resolver';
import { ScoringEngine } from './scoring';
import { StaticStrategy, RotatingStrategy, AdaptiveStrategy } from './strategies';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'resolver');

/** Default TTL for resolution results (seconds) */
const DEFAULT_TTL = 300;

export class ResolverService {
	private db: DbClient;
	private scoring: ScoringEngine;
	private staticStrategy: StaticStrategy;
	private rotatingStrategy: RotatingStrategy;
	private adaptiveStrategy: AdaptiveStrategy;

	constructor(db: DbClient, scoring?: ScoringEngine) {
		this.db = db;
		this.scoring = scoring ?? new ScoringEngine();
		this.staticStrategy = new StaticStrategy();
		this.rotatingStrategy = new RotatingStrategy();
		this.adaptiveStrategy = new AdaptiveStrategy(this.scoring);
	}

	/** Resolve with context — selects strategy based on input */
	async resolve(agentId: string, context?: ResolutionContext): Promise<ResolutionResult | null> {
		const start = Date.now();

		// 1. Look up agent data
		const agentRow = await this.db.query.agentAddrs.findFirst({
			where: eq(agentAddrs.agentId, agentId)
		});

		if (!agentRow) {
			log.warn('resolve', `Agent not found: ${agentId}`);
			return null;
		}

		// 2. Build placeholder AgentFacts from existing agent data
		const facts = this.buildFactsFromAgent(agentRow);

		// 3. Select strategy
		const strategy = this.selectStrategy(agentRow, context);

		// 4. Gather health + trust data
		const healthData = await this.getHealthData(agentId);
		const trustScores = await this.getTrustScores(agentId);

		// 5. Resolve using selected strategy
		let endpoints: ResolvedEndpoint[];
		switch (strategy) {
			case 'adaptive':
				endpoints = this.adaptiveStrategy.resolve(facts, context!, healthData, trustScores);
				break;
			case 'rotating':
				endpoints = this.rotatingStrategy.resolve(facts, healthData);
				break;
			default:
				endpoints = this.staticStrategy.resolve(facts);
		}

		const result: ResolutionResult = {
			agent_id: agentId,
			strategy,
			endpoints,
			resolved_at: Math.floor(Date.now() / 1000),
			ttl_seconds: DEFAULT_TTL
		};

		// 6. Log resolution (non-blocking)
		const latencyMs = Date.now() - start;
		this.logResolution(result, context, latencyMs).catch((err) => {
			log.error('logResolution', 'Failed to log resolution', {
				error: err instanceof Error ? err.message : String(err)
			});
		});

		return result;
	}

	/** Determine strategy: no context → static, context → adaptive */
	private selectStrategy(
		agent: { factsUrl?: string | null },
		context?: ResolutionContext
	): ResolutionStrategy {
		if (context && Object.keys(context).length > 0) return 'adaptive';
		if (agent.factsUrl) return 'rotating';
		return 'static';
	}

	/** Build AgentFacts placeholder from existing agent row */
	private buildFactsFromAgent(agent: {
		agentId: string;
		agentUrl: string | null;
		apiUrl?: string | null;
		capabilities?: string | null;
	}): AgentFactsV2Placeholder {
		const capabilities = agent.capabilities ? JSON.parse(agent.capabilities) : [];
		const endpoints: Array<{ url: string; protocol: string }> = [];

		if (agent.agentUrl) {
			endpoints.push({ url: agent.agentUrl, protocol: 'https' });
		}
		if (agent.apiUrl) {
			endpoints.push({ url: agent.apiUrl, protocol: 'a2a' });
		}

		return {
			agent_name: agent.agentId,
			endpoints: { static: endpoints },
			skills: capabilities.map((c: string) => ({ id: c })),
			capabilities: { modalities: capabilities }
		};
	}

	/** Get health probe data for agent endpoints */
	private async getHealthData(agentId: string): Promise<Map<string, HealthProbeData>> {
		const data = new Map<string, HealthProbeData>();
		try {
			const probes = await this.db
				.select()
				.from(probeRuns)
				.where(eq(probeRuns.agentId, agentId))
				.orderBy(desc(probeRuns.createdAt))
				.limit(5);

			for (const probe of probes) {
				const endpoint = probe.endpoint ?? agentId;
				if (!data.has(endpoint)) {
					const successRate =
						probe.probesSent && probe.probesSent > 0
							? (probe.successCount ?? 0) / probe.probesSent
							: 0;
					data.set(endpoint, {
						success_rate: successRate,
						p95_latency_ms: probe.p95LatencyMs ?? 0
					});
				}
			}
		} catch (err) {
			log.error('getHealthData', `Failed to get health data for ${agentId}`, {
				error: err instanceof Error ? err.message : String(err)
			});
		}
		return data;
	}

	/** Get trust scores for agent */
	private async getTrustScores(agentId: string): Promise<Map<string, number>> {
		const scores = new Map<string, number>();
		try {
			const rep = await this.db.query.reputationSnapshots.findFirst({
				where: eq(reputationSnapshots.agentId, agentId),
				orderBy: desc(reputationSnapshots.createdAt)
			});

			if (rep?.reputation != null) {
				scores.set(agentId, rep.reputation);
			}
		} catch (err) {
			log.error('getTrustScores', `Failed to get trust scores for ${agentId}`, {
				error: err instanceof Error ? err.message : String(err)
			});
		}
		return scores;
	}

	/** Log resolution for analytics */
	private async logResolution(
		result: ResolutionResult,
		context?: ResolutionContext,
		latencyMs?: number
	): Promise<void> {
		try {
			await insertResolutionLog(this.db, {
				id: crypto.randomUUID(),
				agentId: result.agent_id,
				requesterId: context?.requester_id ?? null,
				strategy: result.strategy,
				contextJson: context ? JSON.stringify(context) : null,
				resultJson: JSON.stringify(result),
				latencyMs: latencyMs ?? null,
				cacheHit: 0
			});
		} catch (err) {
			log.error('logResolution', 'Failed to insert resolution log', {
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}
}
