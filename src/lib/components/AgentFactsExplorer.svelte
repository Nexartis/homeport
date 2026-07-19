<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const layers = [
		{
			num: 1,
			label: 'Identity & Naming',
			color: '#6942e6',
			fields: 'id, agent_name, label, description, version',
			desc: 'Unique machine ID, URN-based agent name, human-readable label. The root anchor for all other metadata — every trust chain starts here.'
		},
		{
			num: 2,
			label: 'Provider & DID',
			color: '#7c5cff',
			fields: 'provider.name, provider.url, provider.did',
			desc: 'Organization details with optional Decentralized Identifier (DID) for cryptographic provider verification. Enables automated provenance checks.'
		},
		{
			num: 3,
			label: 'Network Endpoints',
			color: '#0cd3da',
			fields: 'endpoints.static[], endpoints.resolver',
			desc: 'Static API URLs plus adaptive resolver configuration with geographic, load-balancing, and threat-shielding routing policies.'
		},
		{
			num: 4,
			label: 'Technical Capabilities',
			color: '#28eef3',
			fields: 'capabilities.modalities[], auth_methods[]',
			desc: 'Supported modalities (text, audio, video, image), streaming/batch support, authentication methods, and required OAuth scopes.'
		},
		{
			num: 5,
			label: 'Functional Skills',
			color: '#22c55e',
			fields: 'skills[].id, skills[].input_modes[], latency',
			desc: 'Detailed skill definitions with input/output modes, language support, latency budgets, and token limits. What agents query when searching for capabilities.'
		},
		{
			num: 6,
			label: 'Quality Evaluations',
			color: '#d97706',
			fields: 'evaluations[].score, availability_90d',
			desc: 'Performance scores, 90-day availability, audit timestamps, immutable audit trails (e.g., IPFS-pinned evidence), and auditor identification.'
		},
		{
			num: 7,
			label: 'Telemetry & Observability',
			color: '#3b82f6',
			fields: 'telemetry.p95_latency, throughput_rps',
			desc: 'Real-time metrics: p95 latency, throughput (RPS), error rate, availability. Sampling rates and retention policies for transparency.'
		},
		{
			num: 8,
			label: 'Certification & Trust',
			color: '#ef4444',
			fields: 'certification.level, issuer, expires',
			desc: 'Certification level, issuing authority, issuance and expiration dates. Enables automated trust decisions based on third-party attestations.'
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
			Interactive · AgentFacts Schema Explorer
		</p>

		<div class="grid gap-1.5">
			{#each layers as layer, i}
				<button
					class="min-w-0 w-full text-left rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-200 cursor-pointer flex items-center gap-3 {activeIndex ===
					i
						? ''
						: 'hover:bg-nanda-bg-elevated/30'}"
					style="border-color: {activeIndex === i
						? layer.color + '60'
						: 'rgba(37,37,48,0.4)'}; background: {activeIndex === i
						? layer.color + '10'
						: 'transparent'}"
					onclick={() => select(i)}
					aria-expanded={activeIndex === i}
				>
					<!-- Layer number badge -->
					<span
						class="flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold"
						style="background: {layer.color}20; color: {layer.color}">{layer.num}</span
					>

					<div class="flex-1 min-w-0">
						<h4
							class="text-sm font-semibold {activeIndex === i
								? 'text-nanda-text'
								: 'text-nanda-text-muted'} transition-colors"
						>
							{layer.label}
						</h4>
						{#if activeIndex !== i}
							<p class="text-[10px] font-mono text-nanda-text-dim truncate mt-0.5">
								{layer.fields}
							</p>
						{/if}
					</div>

					<div
						class="flex-shrink-0 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] transition-transform duration-200 {activeIndex ===
						i
							? 'rotate-45'
							: ''}"
						style="border-color: {layer.color}40; color: {layer.color}"
					>
						+
					</div>
				</button>

				{#if activeIndex === i}
					<div
						class="rounded-lg border px-4 py-3 -mt-0.5 ml-10"
						style="border-color: {layer.color}20; background: {layer.color}06"
						transition:fly={{ y: browser ? -6 : 0, duration: browser ? 150 : 0 }}
					>
						<p class="text-xs text-nanda-text-muted leading-relaxed mb-2">{layer.desc}</p>
						<p class="text-[10px] font-mono" style="color: {layer.color}">{layer.fields}</p>
					</div>
				{/if}
			{/each}
		</div>

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Click any layer to explore · Eight layers of verifiable agent metadata
		</p>
	</div>
</div>
