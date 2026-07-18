<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const layers = [
		{
			label: 'NANDA Index',
			subtitle: 'Semantics Layer — Discovery & Trust',
			color: '#6942e6',
			detail:
				'Decentralized agent discovery, identity verification, and trust infrastructure. The address book and trust registry that helps agents find each other and decide who to work with.',
			role: 'How do agents find and trust each other?',
			items: [
				'Agent identity (AgentFacts)',
				'Federated discovery (Quilt)',
				'Privacy-preserving lookups',
				'Trust attestations'
			]
		},
		{
			label: 'A2A Protocol',
			subtitle: 'Syntax Layer — Agent Communication',
			color: '#0cd3da',
			detail:
				"Google's Agent-to-Agent protocol provides the standardized wire format — JSON-RPC 2.0 with Server-Sent Events — for two agents to communicate, negotiate tasks, and stream results.",
			role: 'How do agents talk to each other?',
			items: [
				'JSON-RPC 2.0 messaging',
				'Task lifecycle management',
				'Server-Sent Events streaming',
				'Agent Cards at /.well-known/agent.json'
			]
		},
		{
			label: 'MCP',
			subtitle: 'Syntax Layer — Tool Integration',
			color: '#22c55e',
			detail:
				"Anthropic's Model Context Protocol standardizes how AI models connect to external tools, data sources, and services. Think of it as a USB-C port for AI — a universal interface between a model and its environment.",
			role: 'How do agents connect to tools?',
			items: [
				'Tool & resource discovery',
				'Structured tool invocation',
				'Context injection',
				'Server manifests'
			]
		}
	];

	let activeIndex = $state(-1);

	function select(i: number) {
		activeIndex = activeIndex === i ? -1 : i;
	}
</script>

<div class="not-prose my-8">
	<div class="rounded-xl border border-nanda-border/60 bg-nanda-bg-surface/80 p-5 sm:p-6">
		<p class="text-xs font-semibold uppercase tracking-wider text-nanda-text-dim mb-5">
			Interactive · The Agentic Protocol Stack
		</p>

		<!-- Stacked layers -->
		<div class="flex flex-col gap-2">
			{#each layers as layer, i}
				<button
					class="text-left rounded-lg border-2 p-3 sm:p-4 transition-all duration-200 cursor-pointer {activeIndex ===
					i
						? 'scale-[1.01]'
						: 'hover:scale-[1.005]'}"
					style="border-color: {activeIndex === i
						? layer.color
						: layer.color + '30'}; background: {activeIndex === i
						? layer.color + '12'
						: layer.color + '05'}"
					onclick={() => select(i)}
					aria-expanded={activeIndex === i}
				>
					<div class="flex items-center justify-between">
						<div>
							<h4 class="text-sm font-bold" style="color: {layer.color}">{layer.label}</h4>
							<p class="text-xs text-nanda-text-muted mt-0.5">{layer.subtitle}</p>
						</div>
						<div
							class="h-6 w-6 rounded-full border flex items-center justify-center text-xs transition-transform duration-200 {activeIndex ===
							i
								? 'rotate-45'
								: ''}"
							style="border-color: {layer.color}60; color: {layer.color}"
						>
							+
						</div>
					</div>
				</button>

				{#if activeIndex === i}
					<div
						class="rounded-lg border p-4 sm:p-5 -mt-1"
						style="border-color: {layer.color}25; background: {layer.color}06"
						transition:fly={{ y: browser ? -8 : 0, duration: browser ? 180 : 0 }}
					>
						<p class="text-sm text-nanda-text-muted leading-relaxed mb-3">{layer.detail}</p>
						<p class="text-xs font-semibold text-nanda-text mb-2">
							<span style="color: {layer.color}">→</span>
							{layer.role}
						</p>
						<div class="grid grid-cols-2 gap-1.5">
							{#each layer.items as item}
								<span class="text-[11px] text-nanda-text-dim flex items-center gap-1.5">
									<span class="h-1 w-1 rounded-full" style="background: {layer.color}"></span>
									{item}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Relationship note -->
		<div class="mt-5 rounded-lg bg-nanda-bg-elevated/50 p-3 border border-nanda-border/30">
			<p class="text-[11px] text-nanda-text-dim leading-relaxed">
				<strong class="text-nanda-text-muted">Not a hierarchy — complementary layers.</strong> A2A and
				MCP provide immediate developer tools and security frameworks. NANDA drives longer-term research
				into decentralized discovery, privacy-preserving lookups, and federated index architectures.
			</p>
		</div>

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Click any layer to expand · Each protocol solves a distinct problem in the agentic stack
		</p>
	</div>
</div>
