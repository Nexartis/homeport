<script lang="ts">
	import { page } from '$app/state';
	import {
		Search,
		Calendar,
		Clock,
		Layers,
		Gauge,
		Settings,
		Zap,
		BookOpen,
		Server
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Adaptive Resolution: Smart Routing for the Agentic Web | Blog — Homeport</title>
	<meta
		name="description"
		content="Three strategies, one answer — how the NANDA Adaptive Resolver scores endpoints using geography, trust, capability match, and health data."
	/>
	<meta
		property="og:title"
		content="Adaptive Resolution: Smart Routing for the Agentic Web — Homeport"
	/>
	<meta
		property="og:description"
		content="Multi-strategy scored resolution with geo-proximity, trust scoring, capability matching, and health awareness."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/adaptive-resolution" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-adaptive-resolution.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-adaptive-resolution.png" />
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
				><Clock class="h-4 w-4" />10 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			Adaptive Resolution: Smart Routing for the Agentic Web
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			Simple name-to-address lookup doesn't cut it for agents. Our Adaptive Resolver runs three
			strategies — static, rotating, and adaptive — scoring endpoints on geography, trust,
			capability match, and health to return ranked results in under 200ms.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Server class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Gauge class="h-3 w-3" /> Performance</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<!-- Section 1: Beyond Simple Lookup -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Search class="h-5 w-5 text-nanda-primary" />Beyond Simple Lookup
			</h2>
			<p>
				Traditional DNS gives you one answer: an IP address. But when an orchestrator needs to find
				a translation agent, the question isn't just "where is it?" — it's "which one is best <em
					>right now</em
				>, given my location, my trust requirements, the capabilities I need, and the current load
				on each candidate?"
			</p>
			<p>
				The <a href="/blog/building-agent-dns">NANDA Index</a> provides the lookup layer — AgentAddr
				records that point to agent metadata. But the
				<strong>Adaptive Resolver</strong> adds intelligence on top of that lookup. It evaluates context,
				scores candidates, and returns a ranked list of endpoints optimized for the specific request.
			</p>
			<p>
				This architecture is based on the
				<a href="https://arxiv.org/abs/2508.03113" target="_blank" rel="noopener"
					>NANDA Adaptive Resolver paper</a
				> (Zinky, Seshadri, Lambe, Chari, Raskar) which defines dynamic resolution as a first-class concern
				— not an afterthought bolted onto a static registry.
			</p>
		</section>

		<!-- Section 2: Three Strategies, One Answer -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-accent" />Three Strategies, One Answer
			</h2>
			<p>
				The resolver selects from three resolution strategies based on the information available:
			</p>
			<div class="not-prose grid gap-4 my-6">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-1">Static Strategy</h4>
					<p class="text-xs text-nanda-text-muted">
						No context provided. Returns endpoints from AgentFacts in declared order with
						position-based scoring. Fast and deterministic — suitable for simple lookups where the
						caller trusts the agent's own endpoint ordering.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-1">Rotating Strategy</h4>
					<p class="text-xs text-nanda-text-muted">
						Agent has a <code>resolver_url</code> but no request context. Round-robin across the endpoint
						pool with health awareness — unhealthy endpoints are deprioritized (moved to the end) rather
						than removed, preserving failover capability.
					</p>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-success">
					<h4 class="font-semibold text-nanda-text mb-1">Adaptive Strategy</h4>
					<p class="text-xs text-nanda-text-muted">
						Full context evaluation via <code>POST /resolve</code>. The caller provides location,
						required capabilities, trust thresholds, latency constraints, and protocol preferences.
						The scoring engine evaluates every candidate endpoint against this context and returns
						ranked results.
					</p>
				</div>
			</div>
			<p>
				Strategy selection is automatic. A <code>GET /resolve/:agent_id</code> with no query
				parameters triggers the static strategy. Adding a context body to
				<code>POST /resolve</code> engages the adaptive engine. The caller doesn't need to know which
				strategy runs — they just get the best available answer.
			</p>
		</section>
		<!-- Section 3: The Scoring Engine -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Gauge class="h-5 w-5 text-nanda-primary-400" />The Scoring Engine
			</h2>
			<p>At the heart of the adaptive strategy is a weighted composite scoring formula:</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-3">Composite Score Formula</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`composite = (geo × 0.25) + (trust × 0.3) + (capability × 0.25) + (health × 0.2)

Where:
  geo        = Geographic proximity (0.0–1.0)
               Same country = 1.0 | Same region = 0.7 | Other = 0.3
  trust      = Normalized trust score from Observer reputation data
  capability = Intersection of required vs available capabilities
  health     = 70% success rate + 30% latency score from probe data`}</code
						></pre>
				</div>
			</div>
			<p>
				Each dimension scores 0.0 to 1.0, and the default weights prioritize trust (0.3) over
				geography and capability match (0.25 each) and health (0.2). The weights are configurable —
				an enterprise deployment might weight trust at 0.5 while a latency-sensitive application
				weights health at 0.4.
			</p>
			<p>
				Geographic scoring uses the requester's location (e.g. from Cloudflare's
				<code>cf.country</code> header, passed in the resolution context), then compares against endpoint
				locations using region groupings (North America, Europe, Asia-Pacific, etc.). Same-country gets
				a perfect score; same-region gets 0.7; cross-region gets 0.3; unknown gets a neutral 0.5.
			</p>
			<p>
				Health scoring integrates with our existing Observer service, which continuously probes
				agent endpoints and records success rates and p95 latency. The health score is a weighted
				composite: 70% success rate plus 30% latency score, where endpoints above a 5-second p95
				latency threshold score zero on the latency component.
			</p>
		</section>

		<!-- Section 4: Strategy Hints -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Settings class="h-5 w-5 text-nanda-accent" />Strategy Hints
			</h2>
			<p>
				Callers can guide resolution by providing context in the <code>POST /resolve</code> body:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-3">Resolution Context</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`{
  "requester_location": "US",
  "required_capabilities": ["document-analysis", "ocr"],
  "min_trust_score": 0.7,
  "max_latency_ms": 200,
  "protocol_preference": "a2a",
  "security_context": {
    "require_tls": true,
    "compliance_requirements": ["HIPAA"]
  }
}`}</code
						></pre>
				</div>
			</div>
			<p>
				Each hint shapes the scoring. A <code>min_trust_score</code> of 0.7 filters out agents below
				that threshold before scoring even begins. A <code>protocol_preference</code>
				boosts endpoints that match the preferred protocol. A <code>max_latency_ms</code>
				constraint deprioritizes endpoints with historically high latency.
			</p>
			<p>
				The response includes full transparency — every endpoint comes with its composite score,
				per-dimension breakdown, estimated latency, and health status:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-3">Resolution Response</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`{
  "agent_id": "@medical-coder",
  "strategy": "adaptive",
  "endpoints": [
    {
      "url": "https://us-east.agent.example/a2a",
      "protocol": "a2a",
      "score": 0.87,
      "trust_score": 0.92,
      "latency_estimate_ms": 45,
      "health_status": "healthy"
    }
  ]
}`}</code
						></pre>
				</div>
			</div>
		</section>

		<!-- Section 5: Caching at the Edge -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-nanda-accent" />Caching at the Edge
			</h2>
			<p>
				Resolution results are cached in Cloudflare KV with the TTL specified in each agent's
				AgentAddr record (default: 300 seconds). The cache key format
				<code>addr:&#123;agent_id&#125;</code> ensures fast lookups from any edge location globally.
			</p>
			<p>
				Cache invalidation is event-driven. When an AgentAddr is updated or revoked, the
				corresponding KV entry is immediately deleted. When
				<a href="/blog/crdt-gossip">gossip messages</a> arrive from federation peers with updated records,
				the cache is invalidated for those agents. This ensures that cached data is never staler than
				the AgentAddr's TTL, while gossip-triggered invalidation provides freshness guarantees for federated
				records.
			</p>
			<p>
				The architecture deliberately separates the hot path (AgentAddr lookup via KV) from the
				scoring path (adaptive resolution via D1 + Observer data). Simple lookups resolve in under
				50ms from cache. Full adaptive resolution with scoring adds latency but provides
				context-aware results — the caller chooses the tradeoff by selecting
				<code>GET</code> (fast, static) vs <code>POST</code> (scored, adaptive).
			</p>
		</section>

		<!-- Section 6: The Research Foundation -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-primary" />The Research Foundation
			</h2>
			<p>
				Our implementation draws directly from the
				<a href="https://arxiv.org/abs/2508.03113" target="_blank" rel="noopener"
					><em>NANDA Adaptive Resolver</em></a
				> paper (Zinky, Seshadri, Lambe, Chari, Raskar — arXiv:2508.03113). The paper defines the Adaptive
				Resolver as a separate microservice architecture with pluggable resolution strategies.
			</p>
			<p>
				Our implementation differs in a few practical ways: we run the resolver as part of the
				monolithic Cloudflare Worker (rather than a separate microservice) for simplicity and
				latency. We integrate Observer health data directly rather than through an external probe
				service. And our scoring weights are tuned for edge deployment where geographic proximity
				has a meaningful impact on latency.
			</p>
			<p>
				The conceptual foundation — that agent resolution is fundamentally different from DNS
				resolution and requires context-awareness — comes from the broader
				<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
					>NANDA Index paper</a
				> and its vision of "DNS for agents" as a three-layer system: lean index, rich metadata, and dynamic
				resolution.
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
					<a href="https://arxiv.org/abs/2508.03113" target="_blank" rel="noopener"
						><em>NANDA Adaptive Resolver</em></a
					> (Aug 2025) — the primary academic paper on multi-strategy resolution
				</li>
				<li>
					<a href="https://arxiv.org/abs/2507.07901" target="_blank" rel="noopener"
						><em
							>The Trust Fabric: Decentralized Interoperability and Economic Coordination for the
							Agentic Web</em
						></a
					> (Jul 2025) — trust scoring for adaptive multi-agent orchestration
				</li>
				<li>
					<a href="https://arxiv.org/abs/2511.03434" target="_blank" rel="noopener"
						><em>Inter-Agent Trust Models: A Comparative Study</em></a
					> (Nov 2025) — compares six trust models relevant to the trust scoring dimension
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03095" target="_blank" rel="noopener"
						><em>Evolution of AI Agent Registry Solutions</em></a
					> (Aug 2025) — registry architecture survey informing resolution design
				</li>
			</ul>
		</section>

		<!-- Continue Reading -->
		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/building-agent-dns" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Building DNS for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The Lean Index layer — AgentAddr records, Ed25519 signing, and KV caching.
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
