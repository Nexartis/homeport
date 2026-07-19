<script lang="ts">
	import { page } from '$app/state';
	import {
		EyeOff,
		Calendar,
		Clock,
		Shield,
		Network,
		Lock,
		Route,
		Globe,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import DualPathResolver from '$lib/components/DualPathResolver.svelte';
</script>

<svelte:head>
	<title>Privacy-Preserving Agent Discovery | Blog — Homeport</title>
	<meta
		name="description"
		content="NANDA's dual-path resolution lets agents discover each other without revealing who's searching for what — essential for healthcare, finance, and competitive intelligence."
	/>
	<meta property="og:title" content="Privacy-Preserving Agent Discovery — Homeport" />
	<meta
		property="og:description"
		content="How NANDA's dual-path resolution enables anonymous agent discovery through neutral third-party hosts."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/privacy-dual-path" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-privacy-dual-path.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-privacy-dual-path.png" />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-8">
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div class="flex items-center gap-3 mb-4">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2.5 py-0.5 text-[10px] font-medium text-nanda-success"
				>Published</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Calendar class="h-4 w-4" />February 2026</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Clock class="h-4 w-4" />8 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			Privacy-Preserving Agent Discovery
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			NANDA's dual-path resolution lets agents discover each other without revealing who's searching
			for what — essential for healthcare, finance, and competitive intelligence.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><EyeOff class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Shield class="h-3 w-3" /> Privacy</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<EyeOff class="h-5 w-5 text-nanda-primary" />The Discovery Privacy Problem
			</h2>
			<p>
				Every time an agent searches for another agent, that search reveals intent. When a
				pharmaceutical company's research agent queries a registry for genomics specialists, the
				query itself leaks strategic information — what the company is working on, what capabilities
				it lacks, and where its research is heading.
			</p>
			<p>
				This isn't a theoretical concern. DNS queries have long been recognized as a privacy
				vulnerability — they're transmitted in cleartext and observable by network intermediaries.
				But for AI agents, the problem is <strong>orders of magnitude worse</strong>. Agent
				discovery queries are rich, semantically meaningful requests: "Find me an agent that can
				analyze BRCA2 gene variants, supports HIPAA-compliant data handling, and has a p95 latency
				under 100ms." That query is a business strategy document.
			</p>
			<p>
				Neither A2A nor MCP provide any privacy layer for discovery. A2A's Agent Cards sit at public <code
					>/.well-known/agent.json</code
				>
				URLs — anyone watching network traffic can see who's accessing which agent's metadata. NANDA's
				<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
					><em>Beyond DNS</em></a
				>
				paper identified this as a fundamental architectural requirement and designed a solution:
				<strong>dual-path resolution</strong>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Route class="h-5 w-5 text-nanda-accent" />How Dual-Path Resolution Works
			</h2>
			<p>Every agent registered in the NANDA Index can expose two resolution paths:</p>
			<div class="not-prose grid gap-4 my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-2 flex items-center gap-2">
						<Globe class="h-4 w-4 text-nanda-accent" />PrimaryFactsURL
					</h4>
					<p class="text-sm text-nanda-text-muted mb-2">
						Direct access to agent-hosted metadata. The requester connects to the agent's own
						infrastructure to retrieve its <a
							href="/blog/agentfacts"
							class="text-nanda-accent hover:underline">AgentFacts</a
						> document.
					</p>
					<p class="text-xs text-nanda-text-dim">
						<strong>Trade-off:</strong> Fast and complete, but the agent's operator can see who's looking.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-2 flex items-center gap-2">
						<Lock class="h-4 w-4 text-nanda-primary" />PrivateFactsURL
					</h4>
					<p class="text-sm text-nanda-text-muted mb-2">
						Anonymous access through a neutral third-party host — IPFS, decentralized storage, or a
						privacy-preserving relay. The requester retrieves metadata without the agent knowing who
						queried it.
					</p>
					<p class="text-xs text-nanda-text-dim">
						<strong>Trade-off:</strong> Private and anonymous, but may have slightly higher latency and
						a subset of metadata.
					</p>
				</div>
			</div>
			<p>
				The requesting agent (or its orchestrator) chooses which path to use based on the
				sensitivity of the interaction. Routine capability lookups can use the direct path for
				speed. Sensitive searches — competitive analysis, pre-negotiation scouting, regulatory
				investigations — use the private path.
			</p>
			<DualPathResolver />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-amber-400" />Why This Matters for Enterprises
			</h2>
			<p>
				Privacy-preserving discovery isn't just a nice-to-have — it's a <strong
					>deployment blocker</strong
				> for many enterprise use cases:
			</p>
			<ul>
				<li>
					<strong>Healthcare</strong> — A hospital's diagnostic agent searching for specialist agents
					reveals patient conditions and treatment gaps. HIPAA and GDPR require that even the search process
					protects patient data.
				</li>
				<li>
					<strong>Financial services</strong> — A trading firm's agent querying for market analysis agents
					reveals investment strategy. Competitors monitoring discovery patterns could front-run trades.
				</li>
				<li>
					<strong>Legal</strong> — A law firm's agent searching for expert witness agents reveals case
					strategy. Attorney-client privilege extends to discovery patterns.
				</li>
				<li>
					<strong>National security</strong> — Government agents searching for intelligence capabilities
					reveal operational priorities. Discovery itself is classified information.
				</li>
			</ul>
			<div class="callout callout-warn">
				<strong>The metadata is the message.</strong>
				In agent-to-agent interactions, discovery patterns are often more revealing than the actual communications.
				A protocol that encrypts messages but exposes discovery queries provides a false sense of privacy.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary-400" />Technical Architecture
			</h2>
			<p>The dual-path system is embedded in the NANDA resolution flow:</p>
			<ol>
				<li>
					<strong>Index lookup</strong> — The requesting agent queries the
					<a href="/blog/quilt-architecture">NANDA Index</a> for agents matching specific capabilities.
					The index returns AgentAddr records (~120 bytes) containing both URL paths.
				</li>
				<li>
					<strong>Path selection</strong> — The requester's policy engine selects the appropriate path
					based on data classification, regulatory requirements, or organizational policy.
				</li>
				<li>
					<strong>Metadata retrieval</strong> — Via the chosen path, the requester fetches the full AgentFacts
					document, verifies its cryptographic signature, and evaluates trust.
				</li>
				<li>
					<strong>Connection establishment</strong> — If trust criteria are met, the agents
					establish a direct communication channel via
					<a href="/blog/nanda-a2a-mcp">A2A, MCP, or HTTPS</a>.
				</li>
			</ol>
			<p>
				Critically, the <strong>index lookup itself can be anonymized</strong>. The NANDA adaptive
				resolver supports query routing through privacy relays, ensuring that even the pattern of
				index queries doesn't reveal the requester's identity or intent.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Beyond Discovery: Privacy-Aware Collaboration
			</h2>
			<p>
				Dual-path resolution is the foundation, but NANDA's privacy architecture extends further. <a
					href="https://nanda.mit.edu/"
					target="_blank"
					rel="noopener">Project NANDA's Phase 3</a
				>
				envisions <strong>privacy-aware collaboration</strong> where groups of agents can learn together
				without exposing sensitive data — using techniques like federated learning, split inference, and
				differential privacy.
			</p>
			<p>
				The dual-path architecture established in Phase 1 provides the infrastructure these advanced
				capabilities require: the ability to participate in collaborative networks without revealing
				organizational identity or operational patterns.
			</p>
			<div class="callout callout-tip">
				<strong>Further reading.</strong>
				The privacy architecture is detailed in the
				<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
					><em>Beyond DNS</em></a
				>
				paper (Section 3: Dual-Path Privacy Resolution) and the
				<a href="/series/agentic-web/agent-privacy">Agent Privacy</a> installment of our Agentic Web series.
			</div>
		</section>

		<section class="mb-12 not-prose">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				References
			</h3>
			<ul class="space-y-2 text-sm text-nanda-text-muted">
				<li>
					<a
						href="https://arxiv.org/abs/2507.14263"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline"
						>Beyond DNS: A NANDA-Based Architecture for Agentic Web Discovery</a
					>
				</li>
				<li>
					<a
						href="https://nanda.mit.edu/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">Project NANDA — MIT Media Lab</a
					>
				</li>
				<li>
					<a
						href="https://www.w3.org/TR/vc-data-model-2.0/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">W3C Verifiable Credentials Data Model v2.0</a
					>
				</li>
			</ul>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/zero-trust-agents" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Zero Trust for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						ZTAA: enterprise-grade security for autonomous agents.
					</p>
				</a>
				<a href="/blog/agentfacts" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						AgentFacts: Verifiable Credentials
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The cryptographically signed metadata that powers agent trust.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
