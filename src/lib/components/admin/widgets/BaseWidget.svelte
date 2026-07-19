<script lang="ts">
	import { GripVertical, ChevronDown } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	const {
		title,
		collapsible = true,
		children,
		class: className = ''
	}: {
		title: string;
		collapsible?: boolean;
		children: Snippet;
		class?: string;
	} = $props();

	let collapsed = $state(false);
</script>

<div class="nanda-card {className}">
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<GripVertical class="h-4 w-4 text-nanda-text-dim" />
			<h3 class="text-sm font-semibold text-nanda-text">{title}</h3>
		</div>
		{#if collapsible}
			<button
				onclick={() => (collapsed = !collapsed)}
				class="text-nanda-text-dim hover:text-nanda-text transition-colors p-0.5 rounded"
				aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
				aria-expanded={!collapsed}
			>
				<ChevronDown class="h-4 w-4 transition-transform {collapsed ? '-rotate-90' : ''}" />
			</button>
		{/if}
	</div>
	{#if !collapsed}
		{@render children()}
	{/if}
</div>
