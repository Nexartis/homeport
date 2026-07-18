<script lang="ts">
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const registries = [
		{
			id: 'native',
			label: 'NANDA Native',
			example: '@agentx',
			x: 50,
			y: 18,
			color: '#6942e6',
			desc: 'Global, open registration. Agent or provider controlled. The default public namespace.'
		},
		{
			id: 'gov',
			label: 'Government',
			example: '@US:shop',
			x: 15,
			y: 50,
			color: '#0cd3da',
			desc: 'Jurisdiction-scoped registry. Managed by regulatory bodies. Enforces compliance policies per region.'
		},
		{
			id: 'ent-routed',
			label: 'Enterprise (Routed)',
			example: '@company',
			x: 50,
			y: 82,
			color: '#22c55e',
			desc: 'Internal agents visible only through the company registry. Enterprise IT controls all access and discovery.'
		},
		{
			id: 'ent-direct',
			label: 'Enterprise (Direct)',
			example: '@company:shop',
			x: 85,
			y: 50,
			color: '#3b82f6',
			desc: 'Company-administered agents visible globally. Combines enterprise governance with public discoverability.'
		},
		{
			id: 'web3-routed',
			label: 'Web3 (Routed)',
			example: '@DID:co',
			x: 22,
			y: 82,
			color: '#d97706',
			desc: 'Agents accessed via a Web3 marketplace. DID holder controls the namespace and registration.'
		},
		{
			id: 'web3-direct',
			label: 'Web3 (Direct)',
			example: '@DID:co:agent',
			x: 78,
			y: 18,
			color: '#ef4444',
			desc: 'Global, DID-authenticated agent registration. Fully decentralized identity anchoring.'
		}
	];

	const connections = [
		[0, 1],
		[0, 3],
		[0, 5],
		[1, 4],
		[1, 2],
		[2, 3],
		[2, 4],
		[3, 5],
		[4, 2]
	];

	let activeId = $state('');

	function select(id: string) {
		activeId = activeId === id ? '' : id;
	}

	const activeRegistry = $derived(registries.find((r) => r.id === activeId));
</script>

<div class="not-prose my-8">
	<div class="rounded-xl border border-nanda-border/60 bg-nanda-bg-surface/80 p-5 sm:p-6">
		<p class="text-xs font-semibold uppercase tracking-wider text-nanda-text-dim mb-4">
			Interactive · Quilt Federation Topology
		</p>

		<!-- SVG topology -->
		<div class="relative w-full" style="padding-bottom: 60%">
			<svg
				class="absolute inset-0 w-full h-full"
				viewBox="0 0 100 100"
				preserveAspectRatio="xMidYMid meet"
			>
				<!-- Connections -->
				{#each connections as [a, b]}
					<line
						x1={registries[a].x}
						y1={registries[a].y}
						x2={registries[b].x}
						y2={registries[b].y}
						stroke={activeId && (registries[a].id === activeId || registries[b].id === activeId)
							? registries[a].id === activeId
								? registries[a].color
								: registries[b].color
							: 'rgba(37,37,48,0.6)'}
						stroke-width={activeId &&
						(registries[a].id === activeId || registries[b].id === activeId)
							? '0.4'
							: '0.2'}
						stroke-dasharray={activeId &&
						(registries[a].id === activeId || registries[b].id === activeId)
							? '0'
							: '1,1'}
					/>
				{/each}

				<!-- Nodes -->
				{#each registries as reg}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						class="cursor-pointer"
						onclick={() => select(reg.id)}
						style="transition: transform 0.2s"
					>
						<circle
							cx={reg.x}
							cy={reg.y}
							r={activeId === reg.id ? 4.5 : 3.5}
							fill={activeId === reg.id ? reg.color + '30' : '#12121a'}
							stroke={reg.color}
							stroke-width={activeId === reg.id ? 0.6 : 0.4}
						/>
						{#if activeId === reg.id}
							<circle
								cx={reg.x}
								cy={reg.y}
								r="6"
								fill="none"
								stroke={reg.color}
								stroke-width="0.15"
								opacity="0.5"
							/>
						{/if}
						<text
							x={reg.x}
							y={reg.y + (reg.y < 30 ? -6 : 7.5)}
							text-anchor="middle"
							fill={activeId === reg.id ? reg.color : '#94a3b8'}
							font-size="2.5"
							font-family="Inter, sans-serif"
							font-weight={activeId === reg.id ? '600' : '400'}>{reg.label}</text
						>
						<text
							x={reg.x}
							y={reg.y + (reg.y < 30 ? -3.5 : 10)}
							text-anchor="middle"
							fill={reg.color}
							font-size="2"
							font-family="JetBrains Mono, monospace"
							opacity="0.7">{reg.example}</text
						>
					</g>
				{/each}
			</svg>
		</div>

		<!-- Detail panel -->
		{#if activeRegistry}
			<div
				class="mt-4 rounded-lg border p-4"
				style="border-color: {activeRegistry.color}30; background: {activeRegistry.color}08"
				transition:fly={{ y: browser ? -8 : 0, duration: browser ? 180 : 0 }}
			>
				<div class="flex items-center gap-2 mb-2">
					<span class="h-2.5 w-2.5 rounded-full" style="background: {activeRegistry.color}"></span>
					<h4 class="text-sm font-bold text-nanda-text">{activeRegistry.label}</h4>
					<code class="text-xs ml-auto" style="color: {activeRegistry.color}"
						>{activeRegistry.example}</code
					>
				</div>
				<p class="text-xs text-nanda-text-muted leading-relaxed">{activeRegistry.desc}</p>
			</div>
		{/if}

		<p class="text-[10px] text-nanda-text-dim mt-4 text-center">
			Click any registry node · Pull-based sync — no central authority required
		</p>
	</div>
</div>
