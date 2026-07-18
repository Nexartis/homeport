<script lang="ts">
	import { page } from '$app/state';
	import {
		Network,
		Calendar,
		Clock,
		ArrowRightLeft,
		Bot,
		Wrench,
		Globe,
		BookOpen,
		Layers
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>The Protocol Bridge: Making Every Agent Discoverable | Blog — Homeport</title>
	<meta
		name="description"
		content="A2A agents can't see MCP agents. MCP agents can't see AGNTCY agents. The NANDA Switchboard bridges them all — register once, discoverable everywhere."
	/>
	<meta
		property="og:title"
		content="The Protocol Bridge: Making Every Agent Discoverable — Homeport"
	/>
	<meta
		property="og:description"
		content="How the NANDA Switchboard bridges A2A, MCP, and AGNTCY protocols for universal agent discovery."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/protocol-bridge" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-protocol-bridge.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-protocol-bridge.png" />
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
			The Protocol Bridge: Making Every Agent Discoverable
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			A2A agents can't see MCP agents. MCP agents can't see AGNTCY agents. We built a Switchboard
			that bridges them all — the first production A2A/MCP protocol adapters in the NANDA ecosystem.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Network class="h-3 w-3" /> Ecosystem</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Layers class="h-3 w-3" /> Interoperability</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<!-- Section 1: The Discovery Silo Problem -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary" />The Discovery Silo Problem
			</h2>
			<p>
				The agentic web is fragmenting before it even matures. Google's
				<a href="https://github.com/a2aproject/A2A" target="_blank" rel="noopener">A2A protocol</a>
				defines how agents communicate. Anthropic's
				<a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">MCP</a> connects
				agents to tools. Cisco's
				<a
					href="https://outshift.cisco.com/blog/outshift-mit-agentic-web"
					target="_blank"
					rel="noopener">AGNTCY</a
				>
				provides an Open Agent Schema Framework. Each is valuable. None can see the others.
			</p>
			<p>
				As we explored in
				<a href="/blog/nanda-a2a-mcp">NANDA, A2A, and MCP</a>, these protocols operate at different
				layers of the stack and are genuinely complementary. But their
				<em>discovery mechanisms</em> are siloed. An A2A agent publishes its Agent Card at
				<code>/.well-known/agent-card.json</code>. An MCP server exposes tool definitions via its
				own descriptor format. An AGNTCY agent uses OASF records. Same agents, different formats,
				invisible to each other.
			</p>
			<div class="callout callout-warn">
				<strong>The cost of silos.</strong> If your orchestrator only understands A2A, it can't discover
				MCP-based tools. If it only queries AGNTCY, it misses A2A agents entirely. Every protocol boundary
				is an invisible wall around a subset of the agent economy.
			</div>
		</section>

		<!-- Section 2: The Switchboard Architecture -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<ArrowRightLeft class="h-5 w-5 text-nanda-accent" />The Switchboard Architecture
			</h2>
			<p>
				The Switchboard is our answer to protocol fragmentation. It's a set of protocol adapters
				that translate between native agent metadata formats and NANDA's unified
				<a href="/blog/agentfacts">AgentFacts</a> representation. Each adapter implements a common interface:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-3">RegistryAdapter Interface</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`interface RegistryAdapter {
  registryId: string;
  queryAgent(agentId: string): Promise<AgentRecord | null>;
  translateToNanda(sourceData: unknown): AgentFactsV2;
  translateFromNanda(facts: AgentFactsV2): unknown;
  getRegistryInfo(): AdapterInfo;
}`}</code
						></pre>
				</div>
			</div>
			<p>
				This is a bidirectional bridge. <code>translateToNanda()</code> imports agent metadata from
				any protocol into the NANDA format. <code>translateFromNanda()</code> exports NANDA AgentFacts
				back to the source format. An A2A agent can be discovered by an MCP client, and vice versa — the
				Switchboard handles the translation transparently.
			</p>
		</section>
		<!-- Section 3: Bridging A2A Agent Cards -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Bot class="h-5 w-5 text-nanda-primary-400" />Bridging A2A Agent Cards
			</h2>
			<p>
				Google's A2A protocol defines an
				<a href="https://a2a-protocol.org/latest/specification/" target="_blank" rel="noopener"
					>Agent Card</a
				>
				— a JSON document at <code>/.well-known/agent-card.json</code> that describes an agent's capabilities,
				supported interfaces, and skills. Our A2A adapter maps this directly to NANDA AgentFacts.
			</p>
			<div class="not-prose grid gap-4 my-6 sm:grid-cols-2">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-2 text-sm">A2A Agent Card</h4>
					<ul class="text-xs text-nanda-text-muted space-y-1">
						<li><code>name</code> → <code>agent_name</code></li>
						<li><code>skills[]</code> → <code>skills[]</code></li>
						<li><code>supportedInterfaces</code> → <code>endpoints.static</code></li>
						<li><code>capabilities.streaming</code> → <code>capabilities.streaming</code></li>
						<li><code>provider.organization</code> → <code>provider.name</code></li>
					</ul>
				</div>
				<div class="nanda-card border-l-4 border-l-nanda-accent">
					<h4 class="font-semibold text-nanda-text mb-2 text-sm">AgentFacts v2</h4>
					<ul class="text-xs text-nanda-text-muted space-y-1">
						<li>Skills with <code>inputModes</code>/<code>outputModes</code></li>
						<li>Endpoints with protocol type annotation</li>
						<li>Trust certifications and content flags</li>
						<li>Performance metrics from Observer</li>
						<li>W3C VC envelope for verification</li>
					</ul>
				</div>
			</div>
			<p>
				The mapping preserves A2A's skill structure — including per-skill input/output modes — while
				adding the trust and performance layers that A2A doesn't define. When an A2A agent is
				imported via the Switchboard, it gains discoverability through NANDA's federated index
				without any changes to the agent itself.
			</p>
		</section>

		<!-- Section 4: Bridging MCP Descriptors -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Wrench class="h-5 w-5 text-nanda-accent" />Bridging MCP Descriptors
			</h2>
			<p>
				Anthropic's MCP takes a fundamentally different approach to agent description. Where A2A
				focuses on agent-to-agent communication, MCP describes
				<strong>tools</strong> — functions with typed input schemas that AI models can call. Our MCP adapter
				translates these tool definitions into NANDA skills.
			</p>
			<p>
				The adapter probes common MCP endpoints and extracts the server descriptor — name, version,
				transport type, tool definitions, and authentication requirements. Each MCP tool becomes a
				NANDA skill:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card border-l-4 border-l-nanda-primary">
					<h4 class="font-semibold text-nanda-text mb-3">MCP Tool → NANDA Skill</h4>
					<pre
						class="text-xs text-nanda-text-muted bg-nanda-bg-elevated rounded-lg p-4 overflow-x-auto"><code
							>{`// MCP tool definition
{ name: "search_docs", description: "Search documentation", inputSchema: {...} }

// Becomes NANDA skill
{ id: "search_docs", name: "search_docs", description: "Search documentation" }`}</code
						></pre>
				</div>
			</div>
			<p>
				The reverse mapping — <code>translateFromNanda()</code> — converts AgentFacts back to an MCP
				descriptor, enabling NANDA-registered agents to be consumed by any MCP client. The transport
				defaults to <code>streamable-http</code> (the MCP standard), and authentication is set to
				<code>bearer</code> for agents that require API keys.
			</p>
		</section>

		<!-- Section 5: AGNTCY & OASF Interop -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary-400" />AGNTCY &amp; OASF Interop
			</h2>
			<p>
				Cisco's <a
					href="https://outshift.cisco.com/blog/outshift-mit-agentic-web"
					target="_blank"
					rel="noopener">AGNTCY initiative</a
				> defines the Open Agent Schema Framework (OASF) — a structured format for describing agent capabilities
				with a rich skill taxonomy. Our OASF interop layer provides bidirectional record conversion between
				OASF and NANDA AgentFacts.
			</p>
			<p>
				The <code>toOASFRecord()</code> function converts an AgentAddr into an OASF-compatible
				record, mapping NANDA fields to OASF's <code>locators</code>, <code>skills</code>, and
				<code>annotations</code> structure. The <code>fromOASFRecord()</code> function does the reverse
				— importing OASF agents into the NANDA index. Trust certifications and reputation scores are preserved
				as OASF annotations, ensuring no trust data is lost in translation.
			</p>
			<p>
				This interop work was informed by the
				<a href="https://arxiv.org/abs/2508.03095" target="_blank" rel="noopener"
					><em>Evolution of AI Agent Registry Solutions</em></a
				> paper, which provides a comparative analysis of NANDA, A2A, MCP, AGNTCY, and Microsoft Entra
				registry approaches.
			</p>
		</section>

		<!-- Section 6: Universal Agent Discovery -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Universal Agent Discovery
			</h2>
			<p>
				The Switchboard also includes a <strong>protocol auto-detection</strong> service. When a new
				agent registers with just a URL, the Switchboard probes well-known paths —
				<code>/.well-known/agent-card.json</code> for A2A, MCP endpoints for tool discovery — and automatically
				selects the right adapter. No manual configuration needed.
			</p>
			<p>
				The vision is simple: <strong>register once, discoverable everywhere.</strong> An A2A agent
				registered in Google's ecosystem becomes findable by MCP clients. An MCP tool server becomes
				queryable through NANDA's federated index. An AGNTCY agent becomes part of the global
				<a href="/blog/quilt-architecture">Registry Quilt</a>.
			</p>
			<p>
				Cross-protocol search is already live: <code
					>GET /search?capability=translation&amp;protocol=any</code
				>
				returns agents from all protocols, with results normalized to a unified format regardless of their
				source. The protocol field in AgentFacts enables filtering when you need protocol-specific results.
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
					<a href="https://a2a-protocol.org/latest/specification/" target="_blank" rel="noopener"
						><em>A2A Protocol Specification</em></a
					> — the Agent-to-Agent protocol spec (now under Linux Foundation)
				</li>
				<li>
					<a href="https://modelcontextprotocol.io" target="_blank" rel="noopener"
						><em>Model Context Protocol</em></a
					> — Anthropic's MCP for tool-server integration
				</li>
				<li>
					<a
						href="https://outshift.cisco.com/blog/outshift-mit-agentic-web"
						target="_blank"
						rel="noopener"><em>Cisco Outshift × MIT: Building the Agentic Web</em></a
					> — AGNTCY/OASF and the open agentic web vision
				</li>
				<li>
					<a href="https://arxiv.org/abs/2509.20175" target="_blank" rel="noopener"
						><em
							>Federation of Agents: A Semantics-Aware Communication Fabric for Large-Scale Agentic
							AI</em
						></a
					> (Sep 2025) — protocol-level interoperability for multi-agent systems
				</li>
				<li>
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						><em>Beyond DNS: Unlocking the Internet of AI Agents</em></a
					> — the foundational NANDA Index paper
				</li>
			</ul>
		</section>

		<!-- Continue Reading -->
		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/nanda-a2a-mcp" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						NANDA, A2A, and MCP
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The conceptual foundation — how the three protocols complement each other.
					</p>
				</a>
				<a href="/blog/building-agent-dns" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Building DNS for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The Lean Index that powers agent resolution — AgentAddr records and KV caching.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
