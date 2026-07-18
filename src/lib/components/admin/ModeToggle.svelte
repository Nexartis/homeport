<script lang="ts">
	import { LayoutGrid, GitBranch } from 'lucide-svelte';

	let { mode = $bindable('grid') }: { mode: 'grid' | 'flow' } = $props();
</script>

<div
	class="flex items-center gap-1 rounded-lg border border-nanda-border bg-nanda-bg-surface p-0.5"
>
	<button
		class="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors
			{mode === 'grid'
			? 'bg-nanda-primary-500/20 text-nanda-primary-400'
			: 'text-nanda-text-muted hover:text-nanda-text'}"
		onclick={() => (mode = 'grid')}
		aria-label="Grid mode"
		aria-pressed={mode === 'grid'}
	>
		<LayoutGrid class="h-3.5 w-3.5" />
		Grid
	</button>
	<button
		class="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors
			{mode === 'flow'
			? 'bg-nanda-accent-500/20 text-nanda-accent-400'
			: 'text-nanda-text-muted hover:text-nanda-text'}"
		onclick={() => (mode = 'flow')}
		aria-label="Flow mode"
		aria-pressed={mode === 'flow'}
	>
		<GitBranch class="h-3.5 w-3.5" />
		Flow
	</button>
</div>
