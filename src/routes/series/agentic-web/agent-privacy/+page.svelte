<script lang="ts">
	import { page } from '$app/state';
	import {
		EyeOff,
		Calendar,
		Clock,
		Shield,
		Lock,
		Route,
		Globe,
		BookOpen,
		Layers,
		Database
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import DualPathResolver from '$lib/components/DualPathResolver.svelte';
</script>

<svelte:head>
	<title>Agent Privacy — Discovery Without Exposure | The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="How NANDA's dual-path resolution, lean index records, and privacy-preserving relays let agents discover capabilities without revealing intent — critical for healthcare, finance, and national security."
	/>
	<meta
		property="og:title"
		content="Part 4: Agent Privacy — Discovery Without Exposure — Homeport"
	/>
	<meta
		property="og:description"
		content="Privacy-preserving agent discovery through dual-path resolution and data minimisation."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/series/agentic-web/agent-privacy" />
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/series-agentic-web-agent-privacy.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/series-agentic-web-agent-privacy.png"
	/>
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
				><Clock class="h-4 w-4" />11 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			Agent Privacy — Discovery Without Exposure
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			In agent-to-agent interactions, the search itself is the sensitive data. Who you look for,
			when you look, and what capabilities you need — these reveal strategy, intent, and
			vulnerability. NANDA treats discovery privacy as a first-class architectural requirement, not
			an afterthought.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><BookOpen class="h-3 w-3" /> Series: The Agentic Web</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Layers class="h-3 w-3" /> Part 4 of 6</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<EyeOff class="h-5 w-5 text-nanda-accent" />The Metadata Problem
			</h2>
			<p>
				Intelligence agencies have a saying: <em>the metadata is the message</em>. The same
				principle applies to agent discovery. When a pharmaceutical company's research agent queries
				a registry for genomics specialists with HIPAA-compliant data handling, the query itself
				reveals what the company is working on, what capabilities it lacks, and where its research
				is headed.
			</p>
			<p>
				Neither <a href="/blog/nanda-a2a-mcp">A2A nor MCP</a> provide any privacy layer for
				discovery. A2A Agent Cards sit at public <code>/.well-known/agent.json</code> URLs — anyone monitoring
				network traffic sees who accesses which agent's metadata. MCP relies on direct server connections
				with no anonymisation. Even DNS-over-HTTPS, which encrypts query content, still exposes access
				patterns through traffic analysis.
			</p>
			<p>
				The <a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener noreferrer"
					><em>Beyond DNS</em></a
				> paper identified privacy-preserving resolution as a foundational requirement for the agentic
				web — not a feature, but a design constraint that shapes every layer of the architecture.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Route class="h-5 w-5 text-nanda-primary" />Dual-Path Resolution
			</h2>
			<p>
				NANDA's answer is <strong>dual-path resolution</strong>: every agent in the Index exposes
				two routes to its <a href="/blog/agentfacts">AgentFacts</a> metadata, and the requester chooses
				which to use.
			</p>
			<div class="not-prose grid gap-4 my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-2 flex items-center gap-2">
						<Globe class="h-4 w-4 text-nanda-accent" />PrimaryFactsURL — Direct Path
					</h4>
					<p class="text-sm text-nanda-text-muted mb-1">
						The requester fetches metadata directly from the agent's own infrastructure. Fast,
						complete, and fresh — but the agent's operator can observe who's looking and when.
					</p>
					<p class="text-xs text-nanda-text-dim">
						<strong>Best for:</strong> routine capability lookups, public service discovery, non-sensitive
						workflows.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-2 flex items-center gap-2">
						<Lock class="h-4 w-4 text-nanda-primary" />PrivateFactsURL — Anonymous Path
					</h4>
					<p class="text-sm text-nanda-text-muted mb-1">
						The requester retrieves metadata from a neutral third-party host — IPFS, decentralised
						storage, or a privacy-preserving relay. The agent never learns who queried it.
					</p>
					<p class="text-xs text-nanda-text-dim">
						<strong>Best for:</strong> competitive intelligence, pre-negotiation scouting, regulatory
						investigations, healthcare and financial workflows.
					</p>
				</div>
			</div>
			<p>
				The choice between paths is made by the requester's <strong>policy engine</strong> — not hardcoded.
				An enterprise can enforce that all healthcare-related discovery uses the private path, while internal
				tooling uses the direct path for speed. This per-query privacy control has no equivalent in DNS,
				A2A, or MCP.
			</p>
			<DualPathResolver />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Database class="h-5 w-5 text-nanda-accent" />The Lean Index: Privacy by Architecture
			</h2>
			<p>
				Dual-path resolution protects the metadata retrieval step. But what about the index lookup
				itself? Here, NANDA's <strong>lean index design</strong> provides structural privacy guarantees.
			</p>
			<p>
				Each record in the NANDA Index is capped at <strong>≤120 bytes</strong> — just an agent ID, metadata
				URL pointers, TTL values, and a cryptographic signature. No capabilities, no skills, no performance
				metrics, no provider details. This means:
			</p>
			<ul>
				<li>
					<strong>Index queries reveal minimal intent.</strong> Looking up an agent ID doesn't tell
					an observer <em>why</em> you're looking or what capabilities you need.
				</li>
				<li>
					<strong>Index operators can't profile users.</strong> Even a compromised or adversarial index
					node sees only opaque lookups, not semantically rich queries.
				</li>
				<li>
					<strong>Write operations are 10,000× lighter.</strong> By keeping rich metadata in AgentFacts
					(hosted externally), the index avoids becoming a honeypot of sensitive agent information.
				</li>
			</ul>
			<p>
				This separation — lean index for <em>where</em>, AgentFacts for <em>what</em> — is a
				deliberate privacy architecture. It applies the principle of
				<a href="https://gdpr-info.eu/art-5-gdpr/" target="_blank" rel="noopener noreferrer"
					>data minimisation</a
				> from GDPR Article 5 at the protocol level: the index stores no more than is necessary for its
				routing function.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary" />Privacy Under Threat
			</h2>
			<p>
				Privacy-preserving discovery matters most in adversarial environments. Consider four
				scenarios where discovery patterns are high-value intelligence:
			</p>
			<ol>
				<li>
					<strong>Healthcare.</strong> A hospital agent searching for oncology specialists reveals
					patient conditions. Under HIPAA and GDPR, even the <em>search process</em> must protect patient
					data.
				</li>
				<li>
					<strong>Financial services.</strong> A trading firm's agent querying for market analysis agents
					reveals investment strategy. Competitors monitoring discovery could front-run trades.
				</li>
				<li>
					<strong>Legal.</strong> A law firm searching for expert-witness agents reveals case strategy.
					Attorney-client privilege must extend to discovery patterns.
				</li>
				<li>
					<strong>National security.</strong> Government agents searching for intelligence capabilities
					reveal operational priorities. The discovery metadata itself is classified.
				</li>
			</ol>
			<div class="callout callout-warn">
				<strong
					>A protocol that encrypts messages but exposes discovery queries provides a false sense of
					privacy.</strong
				> In agent-to-agent interactions, discovery patterns are often more revealing than the communications
				themselves. NANDA treats both with equal architectural seriousness.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-accent" />Beyond Discovery: Privacy-Aware Collaboration
			</h2>
			<p>
				Dual-path resolution is the foundation, but NANDA's privacy architecture extends into <a
					href="https://nanda.mit.edu/"
					target="_blank"
					rel="noopener noreferrer">Project NANDA's Phase 3</a
				>
				vision: <strong>privacy-aware collaboration</strong> where groups of agents learn together without
				exposing sensitive data. Techniques like federated learning, split inference, and differential
				privacy require the kind of private discovery channels that the dual-path architecture provides.
			</p>
			<p>
				The lean index, PrivateFactsURL, and policy-driven path selection together create a privacy
				stack that aligns with the <a
					href="https://artificialintelligenceact.eu/"
					target="_blank"
					rel="noopener noreferrer">EU AI Act</a
				>'s transparency requirements and GDPR's data minimisation principles — not through legal
				compliance bolted on after the fact, but through <strong>privacy by design</strong> embedded in
				the protocol itself.
			</p>
			<p>
				In <a href="/series/agentic-web/security-blueprint">Part 5</a>, we turn from privacy to
				security — examining how Zero Trust Agentic Access (ZTAA) and Agent Visibility and Control
				(AVC) protect enterprise agent deployments from the threats that autonomous agents uniquely
				create.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/series/agentic-web/security-blueprint" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Part 5: The Security Blueprint →
					</h4>
					<p class="text-xs text-nanda-text-dim">
						ZTAA and enterprise-grade security for autonomous agents.
					</p>
				</a>
				<a href="/blog/privacy-dual-path" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Privacy-Preserving Discovery
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Technical deep dive into dual-path resolution mechanics.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
