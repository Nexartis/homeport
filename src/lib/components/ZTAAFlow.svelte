<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const steps = [
		{
			label: 'Agent A',
			action: 'Initiates task delegation',
			pillar: 'Cryptographic Identity',
			color: '#6942e6',
			desc: 'Agent A needs financial analysis. Its Ed25519-signed identity is verified against its AgentFacts before any delegation begins. Identity is the root of all trust.'
		},
		{
			label: 'ZTAA Policy Check',
			action: 'Verify delegation authority',
			pillar: 'Capability Verification',
			color: '#0cd3da',
			desc: 'Before A can delegate, the ZTAA framework verifies: Does A have delegation authority? Is the requested capability within scope? Has the depth limit been reached?'
		},
		{
			label: 'Agent B',
			action: 'Receives scoped delegation',
			pillar: 'Scope Narrowing',
			color: '#22c55e',
			desc: "Agent B receives a delegation token with narrowed permissions. B can only access what A explicitly granted — never more. The token is cryptographically bound to B's identity."
		},
		{
			label: 'Sub-delegation → C',
			action: 'B delegates data collection to C',
			pillar: 'Depth Limits',
			color: '#d97706',
			desc: 'B sub-delegates data collection to C. The delegation depth counter increments (now 2 of max 3). C receives even narrower permissions — only data-read access, no financial analysis capability.'
		},
		{
			label: 'AVC Monitoring',
			action: 'Continuous visibility',
			pillar: 'Agent Visibility & Control',
			color: '#3b82f6',
			desc: 'Enterprise AVC monitors the entire chain in real-time: who delegated to whom, what permissions were granted, what data is flowing. Any anomaly triggers automated response.'
		},
		{
			label: 'Cascade Revocation',
			action: 'B compromised → revoke chain',
			pillar: 'Instant Revocation',
			color: '#ef4444',
			desc: "If B is compromised or misbehaves, revoking B's credentials instantly invalidates all downstream delegations — C, D, E, and beyond. Milliseconds, not the hours required by traditional CRL/OCSP."
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
			Interactive · ZTAA Delegation Chain
		</p>

		<!-- Progress bar -->
		<div class="flex gap-1 mb-5">
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
		<div class="flex gap-1.5 mb-5 overflow-x-auto pb-2">
			{#each steps as step, i}
				<button
					class="flex-shrink-0 rounded-lg border px-2.5 py-2 min-w-[100px] text-left transition-all duration-200 cursor-pointer"
					style="border-color: {i === activeStep
						? step.color + '60'
						: 'rgba(37,37,48,0.4)'}; background: {i <= activeStep
						? step.color + '08'
						: 'transparent'}; opacity: {i <= activeStep ? 1 : 0.5}"
					onclick={() => setStep(i)}
				>
					<p class="text-[9px] font-mono" style="color: {step.color}">Step {i + 1}</p>
					<p
						class="text-[11px] font-semibold {i === activeStep
							? 'text-nanda-text'
							: 'text-nanda-text-muted'} mt-0.5"
					>
						{step.label}
					</p>
				</button>
			{/each}
		</div>

		<!-- Active step detail -->
		<div
			class="rounded-lg border p-4 sm:p-5"
			style="border-color: {steps[activeStep].color}30; background: {steps[activeStep].color}08"
		>
			{#key activeStep}
				<div transition:fly={{ y: browser ? 8 : 0, duration: browser ? 200 : 0 }}>
					<div class="flex items-center gap-2 mb-2">
						<span
							class="rounded-full px-2 py-0.5 text-[10px] font-bold"
							style="background: {steps[activeStep].color}20; color: {steps[activeStep].color}"
							>{steps[activeStep].pillar}</span
						>
						<span class="text-[10px] text-nanda-text-dim">{steps[activeStep].action}</span>
					</div>
					<p class="text-sm text-nanda-text-muted leading-relaxed">{steps[activeStep].desc}</p>
				</div>
			{/key}
		</div>

		<!-- Nav buttons -->
		<div class="flex items-center justify-between mt-4">
			<button
				class="text-xs text-nanda-text-dim hover:text-nanda-text-muted transition-colors disabled:opacity-30"
				disabled={activeStep === 0}
				onclick={() => setStep(activeStep - 1)}>← Previous</button
			>
			<p class="text-[10px] text-nanda-text-dim">{activeStep + 1} / {steps.length}</p>
			<button
				class="text-xs text-nanda-text-dim hover:text-nanda-text-muted transition-colors disabled:opacity-30"
				disabled={activeStep === steps.length - 1}
				onclick={() => setStep(activeStep + 1)}>Next →</button
			>
		</div>
	</div>
</div>
