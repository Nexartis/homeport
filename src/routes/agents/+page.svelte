<script lang="ts">
	import { page } from '$app/state';
	import { Search, ExternalLink, ArrowRight } from 'lucide-svelte';
	import type { PageData } from './$types';
	const { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Agent Registry — Homeport</title>
	<meta
		name="description"
		content="Browse all AI agents registered on this NANDA node — search by name, view capabilities, tags, and status."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/agents.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/agents.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4">
	<!-- Header -->
	<div
		class="py-12 pb-8 border-b border-nanda-border/40"
		style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
	>
		<div class="flex items-start justify-between gap-4 flex-wrap">
			<div>
				<h1 class="text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mb-3 gradient-text">
					Agent Registry
				</h1>
				<p class="text-nanda-text-muted max-w-[640px]">
					Browse all AI agents currently registered on this NANDA node. Each agent is discoverable
					via the NANDA Index and verified with W3C Verifiable Credentials.
				</p>
			</div>
		</div>
	</div>

	<!-- Search -->
	<div class="py-8">
		<form method="get" class="flex gap-3 max-w-lg">
			<input
				type="text"
				name="q"
				value={data.query}
				placeholder="Search agents by ID..."
				class="flex-1 rounded-lg border border-nanda-border bg-nanda-bg-elevated px-4 py-2.5 text-sm text-nanda-text placeholder:text-nanda-text-dim focus:outline-none focus:border-nanda-primary/50"
			/>
			<button type="submit" class="nanda-btn-primary text-sm">Search</button>
		</form>
		<p class="text-xs text-nanda-text-dim mt-3">
			{data.total} agent{data.total !== 1 ? 's' : ''} registered
		</p>
	</div>

	<!-- Agent Grid -->
	<div class="pb-14">
		{#if data.agents.length > 0}
			<div class="grid gap-4" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">
				{#each data.agents as a}
					<div class="nanda-card nanda-card-accent">
						<div class="flex items-start justify-between gap-2 mb-2">
							<a
								href="/agents/{encodeURIComponent(a.agent_id)}"
								class="font-mono text-[15px] font-semibold break-all text-nanda-text hover:text-nanda-accent transition-colors no-underline"
								>{a.agent_id}</a
							>
							<span class="status-badge status-operational text-[11px] shrink-0">{a.status}</span>
						</div>
						<a
							class="font-mono text-xs text-nanda-text-dim hover:text-nanda-accent break-all mb-2 inline-flex items-center gap-1"
							href={a.agent_url}
							target="_blank"
							rel="noopener noreferrer"
							>{a.agent_url} <ExternalLink class="h-2.5 w-2.5 shrink-0" /></a
						>
						<div class="flex items-center gap-2 text-xs text-nanda-text-dim mb-2 mt-1">
							<span>Source: {a.source}</span>
							<span>·</span>
							<span>Registered: {a.registered_at}</span>
						</div>
						{#if a.capabilities.length > 0 || a.tags.length > 0}
							<div class="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-nanda-border/40">
								{#each a.capabilities as c}<span class="agent-tag">{c}</span>{/each}
								{#each a.tags as t}<span class="agent-tag">{t}</span>{/each}
							</div>
						{/if}
						<a
							href="/agents/{encodeURIComponent(a.agent_id)}"
							class="mt-3 inline-flex items-center gap-1 text-xs text-nanda-accent hover:text-nanda-accent/80 transition-colors no-underline"
							>View details <ArrowRight class="h-3 w-3" /></a
						>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-16">
				<div
					class="flex h-14 w-14 items-center justify-center rounded-2xl bg-nanda-primary/10 mx-auto mb-4"
				>
					<Search class="h-7 w-7 text-nanda-primary" />
				</div>
				<h2 class="text-xl font-semibold mb-2">
					{#if data.query}No agents found matching "{data.query}"{:else}No agents registered yet{/if}
				</h2>
				<p class="text-nanda-text-muted text-sm mb-6">
					{#if data.query}Try a different search term or <a
							href="/agents"
							class="text-nanda-accent hover:underline">view all agents</a
						>.
					{:else}Register your first agent using the NANDA API.{/if}
				</p>
				<a href="/docs/quickstart" class="nanda-btn-primary">Quickstart Guide →</a>
			</div>
		{/if}
	</div>
</div>
