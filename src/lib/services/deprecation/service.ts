/**
 * Deprecation Service — Agent lifecycle deprecation flow.
 *
 * Status lifecycle: alive → deprecated → tombstoned
 *
 * - alive → deprecated: Sets deprecated_at, sunset_at = now + grace_period_days
 * - deprecated → tombstoned: Sets status = 'tombstoned' after sunset date passes
 * - Deprecated agents still respond to probes (consumers can use during grace period)
 * - Tombstoned agents are excluded from probe scheduling and search results
 */

import type { DbClient } from '$lib/db/client';
import {
	getAgentDeprecationInfo,
	markAgentDeprecated,
	tombstoneAgentRecord,
	getDeprecatedAndTombstonedAgents,
	getSunsetExpiredAgents
} from '$lib/db/repositories/deprecation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeprecationRequest {
	agentId: string;
	reason: string;
	gracePeriodDays: number; // Default: 30 days
	sunsetDate?: number; // Unix timestamp — auto-calculated from grace period if omitted
	notifyConsumers?: boolean; // Default: true — dispatch webhook events
}

export interface DeprecationResult {
	success: boolean;
	agentId: string;
	deprecatedAt: number;
	sunsetAt: number;
	notified: number; // Number of webhook notifications dispatched
	error?: string;
}

export interface DeprecatedAgentInfo {
	agentId: string;
	agentUrl: string | null;
	status: string | null;
	version: string | null;
	deprecatedAt: number | null;
	sunsetAt: number | null;
	updatedAt: number | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that deprecation is allowed based on current status.
 * Agent must be 'alive' or already 'deprecated' (to extend).
 */
export function validateDeprecation(currentStatus: string): { valid: boolean; reason?: string } {
	if (currentStatus === 'tombstoned') {
		return { valid: false, reason: 'Cannot deprecate a tombstoned agent' };
	}
	if (currentStatus === 'alive' || currentStatus === 'deprecated') {
		return { valid: true };
	}
	return { valid: false, reason: `Unexpected agent status: ${currentStatus}` };
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Initiate deprecation — sets status to 'deprecated', schedules sunset.
 * Dispatches 'deprecated' webhook event inline.
 */
export async function deprecateAgent(
	db: DbClient,
	request: DeprecationRequest
): Promise<DeprecationResult> {
	const { agentId, reason, gracePeriodDays, sunsetDate, notifyConsumers = true } = request;

	// Verify agent exists and check current status
	const info = await getAgentDeprecationInfo(db, agentId);
	if (!info) {
		return {
			success: false,
			agentId,
			deprecatedAt: 0,
			sunsetAt: 0,
			notified: 0,
			error: 'Agent not found'
		};
	}

	const validation = validateDeprecation(info.status ?? 'alive');
	if (!validation.valid) {
		return {
			success: false,
			agentId,
			deprecatedAt: 0,
			sunsetAt: 0,
			notified: 0,
			error: validation.reason
		};
	}

	const now = Math.floor(Date.now() / 1000);
	const deprecatedAt = now;
	const sunsetAt = sunsetDate ?? now + gracePeriodDays * 86400;

	await markAgentDeprecated(db, agentId, deprecatedAt, sunsetAt);

	let notified = 0;
	if (notifyConsumers) {
		try {
			const { dispatchEvent } = await import('$lib/services/webhooks/service');
			const result = await dispatchEvent(db, 'deprecated', {
				agent_id: agentId,
				deprecated_at: deprecatedAt,
				sunset_at: sunsetAt,
				reason
			});
			notified = result.dispatched;
		} catch {
			// Webhook dispatch not available — silently skip
		}
	}

	return { success: true, agentId, deprecatedAt, sunsetAt, notified };
}

/**
 * Tombstone — permanently mark agent as dead after sunset date passes.
 */
export async function tombstoneAgent(
	db: DbClient,
	agentId: string
): Promise<{ success: boolean; error?: string }> {
	const info = await getAgentDeprecationInfo(db, agentId);
	if (!info) {
		return { success: false, error: 'Agent not found' };
	}

	if (info.status === 'tombstoned') {
		return { success: true }; // Already tombstoned — idempotent
	}

	if (info.status !== 'deprecated') {
		return { success: false, error: 'Agent must be deprecated before tombstoning' };
	}

	// Enforce sunset grace period — sunsetAt must have passed
	if (info.sunsetAt) {
		const now = Math.floor(Date.now() / 1000);
		if (now < info.sunsetAt) {
			return {
				success: false,
				error: `Sunset date has not passed yet (${new Date(info.sunsetAt * 1000).toISOString()}). Wait until after the sunset date to tombstone this agent.`
			};
		}
	}

	await tombstoneAgentRecord(db, agentId);

	try {
		const { dispatchEvent } = await import('$lib/services/webhooks/service');
		await dispatchEvent(db, 'tombstoned', {
			agent_id: agentId
		});
	} catch {
		// Webhook dispatch not available — silently skip
	}

	return { success: true };
}

/**
 * List all deprecated/tombstoned agents with their sunset timelines.
 */
export async function listDeprecatedAgents(db: DbClient): Promise<DeprecatedAgentInfo[]> {
	return await getDeprecatedAndTombstonedAgents(db);
}

/**
 * Sweep sunset agents — find deprecated agents past their sunset date and tombstone them.
 * Called by cron or manually.
 */
export async function sweepSunsetAgents(db: DbClient): Promise<{ tombstoned: string[] }> {
	const expired = await getSunsetExpiredAgents(db);
	const tombstoned: string[] = [];

	for (const agent of expired) {
		const result = await tombstoneAgent(db, agent.agentId);
		if (result.success) {
			tombstoned.push(agent.agentId);
		}
	}

	return { tombstoned };
}
