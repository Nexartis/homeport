<script lang="ts">
	import { page } from '$app/state';
	import {
		Layers,
		Calendar,
		Clock,
		Network,
		ArrowRightLeft,
		Globe,
		Shield,
		MessageSquare,
		BookOpen,
		Quote
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import ProtocolStack from '$lib/components/ProtocolStack.svelte';
</script>

<svelte:head>
	<title>NANDA, A2A, and MCP: Complementary Layers of the Agentic Stack | Blog — Homeport</title>
	<meta
		name="description"
		content="Google's A2A defines how agents talk. Anthropic's MCP connects agents to tools. NANDA's Index helps agents find and trust each other. Here's how they fit together."
	/>
	<meta property="og:title" content="NANDA, A2A, and MCP: Complementary Layers — Homeport" />
	<meta
		property="og:description"
		content="Google's A2A, Anthropic's MCP, and the NANDA Index are complementary layers of the emerging agentic stack."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/nanda-a2a-mcp" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-nanda-a2a-mcp.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-nanda-a2a-mcp.png" />
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
				><Clock class="h-4 w-4" />12 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			NANDA, A2A, and MCP: Complementary Layers of the Agentic Stack
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			Google's A2A defines how agents talk. Anthropic's MCP connects agents to tools. NANDA's Index
			helps agents find and trust each other. Here's how they fit together.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Layers class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><ArrowRightLeft class="h-3 w-3" /> Ecosystem</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary" />Three Protocols, One Stack
			</h2>
			<p>
				The agentic AI ecosystem has coalesced around three foundational protocols, each solving a
				distinct problem. Understanding their roles — and their boundaries — is essential for anyone
				building or deploying AI agents at scale.
			</p>
			<ul>
				<li>
					<strong>Model Context Protocol (MCP)</strong> — Created by
					<a
						href="https://www.anthropic.com/news/model-context-protocol"
						target="_blank"
						rel="noopener">Anthropic in November 2024</a
					>
					and
					<a
						href="https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation"
						target="_blank"
						rel="noopener">donated to the Agentic AI Foundation</a
					>
					(Linux Foundation) in December 2025. MCP standardizes how AI models connect to external tools,
					data sources, and services. Think of it as a <strong>USB-C port for AI</strong> — a universal
					interface between a model and its environment.
				</li>
				<li>
					<strong>Agent-to-Agent Protocol (A2A)</strong> —
					<a
						href="https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/"
						target="_blank"
						rel="noopener">Created by Google in April 2025</a
					>
					and donated to the Linux Foundation in June 2025. A2A provides the standardized wire protocol
					— JSON-RPC 2.0 with Server-Sent Events — for two agents to communicate, negotiate tasks, and
					stream results. It's the <strong>language agents speak</strong> to collaborate.
				</li>
				<li>
					<strong>NANDA Index</strong> — Developed by
					<a href="https://nanda.mit.edu/" target="_blank" rel="noopener"
						>MIT Media Lab's Project NANDA</a
					>. The NANDA Index provides decentralized agent discovery, identity verification, and
					trust infrastructure. It's the <strong>address book and trust registry</strong> that helps agents
					find each other and decide who to work with.
				</li>
			</ul>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-accent" />The Stack: Semantics vs. Syntax
			</h2>
			<p>
				The most clarifying way to understand the relationship between these protocols is through
				the <strong>semantics versus syntax</strong> distinction:
			</p>
			<div class="not-prose grid gap-4 my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-2">Syntax Layer — A2A & MCP</h4>
					<p class="text-sm text-nanda-text-muted">
						Provides the structural framework: message formats, JSON-RPC protocols, tool interfaces,
						and technical specifications for data exchange. Answers: <em
							>"How do agents exchange information?"</em
						>
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-2">Semantics Layer — NANDA Index</h4>
					<p class="text-sm text-nanda-text-muted">
						Focuses on meaning, context, and intent: agent identity, capability discovery, trust
						verification, and privacy-preserving resolution. Answers: <em
							>"How do agents find and trust each other?"</em
						>
					</p>
				</div>
			</div>
			<p>
				This isn't a hierarchy — both layers are essential. A2A and MCP provide immediate developer
				tools, code libraries, and security frameworks for building agent communication. NANDA
				drives the longer-term research into decentralized discovery, <a
					href="/blog/privacy-dual-path">privacy-preserving lookups</a
				>, and <a href="/blog/quilt-architecture">federated index architectures</a>.
			</p>
			<ProtocolStack />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<ArrowRightLeft class="h-5 w-5 text-nanda-primary-400" />Feature Comparison
			</h2>
			<p>The differences become concrete when you compare capabilities side by side:</p>
			<div class="overflow-x-auto my-6 not-prose">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-nanda-border">
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">Feature</th>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">NANDA Index</th>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">A2A</th>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">MCP</th>
						</tr>
					</thead>
					<tbody class="text-nanda-text-muted">
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-medium text-nanda-text">Focus</td><td class="py-2.5 px-4"
								>Discovery & trust</td
							><td class="py-2.5 px-4">Agent communication</td><td class="py-2.5 px-4"
								>Tool & data access</td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-medium text-nanda-text">Discovery</td><td
								class="py-2.5 px-4">Decentralized Quilt index</td
							><td class="py-2.5 px-4">Agent Cards at well-known URLs</td><td class="py-2.5 px-4"
								>Server-side tool registration</td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-medium text-nanda-text">Protocol</td><td
								class="py-2.5 px-4">Bridges A2A, MCP, HTTPS, gRPC</td
							><td class="py-2.5 px-4">JSON-RPC 2.0 + SSE</td><td class="py-2.5 px-4"
								>JSON-RPC over stdio/HTTP</td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-medium text-nanda-text">Identity</td><td
								class="py-2.5 px-4">Signed AgentAddr + VCs</td
							><td class="py-2.5 px-4">HTTPS + OAuth/mTLS</td><td class="py-2.5 px-4"
								>Server authentication</td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-medium text-nanda-text">Privacy</td><td
								class="py-2.5 px-4">Dual-path resolution</td
							><td class="py-2.5 px-4">No privacy layer</td><td class="py-2.5 px-4"
								>No privacy layer</td
							></tr
						>
						<tr
							><td class="py-2.5 px-4 font-medium text-nanda-text">Governance</td><td
								class="py-2.5 px-4">MIT Media Lab</td
							><td class="py-2.5 px-4">Linux Foundation</td><td class="py-2.5 px-4"
								>Agentic AI Foundation (LF)</td
							></tr
						>
					</tbody>
				</table>
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<MessageSquare class="h-5 w-5 text-nanda-accent" />The City Analogy
			</h2>
			<p>The NANDA team uses a city analogy that makes the relationship intuitive:</p>
			<ul>
				<li>
					<strong>MCP</strong> is the <strong>plumbing and electrical wiring</strong> — it connects AI
					models to the tools, databases, and services they need to function. Without MCP, agents can't
					access the resources that make them useful.
				</li>
				<li>
					<strong>A2A</strong> is the <strong>road network</strong> — it provides the streets and traffic
					rules that agents use to communicate with each other. Without A2A, agents speak incompatible
					dialects.
				</li>
				<li>
					<strong>NANDA</strong> is the <strong>entire city infrastructure</strong> — the address
					system, the business directory, the trust registry, the licensing authority. Without
					NANDA, agents can communicate but can't <em>find</em> each other, and have no way to verify
					who they're talking to.
				</li>
			</ul>
			<p>
				Each layer is essential. An agent that can talk (A2A) and access tools (MCP) but can't be
				discovered or trusted is like a business with a phone and a warehouse but no address, no
				license, and no listing in the directory.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />Governance &amp; Convergence
			</h2>
			<p>
				A significant development in the agentic ecosystem has been the convergence of governance.
				A2A and MCP now operate under the Linux Foundation umbrella, while NANDA remains governed by
				MIT Media Lab:
			</p>
			<ul>
				<li>
					<strong>A2A</strong> was donated by Google to the Linux Foundation in
					<a
						href="https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents"
						target="_blank"
						rel="noopener">June 2025</a
					>, with founding members including Cisco, Salesforce, Intuit, and Atlassian.
				</li>
				<li>
					<strong>MCP</strong> was donated by Anthropic to the
					<a
						href="https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation"
						target="_blank"
						rel="noopener">Agentic AI Foundation</a
					> (a directed fund under the Linux Foundation) in December 2025.
				</li>
				<li>
					<strong>NANDA</strong> has engaged with A2A stakeholders including Google, Cisco, and
					Salesforce from its inception, and the NANDA team has
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						>published research</a
					> specifically designed for compatibility with both A2A and MCP.
				</li>
			</ul>
			<p>
				This governance convergence is not accidental. The Linux Foundation recognized early that
				fragmented agent infrastructure would slow adoption, and has actively worked to bring
				complementary protocols under a shared governance umbrella. Cisco's <a
					href="https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos"
					target="_blank"
					rel="noopener">AGNTCY project</a
				> (July 2025) further bridges these efforts by making A2A agents and MCP servers discoverable
				through shared agent directories.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-amber-400" />What NANDA Adds That A2A and MCP Don't
			</h2>
			<p>
				A2A explicitly describes several concerns as "ancillary" that the NANDA Index treats as
				essential infrastructure:
			</p>
			<ul>
				<li>
					<strong>Global agent discovery</strong> — A2A's Agent Cards sit at
					<code>/.well-known/agent.json</code>
					on individual domains. There's no global index. The
					<a href="/blog/quilt-architecture">NANDA Quilt</a> provides decentralized discovery across the
					entire ecosystem.
				</li>
				<li>
					<strong>Identity and credentials</strong> — A2A relies on standard HTTPS and optional
					OAuth/mTLS. NANDA provides cryptographically signed
					<a href="/blog/agentfacts">AgentFacts</a> with W3C Verifiable Credentials, enabling fine-grained
					capability attestations.
				</li>
				<li>
					<strong>Economic primitives</strong> — NANDA's Phase 2 roadmap includes knowledge pricing, resource
					markets, and payment protocols for agentic commerce — capabilities neither A2A nor MCP address.
				</li>
				<li>
					<strong>Reputation and trust</strong> — Beyond authentication, NANDA tracks behavioral history
					and trust scores, enabling agents to make informed delegation decisions.
				</li>
				<li>
					<strong>Privacy-preserving lookups</strong> — NANDA's
					<a href="/blog/privacy-dual-path">dual-path resolution</a> enables anonymous agent discovery
					through neutral third-party hosts — critical for sensitive industries like healthcare and finance.
				</li>
			</ul>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 700 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Quote class="h-5 w-5 text-nanda-primary-400" />From the A2A Team
			</h2>
			<blockquote>
				<p>
					"We're proud to support Project Nanda's work as they utilize the Agent2Agent protocol for
					their advanced research on the internet of agents. Our goal with A2A is to empower
					businesses, consumers, and researchers with an open standard that enables the innovation
					needed to solve complex challenges that are beyond the scope of any single agent."
				</p>
			</blockquote>
			<p class="text-sm text-nanda-text-dim"><strong>— Rao Surapaneni</strong>, VP, Google Cloud</p>
			<p>
				This endorsement underscores the complementary nature of the relationship: Google's A2A team
				explicitly recognizes that NANDA's discovery and trust infrastructure extends the reach of
				A2A into problems that A2A wasn't designed to solve.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 800 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Building With the Full Stack
			</h2>
			<p>
				For developers and organizations deploying AI agents today, the practical implications are
				clear:
			</p>
			<ol>
				<li>
					<strong>Use MCP</strong> to connect your agents to tools, databases, and external services
				</li>
				<li><strong>Use A2A</strong> to enable agent-to-agent communication and task delegation</li>
				<li>
					<strong>Use the NANDA Index</strong> to make your agents globally discoverable, verifiable,
					and trustworthy
				</li>
			</ol>
			<p>
				The NANDA Adapter bridges all three, enabling cross-protocol interoperability so agents
				built on any protocol can discover and work with agents on any other. An MCP assistant can
				discover an A2A inventory agent through the NANDA Index and communicate seamlessly through
				the NANDA Adapter.
			</p>
			<div class="callout callout-tip">
				<strong>Get started.</strong>
				Deploy your first NANDA-discoverable agent with our
				<a href="/blog/nest-quickstart">NEST Quickstart tutorial</a>, or read how
				<a href="/case-studies/nexartis-nanda-node">Nexartis deployed a NANDA node</a> on Cloudflare Workers.
			</div>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/agentfacts" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						AgentFacts: Verifiable Credentials for AI
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How W3C VCs power agent trust metadata in the NANDA ecosystem.
					</p>
				</a>
				<a href="/blog/protocol-bridge" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						The Protocol Bridge
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Making A2A, MCP, and AGNTCY agents universally discoverable.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
