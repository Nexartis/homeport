<script lang="ts">
	import type { PageData } from './$types';
	import {
		Globe,
		ExternalLink,
		Shield,
		Award,
		Activity,
		Tag,
		Clock,
		Server,
		ArrowRight
	} from 'lucide-svelte';

	const { data }: { data: PageData } = $props();

	function fmtDate(ts: number | null | undefined): string {
		if (!ts) return '—';
		return new Date(ts * 1000).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function fmtPct(v: number | null | undefined): string {
		if (v == null) return '—';
		return `${(v * 100).toFixed(1)}%`;
	}
</script>

<svelte:head>
	<title>{data.agent.agentId} — NANDA Agent</title>
	<meta name="description" content="Agent details for {data.agent.agentId} on the NANDA network" />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-8">
	<!-- Identity Header -->
	<header class="mb-8">
		<div class="flex items-center gap-2 mb-2">
			<span
				class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {data
					.agent.status === 'alive'
					? 'bg-green-500/10 text-green-400'
					: 'bg-red-500/10 text-red-400'}"
			>
				<span
					class="h-1.5 w-1.5 rounded-full {data.agent.status === 'alive'
						? 'bg-green-400'
						: 'bg-red-400'}"
				></span>
				{data.agent.status}
			</span>
			<span class="text-xs text-nanda-text-dim font-mono">{data.agent.source}</span>
		</div>
		<h1 class="text-2xl font-bold break-all">{data.facts?.agentName ?? data.agent.agentId}</h1>
		{#if data.facts?.agentName}
			<p class="text-sm text-nanda-text-dim font-mono mt-1">{data.agent.agentId}</p>
		{/if}
	</header>

	<!-- Links -->
	<section class="grid gap-3 sm:grid-cols-2 mb-8">
		<a
			href={data.agent.agentUrl}
			target="_blank"
			rel="noopener"
			class="nanda-card flex items-center gap-2 text-sm text-nanda-text-muted hover:text-nanda-accent transition-colors no-underline"
		>
			<Globe class="h-4 w-4 shrink-0" />
			<span class="truncate">{data.agent.agentUrl}</span>
			<ExternalLink class="h-3 w-3 shrink-0 ml-auto" />
		</a>
		{#if data.agent.apiUrl}
			<a
				href={data.agent.apiUrl}
				target="_blank"
				rel="noopener"
				class="nanda-card flex items-center gap-2 text-sm text-nanda-text-muted hover:text-nanda-accent transition-colors no-underline"
			>
				<Server class="h-4 w-4 shrink-0" />
				<span class="truncate">{data.agent.apiUrl}</span>
				<ExternalLink class="h-3 w-3 shrink-0 ml-auto" />
			</a>
		{/if}
	</section>

	<!-- Metadata Grid -->
	<section class="grid gap-3 sm:grid-cols-3 mb-8">
		<div class="nanda-card text-center">
			<p class="text-xs text-nanda-text-dim mb-1">Registered</p>
			<p class="text-sm font-medium">
				<Clock class="h-3.5 w-3.5 inline mr-1" />{fmtDate(data.agent.registeredAt)}
			</p>
		</div>
		<div class="nanda-card text-center">
			<p class="text-xs text-nanda-text-dim mb-1">Version</p>
			<p class="text-sm font-mono font-medium">{data.agent.version ?? '1.0.0'}</p>
		</div>
		<div class="nanda-card text-center">
			<p class="text-xs text-nanda-text-dim mb-1">Jurisdiction</p>
			<p class="text-sm font-medium">{data.facts?.jurisdiction ?? '—'}</p>
		</div>
	</section>

	<!-- Capabilities & Tags -->
	{#if data.agent.capabilities.length || data.agent.tags.length}
		<section class="mb-8">
			{#if data.agent.capabilities.length}
				<h2 class="text-sm font-semibold text-nanda-text-muted mb-2 flex items-center gap-1.5">
					<Award class="h-4 w-4" /> Capabilities
				</h2>
				<div class="flex flex-wrap gap-1.5 mb-4">
					{#each data.agent.capabilities as cap}
						<span class="feat-tag">{cap}</span>
					{/each}
				</div>
			{/if}
			{#if data.agent.tags.length}
				<h2 class="text-sm font-semibold text-nanda-text-muted mb-2 flex items-center gap-1.5">
					<Tag class="h-4 w-4" /> Tags
				</h2>
				<div class="flex flex-wrap gap-1.5">
					{#each data.agent.tags as tag}
						<span
							class="rounded-full bg-nanda-bg-elevated px-2.5 py-0.5 text-xs text-nanda-text-dim border border-nanda-border/50"
							>{tag}</span
						>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Certifications -->
	{#if data.certs.length}
		<section class="mb-8">
			<h2 class="text-sm font-semibold text-nanda-text-muted mb-3 flex items-center gap-1.5">
				<Shield class="h-4 w-4" /> Certifications
			</h2>
			<div class="space-y-2">
				{#each data.certs as cert}
					<div class="nanda-card flex items-center gap-3">
						<div
							class="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold shrink-0 {cert.grade ===
							'A'
								? 'bg-green-500/10 text-green-400'
								: cert.grade === 'B'
									? 'bg-blue-500/10 text-blue-400'
									: cert.grade === 'C'
										? 'bg-yellow-500/10 text-yellow-400'
										: 'bg-red-500/10 text-red-400'}"
						>
							{cert.grade}
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{cert.capability}</p>
							<p class="text-xs text-nanda-text-dim">
								Score {(cert.score * 100).toFixed(0)}%
								{#if cert.ci95Lo != null && cert.ci95Hi != null}
									<span class="text-nanda-text-dim/60"
										>(CI {(cert.ci95Lo * 100).toFixed(0)}–{(cert.ci95Hi * 100).toFixed(0)}%)</span
									>
								{/if}
								· {cert.nTrials} trials · {fmtDate(cert.issuedAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Reputation -->
	{#if data.reputation}
		<section class="mb-8">
			<h2 class="text-sm font-semibold text-nanda-text-muted mb-3 flex items-center gap-1.5">
				<Activity class="h-4 w-4" /> Latest Reputation
			</h2>
			<div class="nanda-card grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
				<div>
					<p class="text-xs text-nanda-text-dim mb-0.5">Availability</p>
					<p class="text-lg font-bold text-green-400">{fmtPct(data.reputation.availability)}</p>
				</div>
				<div>
					<p class="text-xs text-nanda-text-dim mb-0.5">Error Rate</p>
					<p
						class="text-lg font-bold {(data.reputation.errorRate ?? 0) > 0.05
							? 'text-red-400'
							: 'text-green-400'}"
					>
						{fmtPct(data.reputation.errorRate)}
					</p>
				</div>
				<div>
					<p class="text-xs text-nanda-text-dim mb-0.5">P95 Latency</p>
					<p class="text-lg font-bold text-nanda-text">
						{data.reputation.p95LatencyMs ?? '—'}<span class="text-xs text-nanda-text-dim">ms</span>
					</p>
				</div>
				<div>
					<p class="text-xs text-nanda-text-dim mb-0.5">Reputation</p>
					<p class="text-lg font-bold text-nanda-accent">
						{data.reputation.reputation != null ? data.reputation.reputation.toFixed(2) : '—'}
					</p>
				</div>
			</div>
		</section>
	{/if}

	<!-- Next Steps CTA -->
	<section class="mt-12 text-center">
		<div class="rounded-xl border border-nanda-border/40 bg-nanda-bg-elevated/50 p-8">
			<p class="text-nanda-text-muted text-sm mb-4">
				Want to register your own agent on the NANDA network?
			</p>
			<a href="/docs/quickstart" class="nanda-btn-primary inline-flex items-center gap-1.5"
				>Quickstart Guide <ArrowRight class="h-4 w-4" /></a
			>
		</div>
	</section>
</article>
