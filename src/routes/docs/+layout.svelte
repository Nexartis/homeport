<script lang="ts">
	import DocsSidebar from '$lib/components/DocsSidebar.svelte';
	import { Menu } from 'lucide-svelte';

	const { children } = $props();
	let mobileNavOpen = $state(false);
</script>

<div class="mx-auto max-w-[1100px] px-4 py-8">
	<!-- Mobile nav toggle — visible only below lg breakpoint -->
	<button
		class="lg:hidden flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-sm text-nanda-text-muted hover:text-nanda-text bg-nanda-bg-surface border border-nanda-border transition-colors"
		onclick={() => (mobileNavOpen = true)}
		aria-label="Open docs navigation"
	>
		<Menu size={16} />
		<span>Docs Navigation</span>
	</button>

	{#if mobileNavOpen}
		<DocsSidebar mobile onclose={() => (mobileNavOpen = false)} />
	{/if}

	<div class="flex flex-col lg:flex-row gap-10">
		<DocsSidebar />
		<div class="flex-1 min-w-0">
			{@render children()}
		</div>
	</div>
</div>
