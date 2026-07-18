<script lang="ts">
	import { page } from '$app/state';
	import {
		Radio,
		Calendar,
		Clock,
		Layers,
		RefreshCw,
		Network,
		BookOpen,
		Server,
		Merge
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>CRDT Gossip: How NANDA Nodes Stay in Sync | Blog — Homeport</title>
	<meta
		name="description"
		content="A decentralized agent registry needs conflict-free replication. We use LWW-Register CRDTs and gossip protocols to sync AgentAddr records across the NANDA mesh."
	/>
	<meta property="og:title" content="CRDT Gossip: How NANDA Nodes Stay in Sync — Homeport" />
	<meta
		property="og:description"
		content="LWW-Register CRDTs, gossip protocol, and Quilt routing — how NANDA Index nodes synchronize without consensus."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/crdt-gossip" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-crdt-gossip.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-crdt-gossip.png" />
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
			CRDT Gossip: How NANDA Nodes Stay in Sync
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			A decentralized agent registry can't depend on a single source of truth. We use
			Last-Writer-Wins CRDTs and gossip protocols to synchronize AgentAddr records across the NANDA
			mesh — no consensus needed.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Server class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Network class="h-3 w-3" /> Federation</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<!-- Section 1: The Sync Problem -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Radio class="h-5 w-5 text-nanda-primary" />The Sync Problem
			</h2>
			<p>
				The <a href="/blog/building-agent-dns">NANDA Index</a> isn't a single centralized registry.
				As described in the
				<a href="/blog/quilt-architecture">Registry Quilt architecture</a>, it's a federation of
				independent nodes — each operated by a different organization, each authoritative for its
				own agents, but collectively forming a global discovery layer.
			</p>
			<p>
				This creates a distributed systems problem: when Nexartis registers an agent, how does MIT's
				node know about it? When MIT updates an agent's metadata, how does the rest of the mesh see
				the change? Traditional solutions — Raft consensus, Paxos, primary/replica — require tight
				coordination and don't scale across independent organizations with different availability
				guarantees.
			</p>
			<div class="callout callout-info">
				<strong>Design constraint.</strong> NANDA nodes are operated by independent organizations. They
				go offline independently, restart independently, and may have network partitions between them.
				The sync protocol must handle all of this gracefully — no split-brain, no data loss, no coordination
				overhead.
			</div>
		</section>

		<!-- Section 2: LWW-Register CRDTs -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Merge class="h-5 w-5 text-nanda-accent" />LWW-Register CRDTs
			</h2>
			<p>
				<a
					href="https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type"
					target="_blank"
					rel="noopener">CRDTs</a
				> (Conflict-free Replicated Data Types) are data structures that can be replicated across multiple
				nodes and merged without coordination — mathematically guaranteed to converge to the same state.
				No consensus protocol needed.
			</p>
			<p>
				We use the <strong>Last-Writer-Wins Register</strong> (LWW-Register) variant. Each AgentAddr record
				carries a timestamp, and when two nodes have conflicting values for the same agent, the one with
				the later timestamp wins. Simple, deterministic, and partition-tolerant.
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-3">LWW-Register Merge</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`function merge(local: CrdtEntry, remote: CrdtEntry): CrdtEntry {
  // Later timestamp always wins
  if (remote.timestamp > local.timestamp) return remote;
  // Tie-break: higher agent_id wins (deterministic)
  if (remote.timestamp === local.timestamp
      && remote.agent_id > local.agent_id) return remote;
  return local;
}`}</code
						></pre>
				</div>
			</div>
			<p>
				The tie-breaking rule (higher <code>agent_id</code> wins on equal timestamps) ensures that even
				in the pathological case of simultaneous writes, all nodes converge to the same value. The merge
				function is commutative, associative, and idempotent — the three properties that make CRDTs work.
			</p>
			<p>
				This is a perfect fit for AgentAddr records: they're small (≤120 bytes), each agent has
				exactly one authoritative owner, and the most recent registration is always the correct one.
				More complex CRDT types (G-Counter, OR-Set) would add unnecessary complexity for this use
				case.
			</p>
		</section>
		<!-- Section 3: The Gossip Protocol -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<RefreshCw class="h-5 w-5 text-nanda-primary-400" />The Gossip Protocol
			</h2>
			<p>
				CRDTs tell us <em>how</em> to merge. The gossip protocol tells us <em>when</em> to exchange data.
				Our gossip implementation follows an anti-entropy model: periodically, each node selects a peer
				and exchanges its recent changes.
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-3">Gossip Round</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`// Every gossip interval (default: 60 seconds per peer)
1. Select random peer from known peer list
2. Compute delta: records changed since last sync with this peer
3. Send delta to peer via POST /federation/gossip
4. Receive peer's delta in response
5. Merge received records using LWW-Register merge
6. Update local state (stale KV cache entries expire via TTL)`}</code
						></pre>
				</div>
			</div>
			<p>
				The gossip interval balances freshness against bandwidth. With a 60-second per-peer rate
				limit, a new registration propagates to all nodes within a few rounds — typically under 5
				minutes for a mesh of 10 nodes. Reducing the interval improves freshness at the cost of more
				network traffic. The interval is configurable per-node.
			</p>
			<p>
				Each gossip message includes the sender's <code>node_id</code>, a vector clock for
				consistency tracking, and the batch of changed CRDT entries. The receiver merges each entry
				using the LWW-Register merge function, updating its local D1 store for any entries where the
				remote value wins.
			</p>
		</section>

		<!-- Section 4: Federation & the Registry Quilt -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-accent" />Federation &amp; the Registry Quilt
			</h2>
			<p>
				The gossip protocol is the engine that powers the
				<a href="/blog/quilt-architecture">Registry Quilt</a> — our model for federated agent discovery
				where each node is a "patch" that stitches together with peers to form a seamless global registry.
			</p>
			<p>
				Federation adds an authentication layer on top of gossip. Each peer-to-peer connection is
				authenticated using the <code>NANDA_FEDERATION_ADMIN_KEY</code> shared secret via
				<code>Authorization: Bearer</code> headers. This prevents unauthorized nodes from injecting records
				into the mesh while keeping the protocol simple — no PKI infrastructure needed for the initial
				deployment.
			</p>
			<p>
				When a gossip merge updates a local record, the resolver's KV cache is immediately
				invalidated for that agent. This means a query that arrives after a gossip update will get
				fresh data from D1, which is then cached in KV. The result: eventual consistency with a
				convergence window of <strong>gossip_interval + cache_TTL</strong> in the worst case.
			</p>
			<div class="not-prose grid gap-4 my-6 sm:grid-cols-3">
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">&lt; 2 min</div>
					<div class="text-xs text-nanda-text-muted mt-1">Propagation Time (10 nodes)</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">60s</div>
					<div class="text-xs text-nanda-text-muted mt-1">Push Interval Per Peer</div>
				</div>
				<div class="nanda-card text-center">
					<div class="text-2xl font-bold gradient-text">0</div>
					<div class="text-xs text-nanda-text-muted mt-1">Coordination Overhead</div>
				</div>
			</div>
		</section>

		<!-- Section 5: Quilt Routing & SafeSearch -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary" />Quilt Routing &amp; SafeSearch
			</h2>
			<p>
				The Quilt architecture doesn't just replicate data — it routes queries intelligently. When a
				node receives a resolution request for an agent it doesn't hold locally, it checks its peer
				registry. If a peer is known to be authoritative for that agent's namespace, the query is
				forwarded to that peer and the result is cached locally.
			</p>
			<p>
				This routing layer also enables <strong>Agentic SafeSearch</strong>. Each AgentFacts
				document includes content flags (<code>financial_advice</code>,
				<code>medical_content</code>, <code>adult_content</code>) that flow through the gossip mesh.
				Orchestrators can filter discovery results by content policy — a children's education
				platform can request only <code>kid-safe</code> agents, and the NANDA Index enforces this at the
				resolution layer.
			</p>
			<p>
				SafeSearch isn't just a tag filter. It integrates with NANDA's
				<a href="/blog/zero-trust-agents">Zero-Trust Agent Architecture</a> (ZTAA) — content flags are
				part of the verifiable credential chain, meaning they're cryptographically attested, not self-declared.
				A node can reject agents whose content flags fail verification, adding a trust layer to content
				filtering that traditional safe search can't provide.
			</p>
		</section>

		<!-- Section 6: Why Not Consensus? -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Why Not Consensus?
			</h2>
			<p>
				A natural question: why CRDTs instead of Raft or Paxos? The answer is operational
				independence. NANDA nodes are operated by <em>different organizations</em>. MIT, Nexartis,
				enterprise customers — each runs their own node with their own availability SLAs. A
				consensus protocol would require a majority of nodes to be online for any write to succeed.
				CRDTs let each node operate independently, accepting writes locally and syncing
				asynchronously.
			</p>
			<p>
				The tradeoff is eventual consistency rather than strong consistency. For agent discovery,
				this is the right tradeoff. An agent that was registered 60 seconds ago but hasn't
				propagated to all nodes yet is a minor inconvenience. An agent registry that goes down
				because half the nodes are offline is a catastrophic failure. CRDTs choose availability over
				consistency — exactly what the CAP theorem says we must choose for a partition-tolerant
				distributed system.
			</p>
			<p>
				For the formal foundations, see
				<a href="https://inria.hal.science/inria-00609399v1/document" target="_blank" rel="noopener"
					>Shapiro et al.'s original CRDT paper</a
				>
				and the NANDA Index paper's discussion of
				<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
					>federation consistency models</a
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
					<a
						href="https://inria.hal.science/inria-00609399v1/document"
						target="_blank"
						rel="noopener"><em>Conflict-Free Replicated Data Types</em></a
					> (Shapiro et al., 2011) — the foundational CRDT paper
				</li>
				<li>
					<a href="https://arxiv.org/abs/2508.03095" target="_blank" rel="noopener"
						><em>Evolution of AI Agent Registry Solutions</em></a
					> (Aug 2025) — registry federation models and consistency tradeoffs
				</li>
				<li>
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						><em>Beyond DNS: Unlocking the Internet of AI Agents</em></a
					> — Section 4 covers federation consistency requirements
				</li>
				<li>
					<a href="https://arxiv.org/abs/2504.21034" target="_blank" rel="noopener"
						><em>SAGA: A Security Architecture for Governing AI Agentic Systems</em></a
					> (Apr 2025) — security models for decentralized agent systems
				</li>
			</ul>
		</section>

		<!-- Continue Reading -->
		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/quilt-architecture" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Registry Quilt Architecture
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The federation model — how independent registry nodes form a unified discovery layer.
					</p>
				</a>
				<a href="/blog/building-agent-dns" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Building DNS for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The Lean Index — AgentAddr records and the resolution pipeline that gossip syncs.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
