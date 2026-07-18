/**
 * Conflict Resolution Service — Phase 6 Sprint 15
 *
 * Automated handling of competing agent responses within workflows.
 * Strategies:
 *  - highest_score: Pick the candidate with the best composite score
 *  - first_wins: Pick the first response received (lowest timestamp)
 *  - voting: Tally votes from candidates and pick the majority
 *  - manual: Leave unresolved for human review
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { ConflictResolutionRecord } from '$lib/db/schema';
import {
	createConflictResolution,
	getConflictResolutionById,
	listConflictsByRun,
	listUnresolvedConflicts,
	resolveConflict
} from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'conflicts');

export type ConflictStrategy = 'highest_score' | 'first_wins' | 'voting' | 'manual';
export type ConflictType = 'competing_response' | 'timeout_race' | 'capability_overlap';

export interface ConflictCandidate {
	agentId: string;
	response: unknown;
	score: number;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface RaiseConflictInput {
	workflowId: string;
	runId?: string;
	stepId?: string;
	conflictType: ConflictType;
	strategy: ConflictStrategy;
	candidates: ConflictCandidate[];
	metadata?: Record<string, unknown>;
}

export interface ConflictOutcome {
	conflictId: string;
	resolved: boolean;
	winnerAgentId?: string;
	winnerResponse?: unknown;
	resolutionScore?: number;
	strategy: ConflictStrategy;
}

/**
 * Raise a conflict and optionally auto-resolve it based on the strategy.
 */
export async function raiseConflict(
	db: DbClient,
	input: RaiseConflictInput
): Promise<ConflictOutcome> {
	const conflictId = nanoid();

	// Persist the conflict record
	await createConflictResolution(db, {
		id: conflictId,
		workflowId: input.workflowId,
		runId: input.runId ?? null,
		stepId: input.stepId ?? null,
		conflictType: input.conflictType,
		strategy: input.strategy,
		candidatesJson: JSON.stringify(input.candidates),
		metadataJson: JSON.stringify(input.metadata ?? {})
	});

	log.info(
		'raiseConflict',
		`Conflict ${conflictId} raised (${input.conflictType}, strategy=${input.strategy})`,
		{
			candidateCount: input.candidates.length
		}
	);

	// Auto-resolve if strategy is not manual
	if (input.strategy === 'manual') {
		return { conflictId, resolved: false, strategy: input.strategy };
	}

	return autoResolve(db, conflictId, input.strategy, input.candidates);
}

/**
 * Auto-resolve a conflict using the specified strategy.
 */
async function autoResolve(
	db: DbClient,
	conflictId: string,
	strategy: ConflictStrategy,
	candidates: ConflictCandidate[]
): Promise<ConflictOutcome> {
	if (candidates.length === 0) {
		log.warn('autoResolve', `Conflict ${conflictId} has no candidates`);
		return { conflictId, resolved: false, strategy };
	}

	let winner: ConflictCandidate;

	switch (strategy) {
		case 'highest_score':
			winner = [...candidates].sort((a, b) => b.score - a.score)[0];
			break;

		case 'first_wins':
			winner = [...candidates].sort((a, b) => a.timestamp - b.timestamp)[0];
			break;

		case 'voting': {
			// Tally: each candidate's score acts as a vote weight
			const tally = new Map<string, number>();
			for (const c of candidates) {
				tally.set(c.agentId, (tally.get(c.agentId) ?? 0) + c.score);
			}
			let maxAgent = candidates[0].agentId;
			let maxVotes = 0;
			for (const [agentId, votes] of tally) {
				if (votes > maxVotes) {
					maxVotes = votes;
					maxAgent = agentId;
				}
			}
			winner = candidates.find((c) => c.agentId === maxAgent) ?? candidates[0];
			break;
		}

		default:
			return { conflictId, resolved: false, strategy };
	}

	// Persist resolution
	await resolveConflict(db, conflictId, {
		winnerAgentId: winner.agentId,
		winnerResponse: JSON.stringify(winner.response),
		resolutionScore: winner.score
	});

	log.info(
		'autoResolve',
		`Conflict ${conflictId} resolved: winner=${winner.agentId} (score=${winner.score})`
	);

	return {
		conflictId,
		resolved: true,
		winnerAgentId: winner.agentId,
		winnerResponse: winner.response,
		resolutionScore: winner.score,
		strategy
	};
}

/**
 * Get all conflicts for a workflow run.
 */
export async function getRunConflicts(
	db: DbClient,
	runId: string
): Promise<ConflictResolutionRecord[]> {
	return listConflictsByRun(db, runId);
}

/**
 * Get unresolved conflicts for a workflow.
 */
export async function getPendingConflicts(
	db: DbClient,
	workflowId: string
): Promise<ConflictResolutionRecord[]> {
	return listUnresolvedConflicts(db, workflowId);
}

/**
 * Manually resolve a conflict (for strategy='manual' or override).
 */
export async function manuallyResolveConflict(
	db: DbClient,
	conflictId: string,
	winnerAgentId: string,
	winnerResponse: unknown,
	score?: number
): Promise<ConflictResolutionRecord | null> {
	const conflict = await getConflictResolutionById(db, conflictId);
	if (!conflict) return null;
	if (conflict.resolved === 1) return conflict;

	const resolved = await resolveConflict(db, conflictId, {
		winnerAgentId,
		winnerResponse: JSON.stringify(winnerResponse),
		resolutionScore: score
	});

	log.info(
		'manuallyResolveConflict',
		`Conflict ${conflictId} manually resolved: winner=${winnerAgentId}`
	);
	return resolved;
}
