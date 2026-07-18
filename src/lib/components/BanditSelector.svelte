<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const algorithms = [
		{
			label: 'Thompson Sampling',
			icon: '🎯',
			color: '#6942e6',
			subtitle: 'Bayesian · Default',
			desc: "Samples from Beta distributions based on each agent's success/failure history. Naturally balances explore vs. exploit — uncertain agents get explored, proven agents get exploited.",
			formula: 'Sample θᵢ ~ Beta(αᵢ, βᵢ), select argmax θᵢ',
			pros: [
				'Optimal explore/exploit balance',
				'Adapts to non-stationary environments',
				'Handles new agents gracefully'
			],
			cons: ['Stochastic — different result each call', 'Requires Bayesian prior assumptions'],
			bestFor: 'Most registries. The default choice when you want the system to learn continuously.'
		},
		{
			label: 'UCB1',
			icon: '📊',
			color: '#0cd3da',
			subtitle: 'Confidence Bound · Deterministic',
			desc: 'Selects the agent with the highest upper confidence bound. Agents with fewer selections get a larger exploration bonus, ensuring under-tested agents get a fair chance.',
			formula: 'score + √(2 ln(N) / nᵢ)',
			pros: [
				'Deterministic — same state, same result',
				'Mathematically principled regret bounds',
				'No tuning parameters'
			],
			cons: ['Can over-explore in large registries', 'Slower convergence than Thompson'],
			bestFor: 'When you need reproducible selection decisions and audit trails.'
		},
		{
			label: 'Epsilon-Greedy',
			icon: '🎲',
			color: '#22c55e',
			subtitle: 'Simple · Tunable',
			desc: 'Exploits the current best agent with probability (1 − ε), explores a random agent with probability ε. Simple, tunable, and effective when you want a guaranteed minimum exploration rate.',
			formula: 'P(explore) = ε, P(exploit) = 1 − ε',
			pros: [
				'Dead simple to understand',
				'Guaranteed exploration rate',
				'Easy to tune with one parameter'
			],
			cons: ['Explores uniformly — wastes budget on bad agents', 'ε must be manually tuned'],
			bestFor: 'When you want explicit control over the exploration budget.'
		},
		{
			label: 'Static',
			icon: '📌',
			color: '#71717a',
			subtitle: 'Fixed · No exploration',
			desc: "Always picks the top-ranked entry. No exploration. Useful when you've already identified the best agent and want deterministic routing.",
			formula: 'Always select rank #1',
			pros: ['Zero exploration overhead', 'Fully predictable', 'Lowest latency'],
			cons: ['Never discovers better agents', 'Blind to quality degradation'],
			bestFor: 'Post-convergence lock-in, A/B testing specific agents, or cost-sensitive workloads.'
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
			Interactive · Selection Algorithms
		</p>

		<!-- Algorithm cards -->
		<div class="grid gap-2 sm:grid-cols-2">
			{#each algorithms as algo, i}
				<button
					class="text-left rounded-lg border-2 p-3 transition-all duration-200 cursor-pointer {activeIndex ===
					i
						? 'scale-[1.01]'
						: 'hover:scale-[1.005]'}"
					style="border-color: {activeIndex === i
						? algo.color
						: algo.color + '25'}; background: {activeIndex === i
						? algo.color + '10'
						: algo.color + '04'}"
					onclick={() => select(i)}
					aria-expanded={activeIndex === i}
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-lg">{algo.icon}</span>
							<div>
								<h4
									class="text-sm font-bold"
									style="color: {activeIndex === i ? algo.color : '#e2e8f0'}"
								>
									{algo.label}
								</h4>
								<p class="text-[10px] text-nanda-text-dim">{algo.subtitle}</p>
							</div>
						</div>
						<div
							class="h-5 w-5 rounded-full border flex items-center justify-center text-[10px] transition-transform duration-200 {activeIndex ===
							i
								? 'rotate-45'
								: ''}"
							style="border-color: {algo.color}60; color: {algo.color}"
						>
							+
						</div>
					</div>
				</button>
			{/each}
		</div>

		<!-- Expanded detail -->
		{#if activeIndex >= 0}
			{@const algo = algorithms[activeIndex]}
			<div
				class="mt-3 rounded-lg border p-4 sm:p-5"
				style="border-color: {algo.color}25; background: {algo.color}06"
				transition:fly={{ y: browser ? -8 : 0, duration: browser ? 180 : 0 }}
			>
				<p class="text-sm text-nanda-text-muted leading-relaxed mb-3">{algo.desc}</p>

				<!-- Formula -->
				<div
					class="rounded-md px-3 py-2 mb-3 font-mono text-xs"
					style="background: {algo.color}10; color: {algo.color}"
				>
					{algo.formula}
				</div>

				<!-- Pros / Cons grid -->
				<div class="grid gap-3 sm:grid-cols-2 mb-3">
					<div>
						<p class="text-[10px] font-semibold text-nanda-success mb-1.5">✓ Strengths</p>
						{#each algo.pros as pro}
							<p class="text-[11px] text-nanda-text-dim flex items-start gap-1.5 mb-1">
								<span class="h-1 w-1 rounded-full bg-nanda-success mt-1.5 flex-shrink-0"></span>
								{pro}
							</p>
						{/each}
					</div>
					<div>
						<p class="text-[10px] font-semibold text-nanda-danger mb-1.5">✗ Trade-offs</p>
						{#each algo.cons as con}
							<p class="text-[11px] text-nanda-text-dim flex items-start gap-1.5 mb-1">
								<span class="h-1 w-1 rounded-full bg-nanda-danger mt-1.5 flex-shrink-0"></span>
								{con}
							</p>
						{/each}
					</div>
				</div>

				<!-- Best for -->
				<div
					class="rounded-md border p-2.5"
					style="border-color: {algo.color}20; background: {algo.color}04"
				>
					<p class="text-[11px] text-nanda-text-muted">
						<strong class="text-nanda-text">Best for:</strong>
						{algo.bestFor}
					</p>
				</div>
			</div>
		{/if}

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Click any algorithm to compare · Registry owners choose per-registry
		</p>
	</div>
</div>
