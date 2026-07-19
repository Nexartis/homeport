/**
 * Observer Queue Handler — processes probe job messages.
 *
 * Each message triggers an active health probe followed by reputation
 * computation. The handler is idempotent: if a probe run already exists
 * for the same agent within the batch window, the message is acknowledged
 * without re-probing.
 */
import type { Env, ProbeJobMessage } from '$lib/types';
import { createDbClient } from '$lib/db/client';
import { getRecentProbeRun } from '$lib/db/repositories';
import { runProbe, computeReputation } from '$lib/services/observer/service';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'observer-queue');

/** Idempotency window in seconds — skip re-probe if a run exists within this period. */
const IDEMPOTENCY_WINDOW_SEC = 300;

/**
 * Process a batch of probe job messages.
 *
 * For each message in the batch:
 * 1. Validates the `agent_id` and `agent_url` fields.
 * 2. Checks for an existing probe run within the idempotency window.
 * 3. If no recent run exists, executes {@link runProbe} and {@link computeReputation}.
 * 4. Acknowledges the message on success, retries on error.
 *
 * @param batch - Cloudflare Queue message batch.
 * @param env - Worker environment bindings.
 * @returns Resolves when all messages in the batch have been processed.
 */
export async function processProbeBatch(
	batch: MessageBatch<ProbeJobMessage>,
	env: Env
): Promise<void> {
	for (const msg of batch.messages) {
		try {
			const { agent_id, agent_url } = msg.body;

			// Validate payload
			if (!agent_id || typeof agent_id !== 'string') {
				log.error('processProbeBatch', 'Invalid agent_id, acking to discard', { agent_id });
				msg.ack();
				continue;
			}
			if (!agent_url || typeof agent_url !== 'string') {
				log.error('processProbeBatch', 'Invalid agent_url, acking to discard', { agent_url });
				msg.ack();
				continue;
			}

			// Idempotency check — skip if a probe run exists within the window
			const db = createDbClient(env.DB);
			const cutoff = Math.floor(Date.now() / 1000) - IDEMPOTENCY_WINDOW_SEC;
			const existing = await getRecentProbeRun(db, agent_id, cutoff);

			if (existing) {
				log.info('processProbeBatch', `Skipping duplicate probe for ${agent_id}`, {
					run_id: existing.id
				});
				msg.ack();
				continue;
			}

			// Execute probe + reputation computation
			await runProbe(db, agent_id, agent_url, undefined, env);
			await computeReputation(db, agent_id, env);

			msg.ack();
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			log.error('processProbeBatch', `Error processing message (attempt=${msg.attempts})`, {
				error: errMsg
			});
			// P3-5: Retry guardrail — if at max attempts, ack to let DLQ handle it
			if (msg.attempts >= 5) {
				log.error(
					'processProbeBatch',
					`Max retries reached for agent=${msg.body.agent_id} — acking to DLQ`
				);
				msg.ack();
			} else {
				msg.retry();
			}
		}
	}
}
