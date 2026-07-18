/**
 * Compliance A2A Action Router — dispatches incoming `policy.*` actions
 * to the appropriate compliance service functions.
 *
 * This module is the single entry-point that the A2A handler (ECHO agent)
 * imports to service compliance-related JSON-RPC requests.
 *
 * Supported actions:
 *   - `policy.eval`       — Evaluate a message envelope against the active policy.
 *   - `policy.rules.get`  — Return the active policy ruleset (read-only).
 *   - `policy.violation`  — Report a compliance violation.
 */

import type { Env } from '../../types';
import { createDbClient } from '$lib/db/client';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import type { PolicyEnvelope } from './service';
import { evaluatePolicy, logDecision, reportViolation, loadPolicy, hmacSign } from './service';

/**
 * Route an incoming compliance action to the correct handler.
 *
 * @param env     - Worker environment bindings.
 * @param action  - The `policy.*` action string from the A2A envelope.
 * @param payload - The parsed JSON payload from the A2A message.
 * @returns A JSON-serialisable result object.
 * @throws {Error} If `action` is not a recognised compliance action.
 */
export async function handleComplianceAction(
	env: Env,
	action: string,
	payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const db = createDbClient(env.DB);
	const kv = env.NANDA_NODE_CACHE;
	switch (action) {
		// ----- policy.eval -----
		case 'policy.eval': {
			const envelope = extractEnvelope(payload);
			const policyId = typeof payload.policy_id === 'string' ? payload.policy_id : undefined;
			const context =
				payload.context && typeof payload.context === 'object'
					? (payload.context as Record<string, unknown>)
					: undefined;

			const result = await evaluatePolicy(db, kv, envelope, policyId, context);
			const { decision_id } = await logDecision(db, envelope, result);

			return {
				decision_id,
				decision: result.decision,
				reasons: result.reasons,
				actions: result.actions,
				...(result.transformed_envelope
					? { transformed_envelope: result.transformed_envelope }
					: {})
			};
		}

		// ----- policy.rules.get -----
		case 'policy.rules.get': {
			const policyId = typeof payload.policy_id === 'string' ? payload.policy_id : undefined;
			const rules = await loadPolicy(db, kv, policyId);
			const hmacSecret = await resolveSecret(
				env.KYM_NANDA_HMAC_SECRET,
				kvFallback(env, SECRET_KEYS.HMAC_SECRET)
			);
			if (!hmacSecret) throw new Error('KYM_NANDA_HMAC_SECRET not available');
			const signature = await hmacSign(rules, hmacSecret);
			return { rules, signature };
		}

		// ----- policy.violation -----
		case 'policy.violation': {
			const agentId = payload.agent_id;
			if (typeof agentId !== 'string' || !agentId) {
				throw new Error('[handleComplianceAction] policy.violation requires a non-empty agent_id');
			}

			const reason = payload.reason;
			if (typeof reason !== 'string' || !reason) {
				throw new Error('[handleComplianceAction] policy.violation requires a non-empty reason');
			}

			const envelopeHash =
				typeof payload.envelope_hash === 'string' ? payload.envelope_hash : undefined;
			const { violation_id } = await reportViolation(db, agentId, reason, envelopeHash);

			return { violation_id };
		}

		default:
			throw new Error(`[handleComplianceAction] Unknown compliance action: ${action}`);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract and validate a {@link PolicyEnvelope} from the raw A2A payload.
 *
 * @param payload - Raw parsed JSON from the A2A message.
 * @returns A validated {@link PolicyEnvelope}.
 * @throws {Error} If required fields are missing or of the wrong type.
 */
function extractEnvelope(payload: Record<string, unknown>): PolicyEnvelope {
	const envelope = (payload.envelope ?? payload) as Record<string, unknown>;

	const from_agent = envelope.from_agent;
	if (typeof from_agent !== 'string' || !from_agent) {
		throw new Error('[handleComplianceAction] policy.eval requires envelope.from_agent (string)');
	}

	const to_agent = envelope.to_agent;
	if (typeof to_agent !== 'string' || !to_agent) {
		throw new Error('[handleComplianceAction] policy.eval requires envelope.to_agent (string)');
	}

	const capability = envelope.capability;
	if (typeof capability !== 'string' || !capability) {
		throw new Error('[handleComplianceAction] policy.eval requires envelope.capability (string)');
	}

	// Extract data_classes per Python reference: data_classes = [str(x) for x in (envelope.get("data_classes") or [])]
	const rawDataClasses = Array.isArray(envelope.data_classes) ? envelope.data_classes : undefined;
	const data_classes = rawDataClasses?.map((x: unknown) => String(x));

	return {
		from_agent,
		to_agent,
		capability,
		from_region: typeof envelope.from_region === 'string' ? envelope.from_region : undefined,
		to_region: typeof envelope.to_region === 'string' ? envelope.to_region : undefined,
		parts: Array.isArray(envelope.parts) ? (envelope.parts as Array<{ text?: string }>) : undefined,
		eu_personal_data: envelope.eu_personal_data === true,
		data_classes
	};
}
