<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { ArrowLeft } from 'lucide-svelte';

	const { children }: { children: Snippet } = $props();

	/** True when viewing an individual series article */
	const isArticlePage = $derived(page.url.pathname !== '/series/agentic-web');
</script>

{#if isArticlePage}
	<div class="mx-auto max-w-3xl px-4 pt-6">
		<a
			href="/series/agentic-web"
			class="inline-flex items-center gap-1.5 text-sm text-nanda-text-dim hover:text-nanda-accent transition-colors group"
		>
			<ArrowLeft class="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
			Back to The Agentic Web
		</a>
	</div>
{/if}

{@render children()}
