<script lang="ts">
	import { SvelteFlow, MiniMap, Controls, Background } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import AgentNode from './nodes/AgentNode.svelte';
	import ServiceNode from './nodes/ServiceNode.svelte';
	import FederationPeerNode from './nodes/FederationPeerNode.svelte';
	import type { Node, Edge } from '@xyflow/svelte';
	import type { NetworkAgent } from '$lib/types/admin';

	const { agents = [] }: { agents: NetworkAgent[] } = $props();

	const nodeTypes = {
		agent: AgentNode,
		service: ServiceNode,
		peer: FederationPeerNode
	};

	/* Service nodes at fixed center positions */
	const serviceNodeDefs = [
		{ id: 'svc-registry', label: 'Registry', service: 'registry', x: 400, y: 300 },
		{ id: 'svc-certifier', label: 'Certifier', service: 'certifier', x: 200, y: 500 },
		{ id: 'svc-compliance', label: 'Compliance', service: 'compliance', x: 600, y: 500 },
		{ id: 'svc-observer', label: 'Observer', service: 'observer', x: 200, y: 100 },
		{ id: 'svc-auditor', label: 'Auditor', service: 'auditor', x: 600, y: 100 }
	] as const;

	function buildNodes(agentList: NetworkAgent[]): Node[] {
		const serviceNodes: Node[] = serviceNodeDefs.map((s) => ({
			id: s.id,
			type: 'service',
			position: { x: s.x, y: s.y },
			data: { label: s.label, service: s.service }
		}));

		/* Arrange agent nodes in a circle around center (400, 300) */
		const cx = 400;
		const cy = 300;
		const radius = 350;
		const agentNodes: Node[] = agentList.map((agent, i) => {
			const angle = (2 * Math.PI * i) / Math.max(agentList.length, 1);
			return {
				id: `agent-${agent.agent_id}`,
				type: 'agent',
				position: {
					x: cx + radius * Math.cos(angle),
					y: cy + radius * Math.sin(angle)
				},
				data: {
					agent_id: agent.agent_id,
					status: agent.status,
					capabilities: agent.capabilities
				}
			};
		});

		return [...serviceNodes, ...agentNodes];
	}

	function buildEdges(agentList: NetworkAgent[]): Edge[] {
		/* Each agent connects to the registry. We can extend this later
		   to parse capabilities and connect to specific services. */
		return agentList.map((agent) => ({
			id: `e-${agent.agent_id}-registry`,
			source: `agent-${agent.agent_id}`,
			target: 'svc-registry',
			animated: agent.status === 'alive',
			style:
				agent.status === 'alive'
					? 'stroke: rgba(105, 66, 230, 0.5); stroke-width: 1.5px;'
					: 'stroke: rgba(255, 80, 80, 0.3); stroke-width: 1px; stroke-dasharray: 4;'
		}));
	}

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	/* Rebuild when agents data changes */
	$effect(() => {
		nodes = buildNodes(agents);
		edges = buildEdges(agents);
	});
</script>

<div class="network-explorer h-full w-full">
	<SvelteFlow bind:nodes bind:edges {nodeTypes} fitView colorMode="dark">
		<Background gap={20} />
		<MiniMap />
		<Controls />
	</SvelteFlow>
</div>

<style>
	.network-explorer :global(.svelte-flow) {
		--xy-background-color: #0a0a0f;
		--xy-node-border-color: rgba(37, 37, 48, 0.6);
		--xy-edge-stroke-color: rgba(105, 66, 230, 0.4);
		--xy-minimap-background-color: #12121a;
		--xy-minimap-mask-background-color: rgba(10, 10, 15, 0.7);
		--xy-controls-button-background-color: #1a1a2e;
		--xy-controls-button-color: #e2e2f0;
		--xy-controls-button-border-color: rgba(37, 37, 48, 0.8);
	}

	.network-explorer :global(.svelte-flow__minimap) {
		border-radius: 8px;
		border: 1px solid rgba(37, 37, 48, 0.6);
	}

	.network-explorer :global(.svelte-flow__controls) {
		border-radius: 8px;
		border: 1px solid rgba(37, 37, 48, 0.6);
		overflow: hidden;
	}

	.network-explorer :global(.svelte-flow__controls button:hover) {
		background-color: rgba(105, 66, 230, 0.2);
	}
</style>
