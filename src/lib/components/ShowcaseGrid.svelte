<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import { showcaseNodes, type ShowcaseNode } from './showcase-data';

	type Props = { nodes?: ShowcaseNode[] };
	const { nodes = showcaseNodes }: Props = $props();
</script>

<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
	{#each nodes as node (node.domain)}
		<a
			href="https://{node.domain}"
			target="_blank"
			rel="noopener noreferrer"
			class="group flex flex-col overflow-hidden rounded-xl border border-nanda-border/60 bg-nanda-bg-elevated/40 hover:border-nanda-text-dim focus-visible:border-nanda-text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nanda-primary-500/50 transition-colors"
		>
			<div
				class="relative aspect-[16/9] w-full overflow-hidden bg-nanda-bg-surface"
				aria-hidden={node.image ? undefined : 'true'}
			>
				{#if node.image}
					<img
						src={node.image}
						alt={node.imageAlt ?? ''}
						width="640"
						height="360"
						loading="lazy"
						decoding="async"
						class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
					/>
				{:else}
					<div
						class="flex h-full w-full items-center justify-center text-3xl font-extrabold tracking-wider"
						style="background:linear-gradient(135deg, hsl({node.hue ??
							220} 55% 22%), hsl({node.hue ?? 220} 40% 12%)); color: hsl({node.hue ?? 220} 90% 82%)"
					>
						{node.glyph ?? node.name.slice(0, 2)}
					</div>
				{/if}
				{#if node.badge}
					<span
						class="absolute top-2 left-2 rounded-full bg-nanda-primary-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow"
					>
						{node.badge}
					</span>
				{/if}
			</div>
			<div class="flex flex-1 flex-col gap-2 p-4">
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-[15px] font-semibold text-nanda-text leading-snug">
						{node.name}
					</h3>
					<ExternalLink
						class="mt-1 h-3.5 w-3.5 shrink-0 text-nanda-text-dim group-hover:text-nanda-text-muted"
						aria-hidden="true"
					/>
				</div>
				<p class="text-[11px] uppercase tracking-wider font-semibold text-nanda-accent-400">
					{node.tag}
				</p>
				<p class="text-[13px] text-nanda-text-muted leading-relaxed">
					{node.blurb}
				</p>
				<p
					class="mt-auto pt-2 text-[11.5px] font-mono text-nanda-text-dim group-hover:text-nanda-text-muted"
				>
					{node.domain}
				</p>
			</div>
		</a>
	{/each}
</div>
