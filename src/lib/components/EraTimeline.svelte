<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const eras = [
		{
			decade: '1990s',
			label: 'Endpoints',
			color: '#71717a',
			icon: '📄',
			desc: 'Static HTML, images, and CGI scripts. A user requests a page; a server returns bytes; the conversation ends.',
			traits: ['Request → Response', 'Human-initiated', 'Stateless']
		},
		{
			decade: '2000s',
			label: 'Services',
			color: '#3b82f6',
			icon: '🔗',
			desc: 'REST and GraphQL APIs turned machines into first-class clients. Data mutated continuously, not just on release nights.',
			traits: ['Machine-readable', 'CRUD operations', 'Session-based auth']
		},
		{
			decade: '2010s',
			label: 'Workers',
			color: '#0cd3da',
			icon: '⚡',
			desc: 'Serverless functions, cron jobs, and RPA bots. Short-lived, event-driven compute — thousands spin up when a queue spikes.',
			traits: ['Event-driven', 'Ephemeral', 'Auto-scaling']
		},
		{
			decade: '2020s',
			label: 'Agents',
			color: '#6942e6',
			icon: '🤖',
			desc: 'Autonomous, LLM-powered entities that pursue goals, maintain memories, migrate runtimes, and delegate sub-tasks.',
			traits: ['Goal-driven', 'Self-directed discovery', 'Delegated authority']
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
			Interactive · The Web's Four Eras
		</p>

		<!-- Timeline bar -->
		<div class="relative flex items-center justify-between mb-2">
			<!-- Connecting line -->
			<div class="absolute left-0 right-0 top-1/2 h-px bg-nanda-border"></div>

			{#each eras as era, i}
				<button
					class="relative z-10 flex flex-col items-center gap-2 group"
					onclick={() => select(i)}
					aria-expanded={activeIndex === i}
				>
					<div
						class="h-11 w-11 sm:h-12 sm:w-12 rounded-full border-2 flex items-center justify-center text-lg transition-all duration-200 cursor-pointer {activeIndex ===
						i
							? 'scale-110 shadow-lg'
							: 'hover:scale-105'}"
						style="border-color: {era.color}; background: {activeIndex === i
							? era.color + '20'
							: '#12121a'}; box-shadow: {activeIndex === i
							? '0 0 20px ' + era.color + '30'
							: 'none'}"
					>
						{era.icon}
					</div>
					<div class="text-center">
						<p class="text-[10px] font-mono tracking-wide" style="color: {era.color}">
							{era.decade}
						</p>
						<p
							class="text-xs font-semibold {activeIndex === i
								? 'text-nanda-text'
								: 'text-nanda-text-muted'} transition-colors"
						>
							{era.label}
						</p>
					</div>
				</button>
			{/each}
		</div>

		<!-- Expanded detail panel -->
		{#if activeIndex >= 0}
			{@const era = eras[activeIndex]}
			<div
				class="mt-5 rounded-lg border p-4 sm:p-5"
				style="border-color: {era.color}30; background: {era.color}08"
				transition:fly={{ y: browser ? -10 : 0, duration: browser ? 200 : 0 }}
			>
				<div class="flex items-start gap-3">
					<span class="text-2xl">{era.icon}</span>
					<div>
						<h4 class="text-sm font-bold text-nanda-text mb-1">
							<span style="color: {era.color}">{era.decade}</span> — {era.label}
						</h4>
						<p class="text-sm text-nanda-text-muted leading-relaxed mb-3">{era.desc}</p>
						<div class="flex flex-wrap gap-2">
							{#each era.traits as trait}
								<span
									class="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
									style="background: {era.color}15; color: {era.color}">{trait}</span
								>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Click any era to explore · At the agent stage, three thresholds appear that no prior
			architecture was designed to cross
		</p>
	</div>
</div>
