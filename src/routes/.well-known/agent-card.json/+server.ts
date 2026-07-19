/**
 * A2A Well-Known Agent Card Discovery Endpoint
 * GET /.well-known/agent-card.json
 *
 * Per A2A Protocol v1.0 Section 8.2, this is the standard discovery mechanism
 * for agent capabilities. Returns the Homeport agent card
 * describing the registry, certifier, compliance, observer, and auditor services.
 *
 * @see https://a2a-protocol.org/latest/specification#agent-discovery-the-agent-card
 *
 * @swagger
 * /.well-known/agent-card.json:
 *   get:
 *     summary: Agent card discovery
 *     description: A2A protocol agent card with capabilities, skills, and supported protocols.
 *     tags:
 *       - Discovery
 *     responses:
 *       200:
 *         description: NANDA agent card (A2A v1.0)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const env = platform!.env;
	const baseUrl = env.NANDA_REGISTRY_URL;
	// Tenant-configurable provider identity. Falls back to the node's own
	// registry URL / VITE_BASE_URL so a tenant deployment surfaces itself
	// (not "nexartis.com") in the A2A agent card unless overridden.
	const providerUrl = env.AGENT_CARD_PROVIDER_URL || env.VITE_BASE_URL || baseUrl;
	const providerOrg = env.AGENT_CARD_PROVIDER_ORG || env.SITE_NAME || 'NANDA Node Operator';

	const agentCard = {
		name: 'Homeport',
		description:
			'Know-Your-Machine (KYM) infrastructure node implementing NANDA protocol services: agent registry, capability certification (W3C VCs), compliance enforcement, observer/reputation, and payment auditing.',
		version: '1.0.0',
		protocolVersions: ['1.0'],
		supportedInterfaces: [
			{
				url: `${baseUrl}/a2a`,
				protocolBinding: 'HTTP+JSON',
				protocolVersion: '1.0'
			}
		],
		defaultInputModes: ['application/json'],
		defaultOutputModes: ['application/json'],
		capabilities: {
			streaming: false,
			pushNotifications: false,
			stateTransitionHistory: false,
			extendedAgentCard: false
		},
		skills: [
			{
				id: 'registry',
				name: 'Agent Registry',
				description:
					'Register, discover, and search NANDA-compliant agents. Supports AgentFacts v1 metadata and federated peer sync.',
				tags: ['registry', 'discovery', 'search', 'agentfacts', 'federation'],
				inputModes: ['application/json'],
				outputModes: ['application/json']
			},
			{
				id: 'certifier',
				name: 'Capability Certifier',
				description:
					'Issue and verify W3C Verifiable Credentials attesting to agent capabilities using Wilson confidence interval scoring and Ed25519 signatures.',
				tags: ['certification', 'verifiable-credentials', 'ed25519', 'wilson-ci'],
				inputModes: ['application/json'],
				outputModes: ['application/json']
			},
			{
				id: 'compliance',
				name: 'Compliance Enforcer',
				description:
					'Evaluate agents against governance policies and issue compliance attestations with StatusList2021 revocation support.',
				tags: ['compliance', 'policy', 'attestation', 'revocation'],
				inputModes: ['application/json'],
				outputModes: ['application/json']
			},
			{
				id: 'observer',
				name: 'Observer & Reputation',
				description:
					'Telemetry ingestion, liveness probes, health monitoring, and composite reputation scoring for registered agents.',
				tags: ['observer', 'telemetry', 'probes', 'reputation', 'health'],
				inputModes: ['application/json'],
				outputModes: ['application/json']
			},
			{
				id: 'auditor',
				name: 'Payment Auditor',
				description:
					'x402-NP payment intent reconciliation, HMAC-verified transaction matching, and 4-verdict settlement auditing.',
				tags: ['audit', 'payments', 'x402', 'reconciliation'],
				inputModes: ['application/json'],
				outputModes: ['application/json']
			}
		],
		provider: {
			organization: providerOrg,
			url: providerUrl
		},
		mcp: {
			endpoint: `${baseUrl}/mcp`,
			transport: 'streamable-http',
			authentication: 'bearer'
		},
		documentationUrl: `${baseUrl}/docs`,
		iconUrl: `${baseUrl}/favicon.png`
	};

	return json(agentCard, {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600',
			'X-A2A-Protocol-Version': '1.0'
		}
	});
};
