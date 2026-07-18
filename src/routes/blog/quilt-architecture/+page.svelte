<script lang="ts">
	import { page } from '$app/state';
	import {
		Layers,
		Calendar,
		Clock,
		Network,
		Shield,
		Building2,
		Lock,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import QuiltTopology from '$lib/components/QuiltTopology.svelte';
</script>

<svelte:head>
	<title>The Quilt Architecture: Decentralized Agent Discovery | Blog — Homeport</title>
	<meta
		name="description"
		content="How NANDA federates agent registries using push-based gossip synchronization — no central authority required."
	/>
	<meta property="og:title" content="The Quilt Architecture — Homeport" />
	<meta
		property="og:description"
		content="How NANDA federates agent registries using push-based gossip synchronization."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/quilt-architecture" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-quilt-architecture.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-quilt-architecture.png" />
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
			The Quilt Architecture: Decentralized Agent Discovery
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			How NANDA federates agent registries using push-based gossip synchronization — no central
			authority required.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Layers class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Network class="h-3 w-3" /> Architecture</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary" />The Centralization Trap
			</h2>
			<p>
				Every discovery system faces the same fundamental tension: centralize for simplicity, or
				decentralize for resilience. DNS chose a pragmatic middle ground — a hierarchical tree with
				root servers at the top and delegated zones below. It works, but it concentrates power in
				ICANN, registrars, and a handful of root server operators.
			</p>
			<p>
				For AI agents, centralization creates unacceptable risks. A single registry controlling
				agent discovery becomes a <strong>chokepoint for the entire agentic ecosystem</strong> —
				enabling gatekeeping, censorship, rent-seeking, and single-point-of-failure outages. When
				Professor Raskar's team at
				<a href="https://nanda.mit.edu/" target="_blank" rel="noopener">MIT Media Lab</a> designed the
				NANDA Index, they needed an architecture that was both globally coherent and fundamentally decentralized.
			</p>
			<p>Their answer: <strong>the Quilt</strong>.</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-accent" />How the Quilt Works
			</h2>
			<p>
				The Quilt architecture treats the NANDA Index not as a single database but as a <strong
					>patchwork of independent registries</strong
				> — each operating autonomously while participating in a shared discovery fabric. Like patches
				in a quilt, each registry is self-contained but stitched together through standardized federation
				protocols.
			</p>
			<p>The key design principles:</p>
			<ul>
				<li>
					<strong>Push-based gossip</strong> — registries push delta updates to peers rather than relying
					on a central coordinator, eliminating single points of failure
				</li>
				<li>
					<strong>Namespace autonomy</strong> — each registry controls its own namespace and registration
					policies
				</li>
				<li>
					<strong>Cross-registry resolution</strong> — any agent can be discovered from any registry through
					federated lookups
				</li>
				<li>
					<strong>Cryptographic integrity</strong> — all records are signed, preventing tampering during
					federation
				</li>
			</ul>
			<QuiltTopology />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Building2 class="h-5 w-5 text-nanda-primary-400" />Registry Types in the Quilt
			</h2>
			<p>
				The Quilt accommodates diverse organizational models, each representing a different "patch"
				in the fabric:
			</p>
			<div class="overflow-x-auto my-6 not-prose">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-nanda-border">
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">Registration Type</th>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">Example</th>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">Control Model</th>
						</tr>
					</thead>
					<tbody class="text-nanda-text-muted">
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4"><span class="feat-tag">NANDA Native</span></td><td
								class="py-2.5 px-4 font-mono text-sm">@agentx</td
							><td class="py-2.5 px-4">Direct registration in NANDA</td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4"><span class="feat-tag">Government</span></td><td
								class="py-2.5 px-4 font-mono text-sm">@US:shop</td
							><td class="py-2.5 px-4">Location-specific sovereign domains</td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4"><span class="feat-tag">Enterprise (Routed)</span></td><td
								class="py-2.5 px-4 font-mono text-sm">@company</td
							><td class="py-2.5 px-4">Access only through company registry</td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4"><span class="feat-tag">Enterprise (Direct)</span></td><td
								class="py-2.5 px-4 font-mono text-sm">@company:shop</td
							><td class="py-2.5 px-4">Visible on NANDA, company-administered</td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4"><span class="feat-tag">Web3 (Routed)</span></td><td
								class="py-2.5 px-4 font-mono text-sm">@DID:company</td
							><td class="py-2.5 px-4">Access through Web3 marketplace</td></tr
						>
						<tr
							><td class="py-2.5 px-4"><span class="feat-tag">Web3 (Direct)</span></td><td
								class="py-2.5 px-4 font-mono text-sm">@DID:company:agent</td
							><td class="py-2.5 px-4">DID-authenticated, NANDA-visible</td></tr
						>
					</tbody>
				</table>
			</div>
			<p>
				This flexibility means governments can maintain sovereign control over agent registrations
				within their jurisdictions, enterprises can keep internal agents private while still
				participating in global discovery, and Web3 projects can integrate decentralized identity
				natively.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-amber-400" />Why Not a Blockchain?
			</h2>
			<p>
				A natural question: why not use a blockchain for decentralized agent discovery? The NANDA
				team considered this and rejected it for several reasons:
			</p>
			<ul>
				<li>
					<strong>Latency</strong> — blockchain consensus takes seconds to minutes. Agent discovery needs
					sub-second resolution.
				</li>
				<li>
					<strong>Throughput</strong> — even high-performance blockchains handle thousands of transactions
					per second. The agentic web needs millions of lookups per second.
				</li>
				<li>
					<strong>Cost</strong> — gas fees or staking requirements create barriers to participation, especially
					for lightweight agents.
				</li>
				<li>
					<strong>Privacy</strong> — public blockchains expose all transactions. Agent discovery patterns
					are often sensitive.
				</li>
			</ul>
			<p>
				The Quilt achieves decentralization through <strong>cryptographic federation</strong> rather than
				consensus — registries sign their records with Ed25519 keys, and peers verify signatures without
				needing global agreement on state. This provides the trust guarantees of decentralization without
				the performance penalties of blockchain.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-nanda-accent" />The Lean Index Advantage
			</h2>
			<p>
				At the heart of the Quilt is the NANDA Index's <strong>lean record format</strong>. Each
				AgentAddr record targets approximately 120 bytes of core pointer data, containing only:
			</p>
			<ul>
				<li>Agent ID and human-readable name</li>
				<li>URLs pointing to detailed AgentFacts metadata</li>
				<li>Time-to-live (TTL) values</li>
				<li>Cryptographic signatures</li>
			</ul>
			<p>
				All detailed metadata — capabilities, endpoints, credentials, performance metrics — lives in <a
					href="/blog/agentfacts">AgentFacts documents</a
				>
				that can be updated independently without touching the index. This separation reduces index write
				overhead by approximately <strong>10,000×</strong> compared to DNS, making global federation practical
				even at trillion-agent scale.
			</p>
			<div class="callout callout-info">
				<strong>The N×N problem, solved.</strong>
				Without a shared discovery mechanism, every agent needs direct connections to all others — an
				N×N problem. The Quilt transforms this into a simpler 2N problem: each agent registers once and
				is discoverable by all through federated lookups.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-primary" />Building on the Quilt
			</h2>
			<p>
				The Quilt architecture is already operational in the NANDA testnet, with Nexartis running
				one of the early production nodes on Cloudflare Workers. The architecture supports:
			</p>
			<ul>
				<li>
					<strong>Cross-protocol discovery</strong> — agents registered via A2A, MCP, or HTTPS endpoints
					are all discoverable through the same index
				</li>
				<li>
					<strong>Geographic federation</strong> — registries can serve specific regions while participating
					in global lookups
				</li>
				<li>
					<strong>Enterprise isolation</strong> — companies can run private registries that selectively
					expose agents to the public Quilt
				</li>
			</ul>
			<p>
				For a hands-on introduction to deploying agents on the NANDA network, see our <a
					href="/blog/nest-quickstart">NEST Quickstart tutorial</a
				>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Further Reading
			</h2>
			<ul>
				<li>
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						><em>Beyond DNS: Unlocking the Internet of AI Agents</em></a
					> — the foundational NANDA Index paper describing the Quilt federation model
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03095" target="_blank" rel="noopener"
						><em>Evolution of AI Agent Registry Solutions</em></a
					> (Aug 2025) — comparative analysis of registry architectures including federated models
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03101" target="_blank" rel="noopener"
						><em>Using the NANDA Index Architecture in Practice</em></a
					> — enterprise deployment patterns for federated registries
				</li>
				<li>
					<a
						href="https://inria.hal.science/inria-00609399v1/document"
						target="_blank"
						rel="noopener"><em>Conflict-Free Replicated Data Types</em></a
					> (Shapiro et al., 2011) — the CRDT foundations powering Quilt synchronization
				</li>
			</ul>
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
						W3C VCs meet AI agents — cryptographic trust metadata.
					</p>
				</a>
				<a href="/blog/crdt-gossip" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						CRDT Gossip: Registry Sync
					</h4>
					<p class="text-xs text-nanda-text-dim">
						LWW-Register CRDTs and gossip protocols powering the Quilt's sync layer.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
