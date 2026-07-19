<script lang="ts">
	import { page } from '$app/state';
	import {
		Layers,
		Calendar,
		Clock,
		Globe,
		Zap,
		Server,
		Network,
		BookOpen,
		TriangleAlert,
		Lightbulb
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import EraTimeline from '$lib/components/EraTimeline.svelte';
</script>

<svelte:head>
	<title>A New Architecture for a New Web | The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="Why the Internet of AI Agents needs purpose-built infrastructure, what the current web stack can't provide, and how Project NANDA is architecting the solution."
	/>
	<meta property="og:title" content="Part 1: A New Architecture for a New Web — Homeport" />
	<meta
		property="og:description"
		content="Why the Internet of AI Agents needs purpose-built infrastructure and what Project NANDA is building."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/series/agentic-web/new-architecture" />
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/series-agentic-web-new-architecture.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/series-agentic-web-new-architecture.png"
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
				><Clock class="h-4 w-4" />12 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			A New Architecture for a New Web
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			The web was built for documents. Then APIs. Then serverless functions. But autonomous AI
			agents — goal-driven, long-lived, and capable of spawning sub-agents — need infrastructure
			that doesn't exist yet. This is the story of why, and what's being built to fill the gap.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><BookOpen class="h-3 w-3" /> Series: The Agentic Web</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Layers class="h-3 w-3" /> Part 1 of 6</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-accent" />The Web's Four Eras
			</h2>
			<p>
				Every decade, the web has undergone a structural shift that exposed the limits of the
				previous architecture. Understanding the pattern helps explain why the agentic transition
				isn't just another incremental upgrade — it's a category change.
			</p>
			<ol>
				<li>
					<strong>Endpoints (1990s)</strong> — Static HTML files, images, and CGI scripts. A user requests
					a page; a server returns bytes; the conversation ends.
				</li>
				<li>
					<strong>Services (2000s)</strong> — REST and GraphQL APIs turned machines into first-class clients.
					Data mutated continuously, not just on release nights.
				</li>
				<li>
					<strong>Workers (2010s)</strong> — Serverless functions, cron jobs, and RPA bots. Short-lived,
					event-driven compute — thousands spin up when a queue spikes and vanish a second later.
				</li>
				<li>
					<strong>Agents (2020s)</strong> — Autonomous, LLM-powered software entities that pursue goals,
					maintain memories, migrate between runtimes, and delegate sub-tasks to freshly spawned helpers.
				</li>
			</ol>
			<p>
				At the agent stage, three thresholds appear that no prior architecture was designed to
				cross: <strong>self-directed discovery</strong> in milliseconds,
				<strong>delegated authority with instant revocation</strong>, and
				<strong>cryptographic proof of behaviour</strong>. Trust can no longer hinge on "I control
				this domain" — counterpart agents and regulators will demand code-integrity attestations and
				tamper-evident execution logs.
			</p>
			<EraTimeline />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<TriangleAlert class="h-5 w-5 text-amber-400" />Where the Current Stack Breaks
			</h2>
			<p>
				Today's web infrastructure rests on four interlocking pillars — <strong>DNS</strong>,
				<strong>WHOIS/RDAP</strong>, <strong>IP addressing</strong>, and
				<strong>Certificate Authorities</strong> — each optimised for human-initiated, request-response
				traffic. None were designed for the demands of autonomous agent networks.
			</p>
			<div class="not-prose overflow-x-auto my-6">
				<table class="w-full text-sm border border-nanda-border/40">
					<thead>
						<tr class="bg-nanda-bg-alt/50">
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Dimension</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Static Web Page</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Cloud API / Function</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>LLM-Backed Agent</th
							>
						</tr>
					</thead>
					<tbody class="text-nanda-text-muted">
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Who initiates?</td><td
								class="px-3 py-2">Client fetches URL</td
							><td class="px-3 py-2">Client calls endpoint</td><td class="px-3 py-2"
								>Agent decides & pushes</td
							></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Lifecycle</td><td class="px-3 py-2"
								>Immutable file</td
							><td class="px-3 py-2">Ephemeral per-request</td><td class="px-3 py-2"
								>Persistent with long-term state</td
							></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Autonomy</td><td class="px-3 py-2"
								>Passive (level 0)</td
							><td class="px-3 py-2">Reactive (level 1)</td><td class="px-3 py-2"
								>Proactive (levels 2–3)</td
							></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Identity</td><td class="px-3 py-2"
								>DNS + TLS cert</td
							><td class="px-3 py-2">DNS + API keys</td><td class="px-3 py-2"
								>DIDs + capability attestation</td
							></tr
						>
						<tr
							><td class="px-3 py-2 font-medium text-nanda-text">Failure mode</td><td
								class="px-3 py-2">404 / 5xx</td
							><td class="px-3 py-2">Retry logic</td><td class="px-3 py-2"
								>Goal re-planning + trust revocation</td
							></tr
						>
					</tbody>
				</table>
			</div>
			<p>
				The gap is architectural. <a href="/blog/why-dns-fails">DNS can't propagate</a> trust
				metadata in real time. Certificate revocation lists can't handle trillion-agent scale. WHOIS
				records — mostly redacted after GDPR — are an unacceptable foundation for autonomous trust
				negotiation. And none of these systems support <strong>capability-based discovery</strong>:
				finding an agent by what it <em>does</em>, not where it <em>lives</em>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lightbulb class="h-5 w-5 text-nanda-primary" />The Dial-Up Analogy
			</h2>
			<p>
				The best precedent for the coming transition is the shift from dial-up to broadband. When
				the internet was first commercialised, telephone infrastructure seemed like a natural fit —
				it already reached most homes and businesses. But dial-up's 56 kbps ceiling,
				circuit-switched connections, and ~200 ms modem latency were fundamentally wrong for the
				always-on, packet-switched future the internet demanded.
			</p>
			<p>
				Engineers didn't patch dial-up forever. They designed last-mile upgrades — DSL, cable, then
				fibre — that offered &gt;1 Mbps downstream and sub-30 ms round-trip times while staying
				"always-on." The key insight: <strong>they prevented unknown unknowns</strong> by moving to packet-switched,
				layered networks with TCP/IP, creating a flexible foundation that could accommodate unforeseen
				applications like streaming video, real-time gaming, and eventually AI inference at the edge.
			</p>
			<p>
				The same pattern applies today. We can bolt agent-specific DNS records and faster revocation
				onto the existing stack — and we <em>will</em>, for backward compatibility. But the
				architectural requirements of agent networks (millisecond discovery, cryptographic trust
				propagation, intent-aware routing) demand purpose-built infrastructure alongside the legacy
				web, just as broadband demanded purpose-built last-mile networks alongside POTS.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />The Landscape: A2A, MCP, AGNTCY, and NANDA
			</h2>
			<p>
				2025 was a watershed year for agentic infrastructure. Three major open-source moves reshaped
				the landscape:
			</p>
			<ul>
				<li>
					<strong>A2A → Linux Foundation (June 2025)</strong> — Google
					<a
						href="https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/"
						target="_blank"
						rel="noopener noreferrer">donated the Agent-to-Agent protocol</a
					>
					to the Linux Foundation, with over 100 companies — including AWS and Cisco — now supporting
					the standard. A2A defines the <em>wire protocol</em>: JSON-RPC 2.0 semantics for how two
					agents exchange work once connected.
				</li>
				<li>
					<strong>MCP → Agentic AI Foundation (December 2025)</strong> — Anthropic
					<a
						href="https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation"
						target="_blank"
						rel="noopener noreferrer">donated the Model Context Protocol</a
					>
					to the newly formed
					<a
						href="https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation"
						target="_blank"
						rel="noopener noreferrer">Agentic AI Foundation (AAIF)</a
					>, a directed fund under the Linux Foundation. MCP standardises how agents connect to
					<em>tools and data sources</em>.
				</li>
				<li>
					<strong>AGNTCY (July 2025)</strong> — The Linux Foundation
					<a
						href="https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos"
						target="_blank"
						rel="noopener noreferrer">welcomed the AGNTCY project</a
					>, backed by Cisco, Dell, Google Cloud, Oracle, and Red Hat, to bridge A2A agents and MCP
					servers in dynamic multi-agent environments.
				</li>
			</ul>
			<p>
				These are essential building blocks. But they solve <em>communication</em> — what happens
				<strong>after</strong>
				two agents are connected. None of them answer the prior question:
				<strong>how do agents find each other in the first place?</strong>
			</p>
			<div class="callout callout-info">
				<strong>The city analogy.</strong>
				If A2A is the language agents speak on the streets, and MCP is how they use the tools in their
				offices, then Project NANDA builds the city itself — the address system, the trust infrastructure,
				the economic plumbing, and the governance framework that makes everything work at scale.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-nanda-primary" />What NANDA Provides
			</h2>
			<p>
				<a href="https://nanda.mit.edu" target="_blank" rel="noopener noreferrer">Project NANDA</a>
				(Networked AI Agents in Decentralized Architecture), led by
				<a
					href="https://www.media.mit.edu/people/raskar/overview/"
					target="_blank"
					rel="noopener noreferrer">Prof. Ramesh Raskar</a
				>
				at MIT Media Lab, is purpose-built to dismantle the four critical choke points in today's web
				infrastructure as it relates to agents: <strong>DNS</strong>,
				<strong>Certificate Authorities</strong>, <strong>Orchestration</strong>, and
				<strong>Attestation</strong>.
			</p>
			<p>The project proceeds in three stages:</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-3">
				<div class="nanda-card">
					<h4 class="text-xs font-semibold text-nanda-primary uppercase tracking-wider mb-2">
						Phase 1 — Current
					</h4>
					<h3 class="text-sm font-bold text-nanda-text mb-1">Foundations of the Agentic Web</h3>
					<p class="text-xs text-nanda-text-muted">
						NANDA Index for agent discovery. Cross-platform protocol bridges (A2A, MCP, HTTPS). SDKs
						for agent onboarding.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="text-xs font-semibold text-nanda-text-dim uppercase tracking-wider mb-2">
						Phase 2 — Next
					</h4>
					<h3 class="text-sm font-bold text-nanda-text mb-1">Agentic Commerce</h3>
					<p class="text-xs text-nanda-text-muted">
						Knowledge pricing. Edge AI integration. Economic protocols and resource markets for
						agent services.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="text-xs font-semibold text-nanda-text-dim uppercase tracking-wider mb-2">
						Phase 3 — Vision
					</h4>
					<h3 class="text-sm font-bold text-nanda-text mb-1">Society of Agents</h3>
					<p class="text-xs text-nanda-text-muted">
						Large Population Models (LPMs). Privacy-preserving co-learning. Cross-silo coordination
						and distributed AI.
					</p>
				</div>
			</div>
			<p>
				Crucially, NANDA is <strong>protocol-neutral</strong>. A NANDA-indexed agent can expose an
				A2A endpoint, an MCP server, a plain HTTPS API, or all three. The
				<a href="/blog/nanda-a2a-mcp">NANDA Adapter</a> handles protocol translation automatically — an
				MCP assistant can discover and communicate with an A2A inventory agent through NANDA's universal
				handshake system.
			</p>
			<p>
				As Google's Rao Surapaneni, VP, Google Cloud, <a
					href="https://github.com/projnanda/projnanda/blob/main/faq_nanda_a2a.md"
					target="_blank"
					rel="noopener noreferrer">noted</a
				>:
				<em
					>"We're proud to support Project NANDA's work as they utilise the Agent2Agent protocol for
					their advanced research on the internet of agents."</em
				>
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Server class="h-5 w-5 text-nanda-accent" />The Road Ahead
			</h2>
			<p>
				The <a
					href="https://www.eecs.mit.edu/academics/iap-offerings/iap-2026/"
					target="_blank"
					rel="noopener noreferrer">MIT IAP 2026 course (6.S192)</a
				>
				— "Agentic Web: Networked AI Agents and Decentralized AI (NANDA)" — is training the next generation
				of engineers on this infrastructure.
				<a
					href="https://www.forbes.com/sites/johnwerner/2025/04/29/theyre-making-tcpip-for-ai-and-its-called-nanda/"
					target="_blank"
					rel="noopener noreferrer">Forbes called it</a
				> "TCP/IP for AI." The comparison is apt: just as TCP/IP provided the universal transport layer
				that let the internet accommodate applications no one had imagined, NANDA provides the universal
				discovery-and-trust layer for agent applications that don't exist yet.
			</p>
			<p>This series explores each layer of that architecture in depth:</p>
			<ul>
				<li>
					<a href="/series/agentic-web/agent-identity">Part 2</a> covers
					<strong>Agent Identity</strong> — AgentFacts, DIDs, and verifiable credentials
				</li>
				<li>
					<a href="/series/agentic-web/trust-without-borders">Part 3</a> covers
					<strong>Trust Without Borders</strong> — the Quilt architecture and federated registries
				</li>
				<li>
					<a href="/series/agentic-web/agent-privacy">Part 4</a> covers
					<strong>Agent Privacy</strong> — dual-path resolution and lean indexes
				</li>
				<li>
					<a href="/series/agentic-web/security-blueprint">Part 5</a> covers the
					<strong>Security Blueprint</strong> — Zero Trust Agentic Access and Agent Visibility
				</li>
				<li>
					<a href="/series/agentic-web/governance-at-scale">Part 6</a> covers
					<strong>Governance at Scale</strong> — multistakeholder frameworks for billions of agents
				</li>
			</ul>
			<p>
				The Internet of AI Agents isn't coming. It's here. The question is whether we build its
				infrastructure with the same intentionality that the original internet's architects brought
				to TCP/IP — or patch dial-up until it breaks.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/series/agentic-web/agent-identity" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Part 2: Agent Identity — Beyond DNS →
					</h4>
					<p class="text-xs text-nanda-text-dim">
						AgentFacts, DIDs, and verifiable credentials for the agentic web.
					</p>
				</a>
				<a href="/blog/paradigm-shift" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						From Web Pages to AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The paradigm shift from documents to autonomous agents.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
