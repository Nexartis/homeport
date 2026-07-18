/**
 * UCP Capability Schemas — Phase 5, D1
 *
 * Defines the service capabilities exposed via the UCP manifest.
 * Each capability maps to a KYM/NANDA service that agents can discover and purchase.
 *
 * @see AGENT_ALPHA_SPRINT_PLAN.md Task 2
 */

import type { UcpCapability } from '$lib/types/ucp';

// ---------------------------------------------------------------------------
// Capability Definitions
// ---------------------------------------------------------------------------

const CAPABILITIES: UcpCapability[] = [
	{
		id: 'agent-discovery',
		name: 'Agent Discovery',
		description: 'Search and list registered agents in the NANDA registry',
		price: { amount: 0, currency: 'NP' },
		type: 'query'
	},
	{
		id: 'agent-certification',
		name: 'Agent Certification',
		description: 'Run certification trials on an agent to issue W3C Verifiable Credentials',
		price: { amount: 100, currency: 'NP' },
		type: 'action'
	},
	{
		id: 'compliance-check',
		name: 'Compliance Check',
		description: 'Evaluate an agent against governance compliance policies',
		price: { amount: 50, currency: 'NP' },
		type: 'action'
	},
	{
		id: 'health-probe',
		name: 'Health Probe',
		description: 'Run health and availability probes against a registered agent',
		price: { amount: 10, currency: 'NP' },
		type: 'action'
	}
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full list of UCP capabilities offered by this node.
 */
export function getCapabilities(): UcpCapability[] {
	return CAPABILITIES;
}

/**
 * Look up a capability by its ID.
 * @returns The capability definition or undefined if not found.
 */
export function getCapabilityById(id: string): UcpCapability | undefined {
	return CAPABILITIES.find((c) => c.id === id);
}

/**
 * Get the set of valid capability IDs for validation.
 */
export function getCapabilityIds(): Set<string> {
	return new Set(CAPABILITIES.map((c) => c.id));
}
