<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	let activePath = $state<'direct' | 'private' | null>(null);

	function togglePath(path: 'direct' | 'private') {
		activePath = activePath === path ? null : path;
	}

	const paths = {
		direct: {
			label: 'PrimaryFactsURL',
			subtitle: 'Direct Path',
			color: '#0cd3da',
			icon: '🌐',
			steps: [
				{ label: 'Requesting Agent', desc: 'Initiates discovery lookup' },
				{ label: 'NANDA Index', desc: 'Returns PrimaryFactsURL' },
				{ label: 'Agent Infrastructure', desc: 'Direct metadata retrieval' },
				{ label: 'AgentFacts Document', desc: 'Complete, fresh metadata' }
			],
			tradeoff: "Fast and complete, but the agent's operator can see who's looking.",
			bestFor: 'Routine capability lookups, public service discovery, non-sensitive workflows.'
		},
		private: {
			label: 'PrivateFactsURL',
			subtitle: 'Anonymous Path',
			color: '#6942e6',
			icon: '🔒',
			steps: [
				{ label: 'Requesting Agent', desc: 'Initiates private lookup' },
				{ label: 'NANDA Index', desc: 'Returns PrivateFactsURL' },
				{ label: 'Neutral Third Party', desc: 'IPFS / privacy relay / decentralized storage' },
				{ label: 'AgentFacts Subset', desc: 'Anonymous retrieval — agent never knows' }
			],
			tradeoff:
				'Private and anonymous, but may have slightly higher latency and a metadata subset.',
			bestFor:
				'Competitive intelligence, pre-negotiation scouting, regulatory investigations, healthcare/finance.'
		}
	};
</script>

<div class="not-prose my-8">
	<div class="rounded-xl border border-nanda-border/60 bg-nanda-bg-surface/80 p-5 sm:p-6">
		<p class="text-xs font-semibold uppercase tracking-wider text-nanda-text-dim mb-5">
			Interactive · Dual-Path Resolution
		</p>

		<!-- Toggle buttons -->
		<div class="flex gap-2 mb-6">
			{#each ['direct', 'private'] as const as pathKey}
				{@const p = paths[pathKey]}
				<button
					class="flex-1 rounded-lg border-2 p-3 text-left transition-all duration-200 cursor-pointer {activePath ===
					pathKey
						? ''
						: 'hover:bg-nanda-bg-elevated/30'}"
					style="border-color: {activePath === pathKey
						? p.color
						: p.color + '25'}; background: {activePath === pathKey
						? p.color + '10'
						: 'transparent'}"
					onclick={() => togglePath(pathKey)}
					aria-pressed={activePath === pathKey}
				>
					<div class="flex items-center gap-2">
						<span class="text-lg">{p.icon}</span>
						<div>
							<h4
								class="text-sm font-bold"
								style="color: {activePath === pathKey ? p.color : '#94a3b8'}"
							>
								{p.label}
							</h4>
							<p class="text-[10px] text-nanda-text-dim">{p.subtitle}</p>
						</div>
					</div>
				</button>
			{/each}
		</div>

		<!-- Flow visualization -->
		{#if activePath}
			{@const p = paths[activePath]}
			<div transition:fly={{ y: browser ? -10 : 0, duration: browser ? 200 : 0 }}>
				<!-- Step-through flow -->
				<div class="flex items-center gap-1 mb-5 overflow-x-auto pb-2">
					{#each p.steps as step, i}
						<div class="flex items-center gap-1 flex-shrink-0">
							<div
								class="rounded-lg border px-3 py-2 min-w-[120px]"
								style="border-color: {p.color}40; background: {p.color}08"
							>
								<p class="text-[10px] font-semibold" style="color: {p.color}">{step.label}</p>
								<p class="text-[9px] text-nanda-text-dim mt-0.5">{step.desc}</p>
							</div>
							{#if i < p.steps.length - 1}
								<svg class="flex-shrink-0 h-3 w-4" viewBox="0 0 16 12">
									<path
										d="M0 6h12M10 2l4 4-4 4"
										fill="none"
										stroke={p.color}
										stroke-width="1.5"
										opacity="0.6"
									/>
								</svg>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Trade-off note -->
				<div
					class="rounded-lg border p-3"
					style="border-color: {p.color}20; background: {p.color}06"
				>
					<p class="text-xs text-nanda-text-muted mb-1">
						<strong class="text-nanda-text">Trade-off:</strong>
						{p.tradeoff}
					</p>
					<p class="text-xs text-nanda-text-dim">
						<strong style="color: {p.color}">Best for:</strong>
						{p.bestFor}
					</p>
				</div>
			</div>
		{/if}

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Select a resolution path · The requester's policy engine chooses per-query
		</p>
	</div>
</div>
