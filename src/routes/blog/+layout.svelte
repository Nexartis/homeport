<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { ArrowLeft } from 'lucide-svelte';

	const { children }: { children: Snippet } = $props();

	/** True when viewing an individual blog post (any /blog/* child route) */
	const isPostPage = $derived(page.url.pathname !== '/blog');
</script>

{#if isPostPage}
	<div class="mx-auto max-w-3xl px-4 pt-6">
		<a
			href="/blog"
			class="inline-flex items-center gap-1.5 text-sm text-nanda-text-dim hover:text-nanda-accent transition-colors group"
		>
			<ArrowLeft class="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
			Back to Blog
		</a>
	</div>
{/if}

{@render children()}
