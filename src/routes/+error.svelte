<script lang="ts">
	import { page } from '$app/state';
	import HomeportMark from '$lib/components/HomeportMark.svelte';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong.');
	const heading = $derived(status === 404 ? 'Page not found' : 'Unexpected error');
</script>

<svelte:head>
	<title>{status} — Homeport</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section
	class="mx-auto flex min-h-[60vh] max-w-[640px] flex-col items-center justify-center px-4 py-16 text-center"
>
	<div class="mb-6 flex items-center gap-2.5">
		<HomeportMark size="lg" />
		<span class="text-sm font-bold tracking-wide text-nanda-text">Homeport</span>
	</div>

	<p class="mb-2 font-mono text-xs uppercase tracking-widest text-nanda-text-dim">
		Error {status}
	</p>
	<h1 class="mb-4 text-3xl font-bold text-nanda-text sm:text-4xl">{heading}</h1>
	<p class="mb-8 max-w-md text-sm text-nanda-text-muted">{message}</p>

	<div class="flex flex-wrap items-center justify-center gap-3">
		<a
			href="/"
			class="rounded-lg border border-nanda-border/60 bg-nanda-bg-muted px-4 py-2 text-sm font-medium text-nanda-text transition-colors hover:border-nanda-text-dim hover:bg-nanda-bg-elevated"
		>
			Back to home
		</a>
		<a
			href="/docs"
			class="rounded-lg px-4 py-2 text-sm text-nanda-text-muted transition-colors hover:text-nanda-text"
		>
			Documentation
		</a>
	</div>
</section>
