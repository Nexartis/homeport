<script lang="ts">
	import { page } from '$app/state';
	import {
		Globe,
		ArrowRight,
		Calendar,
		Clock,
		BookOpen,
		Layers,
		KeyRound,
		Newspaper,
		FlaskConical,
		FolderKanban,
		Shield,
		Eye,
		ScrollText,
		Network
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="A six-part deep dive into the architecture, identity, trust, privacy, security, and governance of the emerging Internet of AI Agents."
	/>
	<meta property="og:title" content="The Agentic Web Series — Homeport" />
	<meta
		property="og:description"
		content="A deep dive into the infrastructure powering the next generation of the web."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/series/agentic-web" />
	<meta property="og:image" content="{page.data.registryUrl}/og/series-agentic-web.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/series-agentic-web.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4 py-8">
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div class="flex items-center gap-3 mb-4">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-nanda-primary/20 text-nanda-primary"
			>
				<Globe class="h-6 w-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold text-nanda-text sm:text-3xl">The Agentic Web</h1>
				<p class="text-sm text-nanda-text-muted">A deep dive into the Internet of AI Agents</p>
			</div>
		</div>
		<p class="text-nanda-text-muted leading-relaxed mt-4 max-w-2xl">
			The web is evolving from pages and APIs to autonomous agents that discover, negotiate, and
			transact on our behalf. This six-part series explores the foundational layers — from
			architecture and identity to trust, privacy, security, and governance — that make the agentic
			web possible.
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
			href="/case-studies"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<FolderKanban class="h-3 w-3" />
			Case Studies
		</a>
	</div>

	<section
		class="mb-12"
		in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
	>
		<h2 class="text-lg font-semibold text-nanda-text mb-6 flex items-center gap-2">
			<BookOpen class="h-5 w-5 text-nanda-accent" />
			The Series
		</h2>

		<div class="space-y-4">
			<!-- Part 1 -->
			<a
				href="/series/agentic-web/new-architecture"
				class="nanda-card block hover:border-nanda-primary/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-nanda-primary/10 shrink-0"
					>
						<Layers class="h-5 w-5 text-nanda-primary" />
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
								>Published</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Calendar class="h-3 w-3" />Feb 2026</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Clock class="h-3 w-3" />12 min read</span
							>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							Part 1: A New Architecture for a New Web
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">
							Why the Internet of AI Agents needs purpose-built infrastructure — and what Project
							NANDA is building to provide it.
						</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>

			<!-- Part 2 -->
			<a
				href="/series/agentic-web/agent-identity"
				class="nanda-card block hover:border-nanda-primary/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
					>
						<KeyRound class="h-5 w-5 text-nanda-accent" />
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
								>Published</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Calendar class="h-3 w-3" />Feb 2026</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Clock class="h-3 w-3" />10 min read</span
							>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							Part 2: Agent Identity — Beyond DNS
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">
							How AgentFacts, DIDs, and verifiable credentials give AI agents a portable,
							cryptographically provable identity.
						</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>

			<!-- Part 3 -->
			<a
				href="/series/agentic-web/trust-without-borders"
				class="nanda-card block hover:border-nanda-primary/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-nanda-primary/10 shrink-0"
					>
						<Shield class="h-5 w-5 text-nanda-primary" />
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
								>Published</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Calendar class="h-3 w-3" />Feb 2026</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Clock class="h-3 w-3" />11 min read</span
							>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							Part 3: Trust Without Borders
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">
							The Quilt architecture and federated registries — how trust scales across a
							decentralized network of autonomous agents.
						</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>

			<!-- Part 4 -->
			<a
				href="/series/agentic-web/agent-privacy"
				class="nanda-card block hover:border-nanda-primary/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
					>
						<Eye class="h-5 w-5 text-nanda-accent" />
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
								>Published</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Calendar class="h-3 w-3" />Feb 2026</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Clock class="h-3 w-3" />11 min read</span
							>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							Part 4: Agent Privacy — Discovery Without Exposure
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">
							Dual-path resolution, lean indexes, and privacy-preserving discovery in a world of
							transparent agent metadata.
						</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>

			<!-- Part 5 -->
			<a
				href="/series/agentic-web/security-blueprint"
				class="nanda-card block hover:border-nanda-primary/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 shrink-0">
						<ScrollText class="h-5 w-5 text-red-400" />
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
								>Published</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Calendar class="h-3 w-3" />Feb 2026</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Clock class="h-3 w-3" />12 min read</span
							>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							Part 5: The Security Blueprint
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">
							From Zero Trust Agentic Access to Agent Visibility and Control — the security
							architecture for autonomous agent networks.
						</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>

			<!-- Part 6 -->
			<a
				href="/series/agentic-web/governance-at-scale"
				class="nanda-card block hover:border-nanda-primary/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0"
					>
						<Network class="h-5 w-5 text-emerald-400" />
					</div>
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
								>Published</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Calendar class="h-3 w-3" />Feb 2026</span
							>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim"
								><Clock class="h-3 w-3" />11 min read</span
							>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							Part 6: Governance at Scale
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">
							Multistakeholder governance, policy frameworks, and the institutions needed to manage
							billions of autonomous agents responsibly.
						</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>
		</div>
	</section>

	<div
		class="text-center py-6 border-t border-nanda-border/40"
		in:fade={{ duration: browser ? 300 : 0, delay: browser ? 200 : 0 }}
	>
		<p class="text-sm text-nanda-text-muted">
			Based on research from <a
				href="https://nanda.mit.edu"
				target="_blank"
				rel="noopener noreferrer"
				class="text-nanda-accent hover:underline">MIT Media Lab</a
			>
			and the
			<a
				href="https://projectnanda.org"
				target="_blank"
				rel="noopener noreferrer"
				class="text-nanda-accent hover:underline">Project NANDA</a
			> consortium.
		</p>
	</div>
</div>
