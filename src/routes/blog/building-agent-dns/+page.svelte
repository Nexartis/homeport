<script lang="ts">
	import { page } from '$app/state';
	import { Globe, Calendar, Clock, Key, Layers, Route, Zap, BookOpen, Server } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Building DNS for AI Agents: Our NANDA Index Implementation | Blog — Homeport</title>
	<meta
		name="description"
		content="How we built a production-grade NANDA Index node — AgentAddr records, Ed25519 signing, KV-cached resolution, and AgentFacts v2 metadata for the agentic web."
	/>
	<meta property="og:title" content="Building DNS for AI Agents — Homeport" />
	<meta
		property="og:description"
		content="AgentAddr records, Ed25519 signing, and sub-second resolution — our implementation of DNS for AI agents."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/building-agent-dns" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-building-agent-dns.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-building-agent-dns.png" />
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
			Building DNS for AI Agents: Our NANDA Index Implementation
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			We explained <a href="/blog/why-dns-fails">why DNS fails for agents</a>. Here's what we built
			instead — a production-grade Lean Index with Ed25519-signed records, KV-cached resolution, and
			rich agent metadata.
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
		<!-- Section 1: From DNS to Agent DNS -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />From DNS to Agent DNS
			</h2>
			<p>
				DNS maps domain names to IP addresses. It's been doing this brilliantly since 1983. But as
				we explored in <a href="/blog/why-dns-fails">Why DNS Fails for AI Agents</a>, the agentic
				web needs something fundamentally different: a resolution system that carries trust,
				capabilities, and protocol metadata — not just addresses.
			</p>
			<p>
				The <a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
					>NANDA Index paper</a
				> from MIT Media Lab lays out this vision. We've now built it. Our nexartis-nanda-node is a production-grade
				NANDA Index node running on Cloudflare Workers — a three-layer resolution system that maps human-readable
				agent identifiers to cryptographically verifiable metadata and dynamically resolved endpoints.
			</p>
			<div class="callout callout-tip">
				<strong>The resolution flow.</strong>
				<code>Agent Name → NANDA Index → AgentAddr → AgentFacts → Agent Endpoint</code> — three layers,
				each purpose-built for a different concern: identity, metadata, and connection.
			</div>
		</section>

		<!-- Section 2: AgentAddr — The Lean Record -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Key class="h-5 w-5 text-nanda-accent" />AgentAddr: The Lean Record
			</h2>
			<p>
				At the core of the NANDA Index is the <strong>AgentAddr</strong> — a lightweight, signed pointer
				to an agent's metadata. Think of it as the agent equivalent of a DNS A record, but with built-in
				cryptographic verification and metadata pointers.
			</p>
			<p>
				The NANDA paper targets <strong>≤120 bytes</strong> for the core pointer fields of each
				AgentAddr record — an architectural constraint that enables efficient gossip-based
				federation (more on that in
				<a href="/blog/crdt-gossip">CRDT Gossip</a>). Lean records mean fast sync, low bandwidth,
				and edge-cacheable resolution.
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-3">AgentAddr Record Structure</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`{
  "agent_id":       "@medical-coder",
  "public_key_hex": "3b6a27bc...",       // Ed25519 verification key
  "facts_url":      "https://agent.example/agentfacts.json",
  "private_url":    "https://private.example/facts",  // optional
  "resolver_url":   "https://resolver.example/resolve", // optional
  "ttl_seconds":    300,
  "signature_hex":  "a1b2c3d4...",       // Ed25519 over canonical JSON
  "signer_id":      "did:web:your-node.example.com"
}`}</code
						></pre>
				</div>
			</div>
			<p>
				Every field serves a purpose. The <code>facts_url</code> points to the agent's full
				<a href="/blog/agentfacts">AgentFacts</a> metadata — capabilities, trust certifications,
				performance data. The <code>private_url</code> enables
				<a href="/blog/privacy-dual-path">dual-path discovery</a> where sensitive queries route
				through privacy-preserving channels. And the <code>signature_hex</code> is an Ed25519 signature
				over the canonical (sorted-key, no-whitespace) JSON serialization of the record.
			</p>
		</section>
		<!-- Section 3: AgentFacts v2 -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-primary-400" />AgentFacts v2: Rich Agent Metadata
			</h2>
			<p>
				An AgentAddr tells you <em>where</em> to find an agent's metadata. The
				<a href="/blog/agentfacts">AgentFacts</a> document tells you <em>everything else</em> — what the
				agent does, how well it performs, who vouches for it, and how to connect.
			</p>
			<p>
				Our v2 implementation upgrades AgentFacts from plain JSON to a schema-validated, JSON-LD
				document wrapped in a
				<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
					>W3C Verifiable Credential v2</a
				> envelope. This means every AgentFact is cryptographically signed, tamper-evident, and machine-verifiable
				— the same standard used for digital diplomas and professional credentials, applied to AI agents.
			</p>
			<div class="not-prose grid gap-4 my-6 sm:grid-cols-2">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-2">Capabilities & Skills</h4>
					<p class="text-xs text-nanda-text-muted">
						Structured skill declarations with input/output modes, modalities, and authentication
						requirements. Compatible with
						<a
							href="https://outshift.cisco.com/blog/outshift-mit-agentic-web"
							target="_blank"
							rel="noopener">OASF</a
						> skill taxonomies.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-2">Trust Certifications</h4>
					<p class="text-xs text-nanda-text-muted">
						Flags like <code>kid-safe</code>, <code>HIPAA</code>,
						<code>SOC2</code> — machine-readable compliance markers that enable
						<a href="/blog/zero-trust-agents">zero-trust</a> policy evaluation.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-success">
					<h4 class="font-semibold text-nanda-text mb-2">Performance Metrics</h4>
					<p class="text-xs text-nanda-text-muted">
						90-day availability, p95 latency, performance scores — real behavioral data from the
						<a href="/blog/cross-platform-trust">Observer network</a>, not self-reported claims.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-amber-400">
					<h4 class="font-semibold text-nanda-text mb-2">Content Flags</h4>
					<p class="text-xs text-nanda-text-muted">
						Descriptors like <code>financial_advice</code>, <code>medical_content</code> — enabling
						<strong>Agentic SafeSearch</strong> where orchestrators filter agents by content policy and
						jurisdiction.
					</p>
				</div>
			</div>
			<p>
				Revocation is sub-second via
				<a href="https://www.w3.org/TR/vc-bitstring-status-list/" target="_blank" rel="noopener"
					>Bitstring Status List v1.0</a
				>. When a credential is revoked — compromised key, failed audit, policy violation — the
				status list updates propagate through our KV-backed infrastructure in under one second,
				globally.
			</p>
		</section>

		<!-- Section 4: The Resolution Pipeline -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Route class="h-5 w-5 text-nanda-accent" />The Resolution Pipeline
			</h2>
			<p>
				When an orchestrator asks "find me a medical coding agent with HIPAA certification," here's
				what actually happens under the hood:
			</p>
			<ol>
				<li>
					<strong>Index lookup</strong> — The request hits our
					<code>GET /resolve/:agent_id</code> endpoint. We check the KV edge cache first (key
					format: <code>addr:&#123;agent_id&#125;</code>). On a hit, we return the cached AgentAddr
					immediately — sub-millisecond.
				</li>
				<li>
					<strong>D1 fallback</strong> — On a cache miss, we query the
					<code>agent_addrs</code> table in Cloudflare D1. The record is returned and cached for future
					requests with the TTL specified in the AgentAddr.
				</li>
				<li>
					<strong>Signature verification</strong> — The client verifies the Ed25519 signature against
					the embedded public key. If the signature doesn't match the canonical serialization, the record
					is rejected.
				</li>
				<li>
					<strong>AgentFacts fetch</strong> — The client fetches the full AgentFacts document from
					the <code>facts_url</code> (or <code>private_url</code> for privacy-sensitive queries). The
					VC envelope is verified against the signer's public key.
				</li>
				<li>
					<strong>Trust evaluation</strong> — The orchestrator evaluates trust certifications, reputation
					scores, and content flags against its policy requirements. Only agents that pass all checks
					proceed.
				</li>
				<li>
					<strong>Adaptive resolution</strong> — If the AgentAddr includes a
					<code>resolver_url</code>, the client can POST a context-aware resolution request for
					<a href="/blog/adaptive-resolution">scored, ranked endpoint selection</a> based on geography,
					load, and capability match.
				</li>
			</ol>
			<div class="callout callout-info">
				<strong>Federation transparency.</strong> If the agent isn't found locally, the resolver
				checks federated peers via the
				<a href="/blog/crdt-gossip">CRDT gossip protocol</a>. From the client's perspective, it's a
				single resolution call — the federation layer is invisible.
			</div>
		</section>

		<!-- Section 5: Performance at the Edge -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-nanda-accent" />Performance at the Edge
			</h2>
			<p>
				The entire NANDA Index runs on Cloudflare Workers — meaning resolution happens at the edge,
				in the datacenter closest to the requesting agent. Combined with KV caching, this delivers
				resolution latencies that DNS can't match for agent-level queries.
			</p>
			<div class="grid grid-cols-2 gap-4 my-6 not-prose">
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">&lt; 50ms</div>
					<div class="text-xs text-nanda-text-muted mt-1">Cached Resolution (p95)</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">&lt; 200ms</div>
					<div class="text-xs text-nanda-text-muted mt-1">Uncached Resolution (p95)</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">≤ 120 B</div>
					<div class="text-xs text-nanda-text-muted mt-1">Core Pointer Target</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">&lt; 1s</div>
					<div class="text-xs text-nanda-text-muted mt-1">Revocation Propagation</div>
				</div>
			</div>
			<p>
				The lean-pointer design of AgentAddr records is key to this performance. By separating the
				core pointer (AgentAddr) from the rich metadata (AgentFacts), we keep the hot path extremely
				fast. The index handles resolution; the agent hosts its own facts. This separation mirrors
				how DNS separates name resolution from content delivery — but with the trust and capability
				layers that agents actually need.
			</p>
			<p>
				Cache invalidation follows a cache-aside pattern: on AgentAddr update or revocation, the KV
				entry is deleted and lazily repopulated on the next read. Federation gossip updates also
				trigger cache invalidation for records received from peers, ensuring consistency across the
				mesh.
			</p>
		</section>

		<!-- Section 6: Getting Started -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-primary" />Getting Started
			</h2>
			<p>
				Registering an agent in the NANDA Index is straightforward. A single
				<code>POST /register</code> call with your agent's ID and metadata URL automatically generates
				a signed AgentAddr, stores it in D1, and caches it at the edge.
			</p>
			<p>
				For agents already using the <a
					href="https://github.com/a2aproject/A2A"
					target="_blank"
					rel="noopener">A2A</a
				>
				or <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">MCP</a>
				protocols, our <a href="/blog/protocol-bridge">Protocol Bridge</a> can auto-detect your protocol
				and translate your existing metadata into AgentFacts — no manual mapping required.
			</p>
			<p>The research foundations for this work are laid out in the MIT NANDA papers:</p>
			<ul>
				<li>
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						><em>Beyond DNS: Unlocking the Internet of AI Agents</em></a
					> — the foundational NANDA Index architecture
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03101" target="_blank" rel="noopener"
						><em>Using the NANDA Index Architecture in Practice</em></a
					> — enterprise deployment patterns and ZTAA
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03113" target="_blank" rel="noopener"
						><em>NANDA Adaptive Resolver</em></a
					> — dynamic resolution architecture
				</li>
			</ul>
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
					<a href="https://arxiv.org/abs/2601.14567" target="_blank" rel="noopener"
						><em
							>Agent Identity URI Scheme: Topology-Independent Naming and Capability-Based Discovery
							for Multi-Agent Systems</em
						></a
					> (Jan 2026) — proposes a universal agent:// URI scheme for identity
				</li>
				<li>
					<a href="https://arxiv.org/abs/2505.19301" target="_blank" rel="noopener"
						><em>A Novel Zero-Trust Identity Framework for Agentic AI</em></a
					> (May 2025) — decentralized authentication with Agent Naming Service (ANS) for capability-aware
					discovery
				</li>
				<li>
					<a href="https://arxiv.org/abs/2510.03495" target="_blank" rel="noopener"
						><em>AgentHub: A Registry for Discoverable, Verifiable, and Reproducible AI Agents</em
						></a
					> (Oct 2025) — explores production agent registry requirements
				</li>
				<li>
					<a href="https://www.w3.org/TR/did-1.0/" target="_blank" rel="noopener"
						><em>Decentralized Identifiers (DIDs) v1.0 — W3C Recommendation</em></a
					> — the DID standard that informs our identity layer
				</li>
			</ul>
		</section>

		<!-- Continue Reading -->
		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/adaptive-resolution" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Adaptive Resolution: Smart Routing
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Multi-strategy scored resolution with geo, trust, and capability matching.
					</p>
				</a>
				<a href="/blog/crdt-gossip" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						CRDT Gossip: Registry Sync
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How NANDA nodes stay in sync with conflict-free replicated data types.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
