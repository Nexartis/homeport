/**
 * A2A Protocol Handler — JSON-RPC over POST /a2a
 * Reference: NANDA_SPRINT_PLAN_v2.md Appendix B
 *
 * Strict mode: return 400 on invalid A2A messages, no silent fallbacks.
 *
 * ─── Architectural Decision Record ───
 *
 * This handler uses a **custom JSON-RPC 2.0 dispatch** pattern rather than the
 * standard A2A v1.0 HTTP+JSON binding (which maps methods like `message/send`,
 * `tasks/get`, `tasks/cancel` to distinct HTTP verbs/paths).
 *
 * Rationale:
 *  1. NANDA Infrastructure Services are *infrastructure* endpoints (certifier,
 *     compliance, observer, auditor) rather than conversational agents. The
 *     action-based dispatch (`{ action: "start", ... }` inside `message/send`)
 *     maps more naturally to RPC-style service calls.
 *  2. The single `/a2a` POST endpoint simplifies Cloudflare Workers routing
 *     and keeps all protocol logic co-located for auditing/logging.
 *  3. The A2A v1.0 spec permits "extended" or "custom" methods via JSON-RPC,
 *     and the `message/send` method is used as the transport with a structured
 *     `text` payload that contains the action + parameters.
 *
 * Trade-offs:
 *  - We do NOT use the `application/a2a+json` media type; we accept/return
 *    plain `application/json`. This is intentional — the custom dispatch
 *    already diverges from the standard binding, and forcing the media type
 *    without the full binding would be misleading.
 *  - Error responses use JSON-RPC error format (`{ error: { code, message } }`)
 *    rather than RFC 9457 Problem Details. This is consistent with JSON-RPC 2.0.
 *  - Agent discovery is provided via `/.well-known/agent-card.json` per spec.
 *
 * If future interop requires standard A2A v1.0 bindings, a translation layer
 * can be added in front of this handler without changing service logic.
 * ─────────────────────────────────
 */
import type { Env } from '$lib/types';
import { createDbClient } from '$lib/db/client';
import { resolveSecret } from '$lib/utils/resolve-secret';
import { kvFallback, SECRET_KEYS } from '$lib/utils/node-secrets';
import { revokeCertificate, isRevoked } from '$lib/services/certifier/revocation';
import { startCertification, getJobStatus, getCertificate } from '$lib/services/certifier/service';
import { handleComplianceAction } from '$lib/services/compliance/routes';
import {
	ingestTelemetry,
	healthForAgent,
	runProbe,
	computeReputation
} from '$lib/services/observer/service';
import { declareIntent, submitTransaction, getAuditStatus } from '$lib/services/auditor/service';
import { getAgentById, getAgentUrl } from '$lib/db/repositories/registry';

interface A2ARequest {
	jsonrpc: string;
	method: string;
	params?: {
		message?: {
			role?: string;
			parts?: Array<{ text?: string }>;
		};
	};
	id?: string | number;
}

function jsonRpcResponse(result: unknown, id?: string | number): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			result: {
				role: 'agent',
				parts: [{ text: JSON.stringify(result) }]
			},
			id: id ?? null
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

function jsonRpcError(message: string, code = -32600, id?: string | number): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			error: { code, message },
			id: id ?? null
		}),
		{ status: 400, headers: { 'Content-Type': 'application/json' } }
	);
}

export async function handleA2A(request: Request, env: Env): Promise<Response> {
	let body: A2ARequest;
	try {
		body = (await request.json()) as A2ARequest;
	} catch {
		return jsonRpcError('Parse error', -32700);
	}

	if (body.jsonrpc !== '2.0' || !body.method) {
		return jsonRpcError('Invalid JSON-RPC request', -32600, body.id);
	}

	const text = body.params?.message?.parts?.[0]?.text;
	if (!text) {
		return jsonRpcError('Missing message text in A2A envelope', -32600, body.id);
	}

	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(text);
	} catch {
		return jsonRpcError('Invalid JSON in message text', -32600, body.id);
	}

	const action = payload.action;
	if (!action || typeof action !== 'string') {
		return jsonRpcError('Missing or invalid action field', -32600, body.id);
	}

	// Create Drizzle DB client from D1 binding
	const db = createDbClient(env.DB);

	// Route by action prefix
	// Certifier actions
	if (action === 'start' || action === 'status' || action === 'certificate') {
		try {
			switch (action) {
				case 'start': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					if (typeof payload.capability !== 'string' || !payload.capability) {
						return jsonRpcError('capability must be a non-empty string', -32602, body.id);
					}
					const numTrials = typeof payload.num_trials === 'number' ? payload.num_trials : undefined;
					const passThreshold =
						typeof payload.pass_threshold === 'number' ? payload.pass_threshold : undefined;
					const result = await startCertification(
						env,
						payload.agent_id,
						payload.capability,
						numTrials,
						passThreshold
					);
					return jsonRpcResponse(result, body.id);
				}
				case 'status': {
					if (typeof payload.job_id !== 'string' || !payload.job_id) {
						return jsonRpcError('job_id must be a non-empty string', -32602, body.id);
					}
					const result = await getJobStatus(db, payload.job_id);
					if (!result) return jsonRpcError('Job not found', -32000, body.id);
					return jsonRpcResponse(result, body.id);
				}
				case 'certificate': {
					if (typeof payload.cert_id !== 'string' || !payload.cert_id) {
						return jsonRpcError('cert_id must be a non-empty string', -32602, body.id);
					}
					const result = await getCertificate(db, payload.cert_id);
					if (!result) return jsonRpcError('Certificate not found', -32000, body.id);
					return jsonRpcResponse(result, body.id);
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Certifier error';
			return jsonRpcError(msg, -32000, body.id);
		}
	}

	// Certificate revocation (Sprint 3)
	if (action === 'certificate.revoke') {
		if (typeof payload.cert_id !== 'string' || !payload.cert_id) {
			return jsonRpcError('cert_id must be a non-empty string', -32602, body.id);
		}
		const certId = payload.cert_id;
		const reason =
			typeof payload.reason === 'string' && payload.reason ? payload.reason : 'Manual revocation';
		const result = await revokeCertificate(db, certId, reason);
		if (!result.ok) {
			return jsonRpcError(result.error ?? 'Revocation failed', -32000, body.id);
		}
		return jsonRpcResponse(
			{ status: 'revoked', cert_id: certId, status_list_index: result.statusListIndex },
			body.id
		);
	}

	// Certificate revocation check (Sprint 3)
	if (action === 'certificate.check') {
		if (typeof payload.cert_id !== 'string' || !payload.cert_id) {
			return jsonRpcError('cert_id must be a non-empty string', -32602, body.id);
		}
		const certId = payload.cert_id;
		const result = await isRevoked(db, certId);
		return jsonRpcResponse(result, body.id);
	}

	// Compliance actions
	if (action.startsWith('policy.')) {
		try {
			const result = await handleComplianceAction(env, action, payload);
			return jsonRpcResponse(result, body.id);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Compliance error';
			return jsonRpcError(msg, -32000, body.id);
		}
	}

	// Observer actions
	if (
		action.startsWith('observer.') ||
		action.startsWith('telemetry.') ||
		action === 'reputation'
	) {
		try {
			switch (action) {
				case 'telemetry.ingest': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const event = {
						agent_id: payload.agent_id,
						latency_ms: typeof payload.latency_ms === 'number' ? payload.latency_ms : 0,
						success: payload.success === true,
						status_code: typeof payload.status_code === 'number' ? payload.status_code : undefined,
						fraud_flag: typeof payload.fraud_flag === 'boolean' ? payload.fraud_flag : undefined,
						note: typeof payload.note === 'string' ? payload.note : undefined
					};
					const result = await ingestTelemetry(db, event);
					return jsonRpcResponse(result, body.id);
				}
				case 'observer.health': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const windowSec = typeof payload.window_sec === 'number' ? payload.window_sec : undefined;
					const result = await healthForAgent(db, payload.agent_id, windowSec);
					return jsonRpcResponse(result, body.id);
				}
				case 'observer.probe.run': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					if (typeof payload.agent_url !== 'string' || !payload.agent_url) {
						return jsonRpcError('agent_url must be a non-empty string', -32602, body.id);
					}
					const capability =
						typeof payload.capability === 'string' ? payload.capability : undefined;
					const result = await runProbe(db, payload.agent_id, payload.agent_url, capability, env);
					return jsonRpcResponse(result, body.id);
				}
				case 'reputation': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const result = await computeReputation(db, payload.agent_id, env);
					return jsonRpcResponse(result, body.id);
				}
				default:
					return jsonRpcError(`Unknown observer action: ${action}`, -32601, body.id);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Observer error';
			return jsonRpcError(msg, -32000, body.id);
		}
	}

	// Auditor actions
	if (action.startsWith('audit.')) {
		try {
			switch (action) {
				case 'audit.intent': {
					const intent = {
						payer: payload.payer as string,
						payee: payload.payee as string,
						amount: payload.amount as number,
						memo: typeof payload.memo === 'string' ? payload.memo : undefined,
						nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
						window_sec: typeof payload.window_sec === 'number' ? payload.window_sec : undefined
					};
					const result = await declareIntent(db, intent, env);
					return jsonRpcResponse(result, body.id);
				}
				case 'audit.tx': {
					const radiusSecret = await resolveSecret(
						env.KYM_NANDA_RADIUS_SECRET,
						kvFallback(env, SECRET_KEYS.RADIUS_SECRET)
					);
					if (!radiusSecret) {
						return jsonRpcError('KYM_NANDA_RADIUS_SECRET not configured', -32001, body.id);
					}
					const result = await submitTransaction(
						db,
						payload.tx_hash as string,
						payload.from as string,
						payload.to as string,
						payload.amount as number,
						typeof payload.ts === 'number' ? payload.ts : Math.floor(Date.now() / 1000),
						typeof payload.sig === 'string' ? payload.sig : null,
						radiusSecret,
						env
					);
					return jsonRpcResponse(result, body.id);
				}
				case 'audit.status': {
					if (typeof payload.intent_id !== 'string' || !payload.intent_id) {
						return jsonRpcError('intent_id must be a non-empty string', -32602, body.id);
					}
					const result = await getAuditStatus(db, payload.intent_id);
					return jsonRpcResponse(result, body.id);
				}
				default:
					return jsonRpcError(`Unknown audit action: ${action}`, -32601, body.id);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Auditor error';
			return jsonRpcError(msg, -32000, body.id);
		}
	}

	// ── Switchboard actions ──
	if (action.startsWith('switchboard.')) {
		const { SwitchboardService } = await import('$lib/services/switchboard');
		const service = new SwitchboardService(db);
		try {
			switch (action) {
				case 'switchboard.discover': {
					if (typeof payload.url !== 'string' || !payload.url) {
						return jsonRpcError('url must be a non-empty string', -32602, body.id);
					}
					const result = await service.autoRegister(payload.url, env.ENVIRONMENT);
					if (!result) {
						return jsonRpcError('No supported protocols detected', -32001, body.id);
					}
					return jsonRpcResponse(result, body.id);
				}
				case 'switchboard.export': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const protocol = payload.protocol as string;
					if (!['a2a', 'mcp', 'nlweb'].includes(protocol)) {
						return jsonRpcError("protocol must be 'a2a', 'mcp', or 'nlweb'", -32602, body.id);
					}
					const agent = await getAgentById(db, payload.agent_id);
					if (!agent) {
						return jsonRpcError(`Agent ${payload.agent_id} not found`, -32001, body.id);
					}
					const staticEndpoints: Array<{ url: string; protocol: string }> = [];
					if (agent.agentUrl) staticEndpoints.push({ url: agent.agentUrl, protocol: 'nanda' });
					const facts = {
						agent_name: agent.agentId,
						version: agent.version ?? '1.0.0',
						capabilities: { modalities: agent.capabilities ? JSON.parse(agent.capabilities) : [] },
						endpoints: { static: staticEndpoints }
					};
					const exported = service.exportAs(facts, protocol as 'a2a' | 'mcp' | 'nlweb');
					return jsonRpcResponse(exported, body.id);
				}
				case 'switchboard.resync': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const agentInfo = await getAgentUrl(db, payload.agent_id);
					if (!agentInfo?.agentUrl) {
						return jsonRpcError(`Agent ${payload.agent_id} not found`, -32001, body.id);
					}
					await service.resync(payload.agent_id, agentInfo.agentUrl, env.ENVIRONMENT);
					const adapters = await service.listAdapters(payload.agent_id);
					return jsonRpcResponse({ agent_id: payload.agent_id, adapters }, body.id);
				}
				case 'switchboard.adapters': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const adapters = await service.listAdapters(payload.agent_id);
					return jsonRpcResponse({ agent_id: payload.agent_id, adapters }, body.id);
				}
				default:
					return jsonRpcError(`Unknown switchboard action: ${action}`, -32601, body.id);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Switchboard error';
			return jsonRpcError(msg, -32000, body.id);
		}
	}

	// ── Payment actions ──
	if (action.startsWith('payment.')) {
		const { getExchangeRate } = await import('$lib/services/payment/exchange-rates');
		const { getMultiCurrencyBalances } = await import('$lib/services/payment/multi-wallet');
		try {
			switch (action) {
				case 'payment.rates': {
					const from = payload.from as string;
					const to = payload.to as string;
					if (typeof from !== 'string' || typeof to !== 'string') {
						return jsonRpcError('from and to must be currency code strings', -32602, body.id);
					}
					const result = await getExchangeRate(from, to, env);
					return jsonRpcResponse({ from, to, rate: result.rate }, body.id);
				}
				case 'payment.balance': {
					if (typeof payload.agent_id !== 'string' || !payload.agent_id) {
						return jsonRpcError('agent_id must be a non-empty string', -32602, body.id);
					}
					const balances = await getMultiCurrencyBalances(db, payload.agent_id);
					return jsonRpcResponse({ agent_id: payload.agent_id, balances }, body.id);
				}
				case 'payment.convert': {
					const { from, to, amount } = payload as { from: string; to: string; amount: number };
					if (typeof from !== 'string' || typeof to !== 'string') {
						return jsonRpcError('from and to must be currency code strings', -32602, body.id);
					}
					if (typeof amount !== 'number' || amount <= 0) {
						return jsonRpcError('amount must be a positive number', -32602, body.id);
					}
					const result = await getExchangeRate(from, to, env);
					return jsonRpcResponse(
						{ from, to, amount, converted: amount * result.rate, rate: result.rate },
						body.id
					);
				}
				default:
					return jsonRpcError(`Unknown payment action: ${action}`, -32601, body.id);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Payment error';
			return jsonRpcError(msg, -32000, body.id);
		}
	}

	return jsonRpcError(`Unknown action: ${action}`, -32601, body.id);
}
