<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { ArrowLeft } from 'lucide-svelte';

	const { children }: { children: Snippet } = $props();

	/** True when viewing an individual agent detail page */
	const isDetailPage = $derived(page.url.pathname !== '/agents');
</script>

{#if isDetailPage}
	<div class="mx-auto max-w-3xl px-4 pt-6">
		<a
			href="/agents"
			class="inline-flex items-center gap-1.5 text-sm text-nanda-text-dim hover:text-nanda-accent transition-colors group"
		>
			<ArrowLeft class="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
			Back to Agent Registry
		</a>
	</div>
{/if}

{@render children()}
