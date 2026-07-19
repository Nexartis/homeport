/**
 * Workflow Event Streaming Service — Phase 6 Sprint 15
 *
 * Provides SSE (Server-Sent Events) streaming for real-time workflow run monitoring.
 * Events are persisted to D1 for durability and then streamed via ReadableStream.
 *
 * Architecture:
 *  1. Workflow engine emits events via emitEvent() during execution
 *  2. Events stored in workflow_events table
 *  3. SSE endpoint polls for unconsumed events and streams them to client
 *  4. Events are marked consumed after delivery
 */

import { nanoid } from 'nanoid';
import type { DbClient } from '$lib/db/client';
import type { WorkflowEventRecord } from '$lib/db/schema';
import {
	createWorkflowEvent,
	listUnconsumedEvents,
	listEventsByRun,
	markEventsConsumed
} from '$lib/db/repositories';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'streaming');

export type WorkflowEventType =
	| 'step_started'
	| 'step_completed'
	| 'step_failed'
	| 'run_started'
	| 'run_completed'
	| 'run_failed'
	| 'run_cancelled'
	| 'delegation_started'
	| 'delegation_completed'
	| 'routing_decision'
	| 'conflict_raised'
	| 'conflict_resolved'
	| 'system';

export interface EmitEventInput {
	workflowId: string;
	runId?: string;
	stepId?: string;
	eventType: WorkflowEventType;
	payload: Record<string, unknown>;
}

/**
 * Emit a workflow event — persists to D1.
 */
export async function emitEvent(db: DbClient, input: EmitEventInput): Promise<WorkflowEventRecord> {
	const event = await createWorkflowEvent(db, {
		id: nanoid(),
		workflowId: input.workflowId,
		runId: input.runId ?? null,
		stepId: input.stepId ?? null,
		eventType: input.eventType,
		payloadJson: JSON.stringify(input.payload)
	});

	log.info('emitEvent', `Event ${input.eventType} emitted for workflow ${input.workflowId}`, {
		runId: input.runId,
		stepId: input.stepId
	});

	return event;
}

/**
 * Get event history for a run (already delivered events).
 */
export async function getRunEventHistory(
	db: DbClient,
	runId: string,
	limit = 100
): Promise<WorkflowEventRecord[]> {
	return listEventsByRun(db, runId, limit);
}

/**
 * Create an SSE ReadableStream for a workflow run.
 * Polls D1 for unconsumed events at the specified interval.
 * Closes when the run reaches a terminal state or maxDurationMs expires.
 */
export function createEventStream(
	db: DbClient,
	runId: string,
	options: { pollIntervalMs?: number; maxDurationMs?: number } = {}
): ReadableStream {
	const pollInterval = options.pollIntervalMs ?? 1000;
	const maxDuration = options.maxDurationMs ?? 300_000; // 5 min default
	const startTime = Date.now();

	let intervalId: ReturnType<typeof setInterval> | null = null;

	return new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Send initial keepalive
			controller.enqueue(encoder.encode(`: keepalive\n\n`));

			intervalId = setInterval(async () => {
				try {
					// Check timeout
					if (Date.now() - startTime > maxDuration) {
						controller.enqueue(
							encoder.encode(formatSSE('timeout', { message: 'Stream max duration reached' }))
						);
						controller.close();
						if (intervalId) clearInterval(intervalId);
						return;
					}

					// Poll for unconsumed events
					const events = await listUnconsumedEvents(db, runId);

					if (events.length > 0) {
						// Send each event as SSE
						for (const event of events) {
							const payload = {
								id: event.id,
								type: event.eventType,
								stepId: event.stepId,
								timestamp: event.emittedAt,
								data: JSON.parse(event.payloadJson)
							};
							controller.enqueue(encoder.encode(formatSSE(event.eventType, payload)));
						}

						// Mark as consumed
						await markEventsConsumed(
							db,
							events.map((e) => e.id)
						);

						// Check if ANY event in the batch is terminal — not just the last one.
						// A batch may contain [step_completed, run_completed, …]; only checking
						// the last element would miss the terminal event and keep polling.
						const terminalEvents = new Set(['run_completed', 'run_failed', 'run_cancelled']);
						if (events.some((e) => terminalEvents.has(e.eventType))) {
							controller.close();
							if (intervalId) clearInterval(intervalId);
						}
					}
				} catch (err) {
					log.error('createEventStream', 'SSE poll error', {
						error: err instanceof Error ? err.message : String(err)
					});
					// Don't close stream on transient errors
				}
			}, pollInterval);
		},

		cancel() {
			if (intervalId) clearInterval(intervalId);
		}
	});
}

/**
 * Format data as an SSE message.
 */
function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
