<script lang="ts">
	import { page } from '$app/state';
	import {
		Boxes,
		ArrowRight,
		Globe,
		Shield,
		Zap,
		Network,
		Server,
		Lock,
		Newspaper,
		FlaskConical,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Case Studies — Homeport</title>
	<meta
		name="description"
		content="Real-world deployments of the NANDA protocol — from Cloudflare Workers edge nodes to cross-platform agent lifecycle management."
	/>
	<meta property="og:title" content="Case Studies — Homeport" />
	<meta
		property="og:description"
		content="See how teams deploy NANDA infrastructure in production."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/case-studies" />
	<meta property="og:image" content="{page.data.registryUrl}/og/case-studies.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/case-studies.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4 py-8">
	<header class="mb-12" in:fade={{ duration: browser ? 300 : 0 }}>
		<div
			class="mb-4 inline-flex items-center gap-2 rounded-full border border-nanda-accent/30 bg-nanda-accent/10 px-3 py-1"
		>
			<Boxes class="h-3.5 w-3.5 text-nanda-accent" />
			<span class="text-xs font-medium text-nanda-accent">Case Studies</span>
		</div>

		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			Case <span class="gradient-text">Studies</span>
		</h1>

		<p class="text-lg text-nanda-text-muted leading-relaxed max-w-2xl">
			From edge-deployed registry nodes to cross-platform agent lifecycle management — see how teams
			are building on the NANDA protocol today.
		</p>
	</header>

	<!-- Cross-links -->
	<div class="flex flex-wrap gap-3 mb-8">
		<span class="text-xs text-nanda-text-dim self-center">Related content:</span>
		<a
			href="/blog"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<Newspaper class="h-3 w-3" />
			Blog
		</a>
		<a
			href="/research"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<FlaskConical class="h-3 w-3" />
			Research Papers
		</a>
		<a
			href="/series/agentic-web"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<BookOpen class="h-3 w-3" />
			The Agentic Web Series
		</a>
	</div>

	<div
		class="grid gap-6"
		in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
	>
		<!-- Homeport -->
		<a
			href="/case-studies/nexartis-nanda-node"
			class="group block rounded-xl border border-nanda-border bg-nanda-bg-elevated p-6 hover:border-nanda-primary/50 transition-all duration-200"
		>
			<div class="flex flex-col sm:flex-row sm:items-start gap-5">
				<div
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-nanda-primary/20 text-nanda-primary group-hover:bg-nanda-primary/30 transition-colors"
				>
					<Globe class="h-7 w-7" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-2">
						<h2
							class="text-xl font-semibold text-nanda-text group-hover:text-white transition-colors"
						>
							Homeport
						</h2>
						<span
							class="rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
							>Live</span
						>
					</div>
					<p class="text-sm text-nanda-text-muted leading-relaxed mb-4">
						A five-service NANDA implementation on Cloudflare Workers — global edge deployment with
						D1, KV, R2, and Secrets Store, plus a developer API key program and runtime reputation
						API.
					</p>
					<div class="flex flex-wrap gap-4 mb-4">
						<div class="flex items-center gap-1.5 text-xs text-nanda-text-dim">
							<Server class="h-3.5 w-3.5 text-nanda-primary" />
							<span>5 Services</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-nanda-text-dim">
							<Shield class="h-3.5 w-3.5 text-nanda-accent" />
							<span>3 API Key Tiers</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-nanda-text-dim">
							<Zap class="h-3.5 w-3.5 text-nanda-success" />
							<span>300+ Edge Locations</span>
						</div>
					</div>
					<div
						class="inline-flex items-center gap-1 text-sm font-medium text-nanda-primary group-hover:text-nanda-accent transition-colors"
					>
						Read Case Study <ArrowRight
							class="h-4 w-4 group-hover:translate-x-0.5 transition-transform"
						/>
					</div>
				</div>
			</div>
		</a>

		<!-- KYM + NANDA Integration -->
		<a
			href="/case-studies/kym-nanda-integration"
			class="group block rounded-xl border border-nanda-border bg-nanda-bg-elevated p-6 hover:border-nanda-primary/50 transition-all duration-200"
		>
			<div class="flex flex-col sm:flex-row sm:items-start gap-5">
				<div
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-nanda-accent/20 text-nanda-accent group-hover:bg-nanda-accent/30 transition-colors"
				>
					<Network class="h-7 w-7" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-2">
						<h2
							class="text-xl font-semibold text-nanda-text group-hover:text-white transition-colors"
						>
							KYM + NANDA Integration
						</h2>
						<span
							class="rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
							>Live</span
						>
					</div>
					<p class="text-sm text-nanda-text-muted leading-relaxed mb-4">
						End-to-end agent lifecycle across platforms — registration, certification, discovery,
						runtime trust signals, cross-platform dashboard controls, and parallel developer API key
						programs.
					</p>
					<div class="flex flex-wrap gap-4 mb-4">
						<div class="flex items-center gap-1.5 text-xs text-nanda-text-dim">
							<Lock class="h-3.5 w-3.5 text-nanda-accent" />
							<span>Ed25519 Credentials</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-nanda-text-dim">
							<Shield class="h-3.5 w-3.5 text-nanda-primary" />
							<span>Runtime Trust Signals</span>
						</div>
						<div class="flex items-center gap-1.5 text-xs text-nanda-text-dim">
							<Zap class="h-3.5 w-3.5 text-nanda-success" />
							<span>Cross-Platform Controls</span>
						</div>
					</div>
					<div
						class="inline-flex items-center gap-1 text-sm font-medium text-nanda-primary group-hover:text-nanda-accent transition-colors"
					>
						Read Case Study <ArrowRight
							class="h-4 w-4 group-hover:translate-x-0.5 transition-transform"
						/>
					</div>
				</div>
			</div>
		</a>
	</div>

	<div
		class="mt-12 text-center py-8 border-t border-nanda-border/40"
		in:fade={{ duration: browser ? 300 : 0, delay: browser ? 200 : 0 }}
	>
		<p class="text-sm text-nanda-text-muted mb-2">
			Building on NANDA? We'd love to feature your implementation.
		</p>
		<p class="text-xs text-nanda-text-dim">
			Deploying a NANDA node or integrating the protocol? <a
				href="https://github.com/projnanda"
				target="_blank"
				rel="noopener noreferrer"
				class="text-nanda-accent hover:underline">Get in touch</a
			> to share your story.
		</p>
	</div>
</div>
