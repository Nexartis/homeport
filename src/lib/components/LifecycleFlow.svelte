<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const steps = [
		{
			label: 'New Agent Appears',
			action: 'Discovery',
			color: '#0cd3da',
			icon: '🌐',
			desc: 'A new CSS-in-JS layout agent appears in the NANDA Index, published by a third-party developer. It has an AgentFact with Ed25519 identity and declared capabilities.'
		},
		{
			label: 'Optimization Agent Scouts',
			action: 'Evaluation',
			color: '#6942e6',
			icon: '🔍',
			desc: "The Optimization Agent detects it during a routine index scan, checks its certification grade from the publishing NANDA node, and determines it's worth testing."
		},
		{
			label: 'Registry Registration',
			action: 'Onboarding',
			color: '#22c55e',
			icon: '📋',
			desc: "The Optimization Agent registers the new agent in Cubicube's KYM registry, adding it as a new arm to the Thompson Sampling bandit."
		},
		{
			label: 'Capability Certification',
			action: 'Testing',
			color: '#3b82f6',
			icon: '🧪',
			desc: "NANDA's Capability Certifier runs the layout test suite. The agent scores B+ with strong responsive performance but weaker semantic HTML."
		},
		{
			label: 'Observer Monitoring',
			action: 'Liveness probes',
			color: '#0cd3da',
			icon: '📡',
			desc: "NANDA's Observer begins hourly probes. The agent shows 99.7% availability — well above the threshold for production routing."
		},
		{
			label: 'Bandit Exploration',
			action: 'Thompson Sampling',
			color: '#6942e6',
			icon: '🎯',
			desc: 'Thompson Sampling gives the new agent exploration opportunities. Pegasus routes some layout tasks to it alongside the incumbent.'
		},
		{
			label: 'Usage Receipts',
			action: 'Feedback loop',
			color: '#d97706',
			icon: '📝',
			desc: "Orchestrators submit Ed25519-signed usage receipts — the new agent succeeds on 87% of tasks, compared to the incumbent's 91%."
		},
		{
			label: 'Posterior Converges',
			action: 'Learning',
			color: '#3b82f6',
			icon: '📊',
			desc: 'Over the next week, the bandit posterior converges: the incumbent remains preferred, but the new agent holds a solid second-place position as a fallback.'
		},
		{
			label: 'Incumbent Degrades',
			action: 'Re-certification',
			color: '#ef4444',
			icon: '⚠️',
			desc: "Two months later, the incumbent's observer data shows increasing latency. The Optimization Agent triggers re-certification. The incumbent drops to B."
		},
		{
			label: 'Automatic Promotion',
			action: 'No human touched anything',
			color: '#22c55e',
			icon: '🏆',
			desc: 'Thompson Sampling shifts selection probability. The new agent becomes the primary choice. The entire transition happened autonomously — no human touched anything.'
		}
	];

	let activeStep = $state(0);

	function setStep(i: number) {
		activeStep = i;
	}
</script>

<div class="not-prose my-8">
	<div class="rounded-xl border border-nanda-border/60 bg-nanda-bg-surface/80 p-5 sm:p-6">
		<p class="text-xs font-semibold uppercase tracking-wider text-nanda-text-dim mb-5">
			Interactive · The Complete Self-Improving Lifecycle
		</p>

		<!-- Progress bar -->
		<div class="flex gap-0.5 mb-5">
			{#each steps as step, i}
				<button
					class="flex-1 h-1.5 rounded-full transition-all duration-300 cursor-pointer"
					style="background: {i <= activeStep ? step.color : 'rgba(37,37,48,0.6)'}"
					onclick={() => setStep(i)}
					aria-label="Step {i + 1}: {step.label}"
				></button>
			{/each}
		</div>

		<!-- Step cards row -->
		<div class="flex gap-1 mb-5 overflow-x-auto pb-2">
			{#each steps as step, i}
				<button
					class="flex-shrink-0 rounded-lg border px-2 py-1.5 min-w-[80px] text-left transition-all duration-200 cursor-pointer"
					style="border-color: {i === activeStep
						? step.color + '60'
						: 'rgba(37,37,48,0.4)'}; background: {i <= activeStep
						? step.color + '08'
						: 'transparent'}; opacity: {i <= activeStep ? 1 : 0.5}"
					onclick={() => setStep(i)}
				>
					<p class="text-[9px] font-mono" style="color: {step.color}">{i + 1}</p>
					<p
						class="text-[10px] font-semibold {i === activeStep
							? 'text-nanda-text'
							: 'text-nanda-text-muted'} mt-0.5 leading-tight"
					>
						{step.icon}
						{step.label}
					</p>
				</button>
			{/each}
		</div>

		<!-- Active step detail -->
		{#if activeStep >= 0}
			{@const step = steps[activeStep]}
			<div
				class="rounded-lg border p-4 sm:p-5"
				style="border-color: {step.color}30; background: {step.color}08"
				transition:fly={{ y: browser ? -10 : 0, duration: browser ? 200 : 0 }}
			>
				<div class="flex items-start gap-3">
					<span class="text-2xl">{step.icon}</span>
					<div>
						<h4 class="text-sm font-bold text-nanda-text mb-0.5">
							<span class="font-mono text-xs mr-1.5" style="color: {step.color}"
								>Step {activeStep + 1}</span
							>
							{step.label}
						</h4>
						<p class="text-[10px] font-medium mb-2" style="color: {step.color}">{step.action}</p>
						<p class="text-sm text-nanda-text-muted leading-relaxed">{step.desc}</p>
					</div>
				</div>
			</div>
		{/if}

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Click any step to explore · 10 steps from discovery to autonomous promotion
		</p>
	</div>
</div>
