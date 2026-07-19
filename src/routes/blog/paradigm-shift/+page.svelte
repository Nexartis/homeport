<script lang="ts">
	import { page } from '$app/state';
	import {
		Globe,
		ArrowRight,
		Calendar,
		Clock,
		Zap,
		Server,
		Bot,
		Network,
		ChevronRight,
		Lightbulb,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>From Web Pages to AI Agents: The Paradigm Shift | Blog — Homeport</title>
	<meta
		name="description"
		content="The internet was built for documents. AI agents need something fundamentally different — and the NANDA protocol is building it."
	/>
	<meta property="og:title" content="From Web Pages to AI Agents: The Paradigm Shift — Homeport" />
	<meta
		property="og:description"
		content="The internet was built for documents. AI agents need something fundamentally different."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/paradigm-shift" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-paradigm-shift.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-paradigm-shift.png" />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-8">
	<!-- Header -->
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div class="flex items-center gap-3 mb-4">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2.5 py-0.5 text-[10px] font-medium text-nanda-success"
				>Published</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim">
				<Calendar class="h-4 w-4" />
				February 2026
			</span>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim">
				<Clock class="h-4 w-4" />
				10 min read
			</span>
		</div>

		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			From Web Pages to AI Agents: The Paradigm Shift
		</h1>

		<p class="text-lg text-nanda-text-muted leading-relaxed">
			The internet was built for documents. AI agents need something fundamentally different — and
			the NANDA protocol is building it.
		</p>

		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
			>
				<Globe class="h-3 w-3" /> Ecosystem
			</span>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
			>
				<Lightbulb class="h-3 w-3" /> Thought Leadership
			</span>
		</div>
	</header>

	<!-- Content -->
	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />The Web We Built vs. The Web We Need
			</h2>
			<p>
				The World Wide Web was a triumph of simplicity. Tim Berners-Lee's original vision —
				hyperlinked documents served over HTTP — scaled from a physics lab at CERN to billions of
				pages in under two decades. DNS mapped human-readable names to IP addresses, TLS
				certificates authenticated servers, and the browser became humanity's universal interface.
			</p>
			<p>
				But in 2026, the web is undergoing a transformation as fundamental as the shift from dial-up
				to broadband. The clients are no longer just humans with browsers — they are <strong
					>autonomous AI agents</strong
				>
				that discover peers, negotiate tasks, delegate sub-goals, and maintain persistent memory across
				sessions. As MIT's Ramesh Raskar and the
				<a href="https://nanda.mit.edu/" target="_blank" rel="noopener">Project NANDA</a>
				team argue in their foundational paper
				<a href="https://arxiv.org/abs/2506.12003" target="_blank" rel="noopener"
					><em>Upgrade or Switch</em></a
				>, the question is no longer whether the web's infrastructure needs to change — it's how
				radically.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Server class="h-5 w-5 text-nanda-accent" />Three Eras of Web Architecture
			</h2>
			<p>
				To understand why agents break the web, trace the evolution through three architectural
				eras:
			</p>
			<div class="grid gap-4 my-6 not-prose">
				<div class="nanda-card">
					<div class="flex items-start gap-4">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-nanda-primary-500/10"
						>
							<Globe class="h-5 w-5 text-nanda-primary-400" />
						</div>
						<div>
							<h3 class="font-semibold text-nanda-text mb-1">Era 1 — Static Web (1990s)</h3>
							<p class="text-sm text-nanda-text-muted">
								HTML files, CSS, images. Client fetches a URL, server returns bytes, conversation
								ends. Stateless, immutable, human-initiated.
							</p>
						</div>
					</div>
				</div>
				<div class="nanda-card">
					<div class="flex items-start gap-4">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-nanda-accent/10"
						>
							<Server class="h-5 w-5 text-nanda-accent" />
						</div>
						<div>
							<h3 class="font-semibold text-nanda-text mb-1">
								Era 2 — APIs & Services (2000s–2010s)
							</h3>
							<p class="text-sm text-nanda-text-muted">
								REST, GraphQL, serverless functions. Machines became first-class clients — but still
								reactive, stateless, and endpoint-bound.
							</p>
						</div>
					</div>
				</div>
				<div class="nanda-card">
					<div class="flex items-start gap-4">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"
						>
							<Bot class="h-5 w-5 text-amber-400" />
						</div>
						<div>
							<h3 class="font-semibold text-nanda-text mb-1">Era 3 — Autonomous Agents (2024+)</h3>
							<p class="text-sm text-nanda-text-muted">
								Goal-directed, persistent, proactive. Agents pursue objectives, maintain memory,
								delegate sub-tasks, and spawn helper agents — without constant human direction.
							</p>
						</div>
					</div>
				</div>
			</div>
			<p>
				The leap from Era 2 to Era 3 is not incremental. As the <em>Upgrade or Switch</em> research
				demonstrates, agents introduce three new thresholds that no existing web infrastructure was
				designed to handle: <strong>self-directed discovery</strong> at millisecond latency,
				<strong>delegated authority with instant revocation</strong>, and
				<strong>cryptographic proof of behavior</strong>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-amber-400" />The Dial-Up Lesson
			</h2>
			<p>
				The NANDA research team draws a clarifying analogy: the transition from dial-up to
				broadband. When the internet was first commercialized, existing telephone infrastructure
				seemed like a natural fit — it already connected most homes. But dial-up's 56 kbps ceiling
				and circuit-switched architecture couldn't support the always-on, bandwidth-intensive
				applications that the internet would demand.
			</p>
			<p>
				Engineers didn't try to make phone lines faster forever. They designed <strong
					>purpose-built last-mile infrastructure</strong
				> — DSL, cable, fiber — that accommodated known requirements while leaving room for unknown future
				needs. The open TCP/IP substrate they built allowed applications like video streaming, social
				media, and cloud computing to flourish in ways no one predicted.
			</p>
			<div class="callout callout-info">
				<strong>The parallel is exact.</strong>
				DNS, TLS certificates, and WHOIS were designed for human-initiated, document-oriented traffic.
				They work brilliantly for that purpose. But trying to stretch them to support billions of autonomous
				agents making sub-second discovery and trust decisions is the equivalent of running Netflix over
				a 56k modem.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary" />What Agents Actually Need
			</h2>
			<p>
				The <em>Upgrade or Switch</em> paper identifies five categories where existing web infrastructure
				falls short for autonomous agents:
			</p>
			<ol>
				<li>
					<strong>Sub-second discovery</strong> — DNS propagation takes minutes to hours. Agents spawning
					helper agents need discovery in milliseconds.
				</li>
				<li>
					<strong>Capability-based trust</strong> — TLS certificates prove domain ownership, not agent
					capabilities. An agent delegating a financial task needs to verify that the recipient can actually
					execute trades, holds proper credentials, and has a clean behavioral history.
				</li>
				<li>
					<strong>Privacy-preserving lookups</strong> — DNS queries expose access patterns to network
					observers. When a healthcare agent searches for a specialist, that search pattern itself is
					sensitive.
				</li>
				<li>
					<strong>Dynamic routing</strong> — Agents migrate between runtimes, scale across regions, and
					update capabilities continuously. Static DNS records can't keep up.
				</li>
				<li>
					<strong>Instant revocation</strong> — CRL/OCSP mechanisms can't handle real-time trust revocation
					at trillion-agent scale. When a delegated agent misbehaves, its privileges must be revoked in
					milliseconds, not hours.
				</li>
			</ol>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Bot class="h-5 w-5 text-nanda-accent" />NANDA: Purpose-Built Infrastructure
			</h2>
			<p>
				This is the problem that <a href="https://nanda.mit.edu/" target="_blank" rel="noopener"
					>Project NANDA</a
				>
				(Networked AI Agents in Decentralized Architecture) was created to solve. Rather than stretching
				1983-era DNS or bolting agent metadata onto WHOIS records, NANDA provides a
				<strong>purpose-built discovery, trust, and routing layer</strong> for the agentic web.
			</p>
			<p>The architecture centers on three components:</p>
			<ul>
				<li>
					<strong><a href="/blog/quilt-architecture">The NANDA Index</a></strong> — a decentralized agent
					registry using the "Quilt" federation model, where multiple registries operate independently
					while maintaining global interoperability. Records are ultra-lean (≤120 bytes) for efficient
					global-scale indexing.
				</li>
				<li>
					<strong><a href="/blog/agentfacts">AgentFacts</a></strong> — W3C Verifiable Credentials that
					serve as cryptographically signed "resumes" for agents, containing capabilities, endpoints,
					trust scores, and compliance attestations.
				</li>
				<li>
					<strong>Protocol Bridges</strong> — cross-platform interoperability connecting
					<a href="/blog/nanda-a2a-mcp">A2A, MCP, and HTTPS</a> endpoints so agents built on any protocol
					can discover and work with agents on any other.
				</li>
			</ul>
			<p>
				As <a
					href="https://www.forbes.com/sites/johnwerner/2025/04/29/theyre-making-tcpip-for-ai-and-its-called-nanda/"
					target="_blank"
					rel="noopener">Forbes described it</a
				>: "They're making TCP/IP for AI, and it's called NANDA."
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-primary-400" />The Road Ahead
			</h2>
			<p>
				The transition to an Internet of AI Agents won't happen overnight. Like the move from
				dial-up to broadband, it will likely follow a hybrid path — existing DNS infrastructure for
				human-facing services, purpose-built NANDA infrastructure for agent-to-agent interactions,
				with bridge protocols enabling interoperability between the two.
			</p>
			<p>
				Project NANDA's three-phase roadmap reflects this reality: <strong>Phase 1</strong> builds
				the foundational discovery and identity layer (the NANDA Index), <strong>Phase 2</strong>
				introduces economic primitives for agentic commerce, and <strong>Phase 3</strong> enables Large
				Population Models and cross-silo collaborative learning.
			</p>
			<p>
				What's clear is that the paradigm has already shifted. The web is no longer just for
				documents and APIs — it's becoming a substrate for autonomous intelligence. The question
				isn't whether we need new infrastructure for this reality, but whether we'll build it
				deliberately or discover its absence the hard way.
			</p>
			<div class="callout callout-tip">
				<strong>Dive deeper.</strong>
				Read the full
				<a href="https://arxiv.org/abs/2506.12003" target="_blank" rel="noopener"
					><em>Upgrade or Switch</em></a
				>
				paper on arXiv, or explore the <a href="/docs/nanda">NANDA documentation</a> to understand the
				technical architecture in detail.
			</div>
		</section>

		<!-- Related reading -->
		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/why-dns-fails" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Why DNS Fails for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						A technical deep dive into DNS's architectural limitations.
					</p>
				</a>
				<a href="/series/agentic-web/new-architecture" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						The Agentic Web: A New Architecture
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Part 1 of our series on building the Internet of AI Agents.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
