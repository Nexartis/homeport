/**
 * @swagger
 * /a2a:
 *   post:
 *     summary: A2A JSON-RPC 2.0 protocol handler
 *     description: |
 *       Dispatches Agent-to-Agent protocol messages. Methods follow `{domain}.{action}` convention.
 *       Supported actions: cert.start, cert.status, policy.eval, policy.rules.get, audit.intent,
 *       audit.settle, audit.reconcile, audit.wallet, reputation.get, agent.register, agent.lookup,
 *       delegation.grant, delegation.revoke, delegation.check.
 *     tags:
 *       - Protocol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jsonrpc
 *               - method
 *               - id
 *             properties:
 *               jsonrpc:
 *                 type: string
 *                 enum: ["2.0"]
 *               method:
 *                 type: string
 *               params:
 *                 type: object
 *               id:
 *                 type: string
 *     responses:
 *       200:
 *         description: JSON-RPC response
 */
import type { RequestHandler } from './$types';
import { handleA2A } from '$lib/services/a2a';
import { createDbClient } from '$lib/db/client';
import {
	grantDelegation,
	revokeDelegation,
	checkDelegation,
	reconstructPuhProof,
	DelegationGrantError
} from '$lib/server/delegation-grants';
import { extractClientIp } from '$lib/server/audit-helpers';

// Actions handled server-side in this route rather than in `$lib/services/a2a`.
// The a2a service dispatcher is a frozen module (service-layer boundary); the
// delegation grant-chain semantics (chain-narrowing + cascading revocation)
// are enforced at the route seam so the service module stays untouched.
const DELEGATION_ACTIONS = new Set(['delegation.grant', 'delegation.revoke', 'delegation.check']);

interface A2AEnvelope {
	jsonrpc?: string;
	method?: string;
	params?: {
		message?: {
			role?: string;
			parts?: Array<{ text?: string }>;
		};
	};
	id?: string | number;
}

function rpcResult(result: unknown, id: string | number | undefined): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			result: { role: 'agent', parts: [{ text: JSON.stringify(result) }] },
			id: id ?? null
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

function rpcError(message: string, code: number, id: string | number | undefined): Response {
	return new Response(
		JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: id ?? null }),
		{ status: 400, headers: { 'Content-Type': 'application/json' } }
	);
}

export const POST: RequestHandler = async (event) => {
	const { request, platform, locals } = event;
	const env = platform!.env as import('$lib/types').Env;

	// Peek at the envelope. If it's a delegation.* action, handle here.
	// Otherwise, replay the request to the frozen a2a service module.
	const raw = await request.text();
	let envelope: A2AEnvelope | null = null;
	try {
		envelope = JSON.parse(raw) as A2AEnvelope;
	} catch {
		envelope = null;
	}

	const text = envelope?.params?.message?.parts?.[0]?.text;
	let payload: Record<string, unknown> | null = null;
	if (typeof text === 'string') {
		try {
			payload = JSON.parse(text) as Record<string, unknown>;
		} catch {
			payload = null;
		}
	}
	const action = typeof payload?.action === 'string' ? (payload.action as string) : null;

	if (
		envelope &&
		envelope.jsonrpc === '2.0' &&
		envelope.method &&
		payload &&
		action &&
		DELEGATION_ACTIONS.has(action)
	) {
		// SECURITY: delegation.* actions mint / revoke authority; require an
		// authenticated caller. `locals.user` is populated by hooks.server.ts
		// when a valid Sentinel session or `nanda_`/`kym_` API key is present.
		// Without authentication this route was a fully anonymous
		// privilege-escalation surface (see review CRITICAL-1).
		if (!locals.user?.id) {
			return rpcError('Authentication required for delegation.*', -32001, envelope.id);
		}
		const db = createDbClient(env.DB);
		const id = envelope.id;
		const actor = {
			userId: locals.user.id,
			email: locals.user.email ?? null,
			ip: extractClientIp(request),
			userAgent: request.headers.get('User-Agent')
		};

		try {
			switch (action) {
				case 'delegation.grant': {
					// SECURITY: the authenticated caller must be the delegator, or hold
					// an operator/admin scope. `verifyPuhProof` binds the proof to the
					// delegator's device, but we do not want to rely on a proof for
					// authorization; the API-key/session identity is the ground truth.
					const claimedDelegator =
						(payload.granted_by_did as string) ??
						(payload.grantedByDid as string) ??
						(payload.delegator_id as string) ??
						'';
					const scopes = Array.isArray(locals.apiKey?.scopes)
						? (locals.apiKey?.scopes as string[])
						: [];
					const isOperator = scopes.includes('operator') || scopes.includes('admin');
					if (!isOperator && claimedDelegator && claimedDelegator !== locals.user.id) {
						return rpcError(
							'delegation.grant: authenticated user must match delegator',
							-32001,
							id
						);
					}
					const scope = payload.granted_scope ?? payload.grantedScope;
					let grantedScope = Array.isArray(scope)
						? (scope as unknown[]).filter((s): s is string => typeof s === 'string')
						: [];
					// PUH-4 payload nests scope as { toolNames: string[] }. Flatten
					// here so the server sees the same string[] it stores in the
					// `granted_scope` column while the proof envelope (built from
					// the same toolNames) still verifies against `grantedByProofHash`.
					if (
						grantedScope.length === 0 &&
						scope &&
						typeof scope === 'object' &&
						Array.isArray((scope as { toolNames?: unknown }).toolNames)
					) {
						grantedScope = (scope as { toolNames: unknown[] }).toolNames.filter(
							(s): s is string => typeof s === 'string'
						);
					}
					const expiresAt =
						typeof payload.expires_at === 'number'
							? payload.expires_at
							: typeof payload.expiresAt === 'number'
								? payload.expiresAt
								: NaN;
					const proof =
						reconstructPuhProof(payload.proof) ??
						(undefined as unknown as import('$lib/server/delegation-grants').PuhProof);
					const result = await grantDelegation(db, env, {
						delegatorId:
							(payload.granted_by_did as string) ??
							(payload.grantedByDid as string) ??
							(payload.delegator_id as string) ??
							'',
						delegateId:
							(payload.granted_to_did as string) ??
							(payload.grantedToDid as string) ??
							(payload.delegate_id as string) ??
							'',
						action: (payload.action_id as string) ?? (payload.actionId as string) ?? 'delegated',
						grantedScope,
						expiresAt,
						grantedByProofHash:
							(payload.granted_by_proof_hash as string) ??
							(payload.grantedByProofHash as string) ??
							'',
						proof,
						parentDelegationId:
							(payload.parent_delegation_id as string | undefined) ??
							(payload.parentDelegationId as string | undefined) ??
							null,
						revocable: payload.revocable === false ? false : true,
						actor
					});
					return rpcResult(
						{
							delegationId: result.delegationId,
							kymVcId: result.kymVcId,
							expiresAt: result.expiresAt
						},
						id
					);
				}
				case 'delegation.revoke': {
					const delegationId =
						(payload.delegation_id as string) ?? (payload.delegationId as string) ?? '';
					if (!delegationId) {
						return rpcError('delegation_id required', -32602, id);
					}
					// SECURITY: only the delegator (or an operator/admin) may revoke.
					const scopes = Array.isArray(locals.apiKey?.scopes)
						? (locals.apiKey?.scopes as string[])
						: [];
					const isOperator = scopes.includes('operator') || scopes.includes('admin');
					if (!isOperator) {
						const owned = await checkDelegation(db, delegationId);
						const ownedDelegator = owned.credentialSubject?.grantedByDid;
						if (!ownedDelegator || ownedDelegator !== locals.user.id) {
							return rpcError(
								'delegation.revoke: authenticated user must match delegator',
								-32001,
								id
							);
						}
					}
					const reason = typeof payload.reason === 'string' ? payload.reason : undefined;
					const result = await revokeDelegation(db, env, { delegationId, reason, actor });
					return rpcResult(result, id);
				}
				case 'delegation.check': {
					const delegationId =
						(payload.delegation_id as string) ?? (payload.delegationId as string) ?? '';
					if (!delegationId) {
						return rpcError('delegation_id required', -32602, id);
					}
					const result = await checkDelegation(db, delegationId);
					// SECURITY: only the delegator or the delegate (or an operator) can read.
					const scopes = Array.isArray(locals.apiKey?.scopes)
						? (locals.apiKey?.scopes as string[])
						: [];
					const isOperator = scopes.includes('operator') || scopes.includes('admin');
					const delegator = result.credentialSubject?.grantedByDid;
					const delegate = result.credentialSubject?.grantedToDid;
					if (!isOperator && delegator !== locals.user.id && delegate !== locals.user.id) {
						return rpcError(
							'delegation.check: authenticated user must be delegator or delegate',
							-32001,
							id
						);
					}
					return rpcResult(result, id);
				}
			}
		} catch (err) {
			if (err instanceof DelegationGrantError) {
				return rpcError(`${err.code}: ${err.message}`, err.statusHint, id);
			}
			const msg = err instanceof Error ? err.message : 'delegation error';
			return rpcError(msg, -32000, id);
		}
	}

	// Non-delegation path: rebuild the original request and hand off unchanged.
	const forwarded = new Request(request.url, {
		method: 'POST',
		headers: request.headers,
		body: raw
	});
	return handleA2A(forwarded, env);
};
