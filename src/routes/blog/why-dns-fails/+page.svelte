<script lang="ts">
	import { page } from '$app/state';
	import {
		Globe,
		Calendar,
		Clock,
		TriangleAlert,
		Server,
		Zap,
		Shield,
		Lock,
		Network,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Why DNS Fails for AI Agents | Blog — Homeport</title>
	<meta
		name="description"
		content="DNS maps names to IP addresses. Agents need capability discovery, trust verification, and protocol negotiation — none of which DNS provides."
	/>
	<meta property="og:title" content="Why DNS Fails for AI Agents — Homeport" />
	<meta
		property="og:description"
		content="DNS maps names to IP addresses. Agents need capability discovery, trust verification, and protocol negotiation."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/why-dns-fails" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-why-dns-fails.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-why-dns-fails.png" />
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
				><Clock class="h-4 w-4" />9 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">Why DNS Fails for AI Agents</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			DNS maps names to IP addresses. Agents need capability discovery, trust verification, and
			protocol negotiation — none of which DNS provides.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Server class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Globe class="h-3 w-3" /> Infrastructure</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />DNS: A 1983 Masterpiece
			</h2>
			<p>
				The Domain Name System is one of computing's great achievements. Designed by Paul
				Mockapetris in 1983, DNS provides a globally distributed, hierarchical namespace that maps
				human-readable domain names to machine-readable IP addresses. It's fast, resilient, and
				handles billions of queries daily.
			</p>
			<p>
				But DNS was designed for a specific purpose: locating <strong
					>servers that host documents</strong
				>. When you type <code>example.com</code>, DNS returns an IP address. Your browser connects,
				requests a page, and the transaction ends. This model has served the web brilliantly for
				four decades.
			</p>
			<p>
				The problem? <strong>AI agents aren't documents.</strong> They don't sit at fixed endpoints waiting
				for requests. They're dynamic, autonomous entities that discover peers, negotiate protocols, verify
				trust, and delegate tasks — all in real time.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<TriangleAlert class="h-5 w-5 text-amber-400" />Five Ways DNS Falls Short
			</h2>

			<h3>1. Propagation Latency</h3>
			<p>
				DNS updates propagate through a hierarchy of caches and resolvers. <a
					href="https://arxiv.org/abs/2506.12003"
					target="_blank"
					rel="noopener">Research shows</a
				> end-user visibility can stretch to 24–48 hours in worst cases, with typical propagation taking
				minutes to hours. When an agent spawns a helper agent that needs to be discoverable immediately,
				minutes are an eternity.
			</p>
			<p>
				As Professor Raskar <a
					href="https://www.linkedin.com/posts/raskar_dns-glitch-at-aws-today-for-websites-imagine-activity-7386146014220484608-MUtR"
					target="_blank"
					rel="noopener">noted during an AWS DNS outage</a
				>: "DNS glitch at AWS today for websites. Imagine if we had the same for the Internet of AI
				Agents."
			</p>

			<h3>2. No Capability Metadata</h3>
			<p>
				A DNS record tells you <em>where</em> something is — an IP address, maybe a port. It tells
				you nothing about <em>what</em> it can do. When your travel-booking agent needs to find a flight-search
				specialist that supports A2A protocol, speaks English and Japanese, and has a verified performance
				SLA, DNS has no mechanism to express or query any of this.
			</p>

			<h3>3. Trust Is Domain-Level Only</h3>
			<p>
				TLS certificates prove domain ownership — that <code>example.com</code> is controlled by
				Example Inc. But agent trust requires far more: behavioral history, capability attestations,
				compliance certifications, and cryptographic proof of code integrity. As the NANDA
				<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
					><em>Beyond DNS</em></a
				>
				paper argues, trust must be <strong>agent-level</strong>, not domain-level.
			</p>

			<h3>4. Privacy Exposure</h3>
			<p>
				Every DNS query reveals what you're looking for to network observers. When a pharmaceutical
				company's research agent queries for a genomics specialist, that search pattern itself leaks
				strategic intent. NANDA's <a href="/blog/privacy-dual-path">dual-path resolution</a> architecture
				addresses this with anonymous lookup paths through neutral third-party hosts.
			</p>

			<h3>5. Static Addressing in a Dynamic World</h3>
			<p>
				Agents migrate between runtimes, auto-scale across regions, and update capabilities
				continuously. DNS was designed for relatively static mappings — a domain name pointing to
				one or a few IP addresses. Agents need dynamic, adaptive routing that reflects their
				real-time state.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-nanda-accent" />The Scale Problem
			</h2>
			<p>
				These limitations compound at scale. Consider the numbers: DNS currently handles roughly 400
				million domain registrations globally. The Internet of AI Agents envisions <strong
					>billions to trillions</strong
				> of agents — each registering, updating capabilities, rotating endpoints, and revoking trust
				in real time.
			</p>
			<div class="grid grid-cols-2 gap-4 my-6 not-prose">
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">~400M</div>
					<div class="text-xs text-nanda-text-muted mt-1">DNS Domains Today</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">Trillions</div>
					<div class="text-xs text-nanda-text-muted mt-1">Projected AI Agents</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">Hours</div>
					<div class="text-xs text-nanda-text-muted mt-1">DNS Propagation</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">&lt; 1s</div>
					<div class="text-xs text-nanda-text-muted mt-1">Agent Discovery Target</div>
				</div>
			</div>
			<p>
				The NANDA Index addresses this with an ultra-lean record format — <strong
					>AgentAddr records of ≤120 bytes</strong
				> — that separate static identity from dynamic metadata. This architectural decision reduces write
				overhead by approximately 10,000× compared to DNS while enabling sub-second global resolution.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary-400" />What Replaces DNS for Agents?
			</h2>
			<p>
				The answer isn't to deprecate DNS — it continues to work well for its intended purpose. The
				answer is to build a <strong>complementary discovery layer</strong> purpose-built for agents,
				just as broadband infrastructure was built alongside (not instead of) the telephone network.
			</p>
			<p>
				The <a href="/docs/nanda">NANDA protocol</a> provides this layer through three interlocking systems:
			</p>
			<ul>
				<li>
					<strong>The NANDA Index</strong> — a decentralized
					<a href="/blog/quilt-architecture">"Quilt" of registries</a> providing global agent discovery
					without a single point of control
				</li>
				<li>
					<strong><a href="/blog/agentfacts">AgentFacts</a></strong> — rich, cryptographically signed
					metadata encoded as W3C Verifiable Credentials
				</li>
				<li>
					<strong>The Adaptive Resolver</strong> — a dynamic resolution layer handling real-time endpoint
					discovery, federation, caching, and failover
				</li>
			</ul>
			<div class="callout callout-tip">
				<strong>The resolution flow.</strong>
				<code>AgentName → NANDA Index → AgentAddr → AgentFacts → Agent Endpoint</code> — analogous to
				DNS resolution but with built-in trust verification, capability matching, and privacy-preserving
				lookups at every step.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Further Reading
			</h2>
			<p>
				The architectural case for moving beyond DNS is laid out in detail across several NANDA
				research papers:
			</p>
			<ul>
				<li>
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						><em
							>Beyond DNS: Unlocking the Internet of AI Agents via the NANDA Index and Verified
							AgentFacts</em
						></a
					> — the foundational NANDA paper
				</li>
				<li>
					<a href="https://arxiv.org/abs/2506.12003" target="_blank" rel="noopener"
						><em>Upgrade or Switch</em></a
					> — the architectural comparison of upgrade vs. switch paths
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03113" target="_blank" rel="noopener"
						><em>NANDA Adaptive Resolver</em></a
					> — dynamic microservice architecture for agent resolution
				</li>
			</ul>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/quilt-architecture" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						The Quilt Architecture
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How NANDA federates registries without central control.
					</p>
				</a>
				<a href="/blog/building-agent-dns" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Building DNS for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						What we built instead — AgentAddr records, Ed25519 signing, and the Lean Index.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
