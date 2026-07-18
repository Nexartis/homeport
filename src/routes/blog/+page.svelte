<script lang="ts">
	import { page } from '$app/state';
	import {
		Newspaper,
		ArrowRight,
		Calendar,
		Clock,
		Tag,
		BookOpen,
		FlaskConical,
		FolderKanban
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	const posts = [
		{
			href: '/blog/building-agent-dns',
			title: 'Building DNS for AI Agents: Our NANDA Index Implementation',
			desc: 'AgentAddr records, Ed25519 signing, KV-cached resolution, and AgentFacts v2 — how we built a production-grade NANDA Index node.',
			date: 'Feb 2026',
			readTime: '12 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/protocol-bridge',
			title: 'The Protocol Bridge: Making Every Agent Discoverable',
			desc: "A2A agents can't see MCP agents. The NANDA Switchboard bridges them all — register once, discoverable everywhere.",
			date: 'Feb 2026',
			readTime: '10 min',
			category: 'Ecosystem',
			categoryColor: 'text-nanda-accent bg-nanda-accent/10'
		},
		{
			href: '/blog/adaptive-resolution',
			title: 'Adaptive Resolution: Smart Routing for the Agentic Web',
			desc: 'Three strategies, one answer — multi-strategy scored resolution with geo, trust, capability match, and health awareness.',
			date: 'Feb 2026',
			readTime: '10 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/crdt-gossip',
			title: 'CRDT Gossip: How NANDA Nodes Stay in Sync',
			desc: 'LWW-Register CRDTs and gossip protocols for conflict-free registry federation — no consensus needed.',
			date: 'Feb 2026',
			readTime: '11 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/self-improving-agents',
			title: 'The Self-Improving Agent Stack',
			desc: "How Cubicube's 10 specialized agents are automatically discovered, certified, selected, and optimized — with no human in the loop.",
			date: 'Feb 2026',
			readTime: '14 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/paradigm-shift',
			title: 'From Web Pages to AI Agents: The Paradigm Shift',
			desc: 'The internet was built for documents. AI agents need something fundamentally different — and NANDA is building it.',
			date: 'Feb 2026',
			readTime: '10 min',
			category: 'Ecosystem',
			categoryColor: 'text-nanda-accent bg-nanda-accent/10'
		},
		{
			href: '/blog/why-dns-fails',
			title: 'Why DNS Fails for AI Agents',
			desc: 'DNS maps names to IP addresses. Agents need capability discovery, trust verification, and protocol negotiation — none of which DNS provides.',
			date: 'Feb 2026',
			readTime: '9 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/quilt-architecture',
			title: 'The Quilt Architecture: Decentralized Agent Discovery',
			desc: 'How NANDA federates agent registries using push-based gossip synchronization — no central authority required.',
			date: 'Feb 2026',
			readTime: '11 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/nanda-a2a-mcp',
			title: 'NANDA, A2A, and MCP: Complementary Layers of the Agentic Stack',
			desc: 'Three protocols, three problems. How NANDA Index, Google A2A, and Anthropic MCP fit together.',
			date: 'Feb 2026',
			readTime: '10 min',
			category: 'Ecosystem',
			categoryColor: 'text-nanda-accent bg-nanda-accent/10'
		},
		{
			href: '/blog/agentfacts',
			title: 'AgentFacts: Verifiable Credentials for AI Agents',
			desc: 'W3C Verifiable Credentials meet AI — how AgentFacts bring cryptographic trust to agent metadata.',
			date: 'Feb 2026',
			readTime: '8 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/privacy-dual-path',
			title: 'Privacy-Preserving Agent Discovery',
			desc: "NANDA's dual-path resolution architecture — balancing agent discoverability with privacy protection.",
			date: 'Feb 2026',
			readTime: '9 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/zero-trust-agents',
			title: 'Zero Trust for AI Agents: The ZTAA Framework',
			desc: 'Applying zero-trust principles to inter-agent communication — verify explicitly, least privilege, assume breach.',
			date: 'Feb 2026',
			readTime: '11 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/developer-api-keys',
			title: 'Developer API Keys for Decentralized Infrastructure',
			desc: 'Designing parallel API key systems across KYM and NANDA — SHA-256 hashed storage, tiered rate limits, and Bearer auth.',
			date: 'Feb 2026',
			readTime: '9 min',
			category: 'Technical',
			categoryColor: 'text-nanda-primary-400 bg-nanda-primary-500/10'
		},
		{
			href: '/blog/cross-platform-trust',
			title: 'Cross-Platform Trust Signals',
			desc: "How reputation data flows between KYM's trust registry and NANDA's discovery infrastructure for unified agent trust.",
			date: 'Feb 2026',
			readTime: '8 min',
			category: 'Ecosystem',
			categoryColor: 'text-nanda-accent bg-nanda-accent/10'
		},
		{
			href: '/blog/nest-quickstart',
			title: 'NEST Quickstart: Deploy Your First NANDA Agent',
			desc: 'A hands-on tutorial for deploying and registering agents using the NANDA Sandbox and Testbed.',
			date: 'Feb 2026',
			readTime: '7 min',
			category: 'Tutorial',
			categoryColor: 'text-nanda-success bg-nanda-success/10'
		}
	];

	let activeFilter = $state('All');
	const categories = ['All', 'Technical', 'Ecosystem', 'Tutorial'];

	const filteredPosts = $derived(
		activeFilter === 'All' ? posts : posts.filter((p) => p.category === activeFilter)
	);
</script>

<svelte:head>
	<title>Blog — Homeport</title>
	<meta
		name="description"
		content="Insights on decentralized agent discovery, trust infrastructure, and building the agentic web — from the Homeport team at Nexartis."
	/>
	<meta property="og:title" content="Blog — Homeport" />
	<meta
		property="og:description"
		content="Insights on decentralized agent discovery, trust infrastructure, and building the agentic web."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4 py-8">
	<!-- Header -->
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div
			class="mb-4 inline-flex items-center gap-2 rounded-full border border-nanda-primary-500/30 bg-nanda-primary-500/10 px-3 py-1"
		>
			<Newspaper class="h-3.5 w-3.5 text-nanda-primary-400" />
			<span class="text-xs font-medium text-nanda-primary-300">Insights & Updates</span>
		</div>

		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			The Nexartis <span class="gradient-text">Blog</span>
		</h1>

		<p class="text-lg text-nanda-text-muted leading-relaxed max-w-2xl">
			Insights on decentralized agent discovery, trust infrastructure, protocol interoperability,
			and building the open agentic web.
		</p>
	</header>

	<!-- Cross-links to related content -->
	<div
		class="flex flex-wrap gap-3 mb-8"
		in:fade={{ duration: browser ? 300 : 0, delay: browser ? 30 : 0 }}
	>
		<span class="text-xs text-nanda-text-dim self-center">More content:</span>
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
		<a
			href="/case-studies"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<FolderKanban class="h-3 w-3" />
			Case Studies
		</a>
	</div>

	<!-- Filters -->
	<div
		class="flex items-center gap-2 mb-8 pb-6 border-b border-nanda-border/40"
		role="tablist"
		aria-label="Filter posts by category"
		in:fade={{ duration: browser ? 300 : 0, delay: browser ? 50 : 0 }}
	>
		{#each categories as cat}
			<button
				role="tab"
				aria-selected={activeFilter === cat}
				onclick={() => (activeFilter = cat)}
				class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors {activeFilter === cat
					? 'bg-nanda-primary text-white'
					: 'bg-nanda-bg-elevated text-nanda-text-dim hover:text-nanda-text-muted'}"
			>
				{cat}
			</button>
		{/each}
	</div>

	<!-- Posts -->
	<div
		class="space-y-4"
		in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
	>
		{#each filteredPosts as post}
			<a
				href={post.href}
				class="nanda-card block hover:border-nanda-accent/50 transition-colors group"
			>
				<div class="flex items-start gap-4">
					<div class="flex-1">
						<div class="flex flex-wrap items-center gap-2 mb-2">
							<span
								class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium {post.categoryColor}"
							>
								<Tag class="h-2.5 w-2.5" />
								{post.category}
							</span>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim">
								<Calendar class="h-3 w-3" />
								{post.date}
							</span>
							<span class="flex items-center gap-1 text-xs text-nanda-text-dim">
								<Clock class="h-3 w-3" />
								{post.readTime}
							</span>
						</div>
						<h3
							class="text-lg font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
						>
							{post.title}
						</h3>
						<p class="text-sm text-nanda-text-muted mt-1">{post.desc}</p>
					</div>
					<ArrowRight
						class="h-5 w-5 text-nanda-text-dim group-hover:text-nanda-accent transition-colors shrink-0 mt-1"
					/>
				</div>
			</a>
		{/each}
	</div>
</div>
