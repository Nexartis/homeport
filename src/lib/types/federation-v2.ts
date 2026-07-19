/**
 * Federation v2 Types — Phase 6 (Agent Hawaii)
 *
 * Gossip-based federation with CRDT convergence for the Registry Quilt.
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase D
 */

export interface GossipMessage {
	node_id: string;
	timestamp: number;
	agent_addr_deltas: AgentAddrDelta[];
	vector_clock: Record<string, number>; // node_id → logical clock
	signature_hex: string;
}

export interface AgentAddrDelta {
	agent_id: string;
	agent_addr: AgentAddr | null; // null = tombstone (deletion)
	updated_at: number;
	source_node: string;
}

/**
 * AgentAddr — the core addressable identity for an agent.
 * Mirrors Bali's AgentAddr type; imported here for federation use.
 * When Bali's canonical AgentAddr lands, this can be re-exported from there.
 */
export interface AgentAddr {
	agent_id: string;
	agent_url: string;
	api_url?: string;
	facts_url?: string;
	capabilities?: string[];
	tags?: string[];
	source?: string;
	status?: string;
}

export interface FederationPeer {
	peer_id: string;
	peer_url: string;
	node_id: string;
	status: 'active' | 'degraded' | 'offline';
	last_sync_at: number;
	last_gossip_at: number;
	vector_clock: Record<string, number>;
	failure_count: number;
	capabilities: string[];
	quilt_types: string[];
	created_at: number;
}

export type QuiltType = 'native' | 'gov' | 'enterprise' | 'web3';

export interface QuiltRoute {
	id?: string;
	prefix: string; // e.g., "@US:", "@DID:", "@company:", "@agntcy:"
	quilt_type: QuiltType;
	peer_id: string; // Route to this peer
	priority: number; // Lower = higher priority
	created_at?: number;
}

export interface VectorClock {
	[nodeId: string]: number;
}

/** LWW-Register merge result */
export interface MergeResult {
	accepted: number;
	rejected: number;
	conflicts: number;
	tombstones: number;
	/** Indices of deltas that were accepted during merge (for publish hooks) */
	acceptedIndices: number[];
}

/**
 * Hook interface for publishing newly-received agents to external directories.
 * AGNTCY Directory integration point — California implements the actual call.
 *
 * @see COMPATIBILITY_AUDIT.md — Gossip Peers Can Publish to AGNTCY
 */
export interface PostGossipPublishHook {
	/**
	 * Called after a successful gossip exchange with newly-accepted deltas.
	 * Implementations may publish agents to AGNTCY Directory via Routing API.
	 *
	 * @param acceptedDeltas - Deltas that were accepted during the merge
	 * @returns Number of agents successfully published (0 if not implemented)
	 */
	onGossipAccepted(acceptedDeltas: AgentAddrDelta[]): Promise<number>;
}
