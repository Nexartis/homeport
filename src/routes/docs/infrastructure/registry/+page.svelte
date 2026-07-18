<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Agent Registry — Homeport</title>
	<meta
		name="description"
		content="Agent Registry — decentralized agent registration, discovery, search, and AgentFacts metadata. The foundational service of the NANDA network."
	/>
	<meta property="og:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
	<meta name="twitter:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
</svelte:head>

<div class="prose">
	<div class="flex items-center gap-3 mb-2 not-prose">
		<span class="text-3xl text-nanda-accent">⬡</span>
		<h1 class="text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold !mb-0">Agent Registry</h1>
		<span class="status-badge status-operational text-[11px]">operational</span>
	</div>
	<p>
		The <strong>Agent Registry</strong> is the foundational service of the NANDA network — a decentralized
		index where AI agents register their identity, endpoints, capabilities, and rich metadata. All other
		infrastructure services build on the registry as their source of truth.
	</p>

	<h2>Core Capabilities</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Agent Registration</h4>
			<p class="text-sm text-nanda-text-muted">
				Agents register with an ID, endpoint URL, capabilities array, and optional tags. Each
				registration is timestamped and stored in the D1 database with full audit history.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Discovery & Search</h4>
			<p class="text-sm text-nanda-text-muted">
				Full-text search across agent IDs, plus filtered queries by capabilities and tags. The <code
					>/search</code
				> endpoint supports composite queries for precise agent matching.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">AgentFacts v1</h4>
			<p class="text-sm text-nanda-text-muted">
				Rich metadata documents encoded as W3C Verifiable Credentials — skills, trust scores,
				compliance attestations, and input/output mode declarations.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">A2A Protocol</h4>
			<p class="text-sm text-nanda-text-muted">
				JSON-RPC protocol endpoint at <code>/a2a</code> supporting agent-to-agent communication —
				<code>agent.register</code>, <code>agent.search</code>, <code>agent.lookup</code>, and more.
			</p>
		</div>
	</div>

	<h2>API Endpoints</h2>
	<div class="grid gap-2 my-6 not-prose">
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-blue-500/20 text-blue-400"
				>POST</span
			>
			<div>
				<code class="text-sm">/register</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">
					Register a new agent with ID, URL, capabilities, and tags
				</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
				>GET</span
			>
			<div>
				<code class="text-sm">/list</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">
					List all registered agents with pagination
				</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
				>GET</span
			>
			<div>
				<code class="text-sm">/search?q=&capabilities=&tags=</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">
					Search agents by query string, capabilities, or tags
				</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
				>GET</span
			>
			<div>
				<code class="text-sm">/lookup/:id</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">Look up a specific agent by ID</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
				>GET</span
			>
			<div>
				<code class="text-sm">/agentfacts/:id</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">
					Retrieve the AgentFacts metadata document for an agent
				</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-amber-500/20 text-amber-400"
				>PUT</span
			>
			<div>
				<code class="text-sm">/agentfacts/:id</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">
					Store or update the AgentFacts document for an agent
				</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-amber-500/20 text-amber-400"
				>PUT</span
			>
			<div>
				<code class="text-sm">/agents/:id/status</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">
					Update an agent's status and capabilities
				</p>
			</div>
		</div>
		<div class="nanda-card flex items-start gap-3 !py-3">
			<span
				class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-red-500/20 text-red-400"
				>DELETE</span
			>
			<div>
				<code class="text-sm">/agents/:id</code>
				<p class="text-xs text-nanda-text-muted mt-0.5">Remove an agent from the registry</p>
			</div>
		</div>
	</div>

	<h2>Data Model</h2>
	<p>Each registered agent is stored with the following fields:</p>
	<div class="grid md:grid-cols-2 gap-3 my-6 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">agent_id</code>
			<span class="text-[11px] text-red-400">required</span>
			<p class="text-xs text-nanda-text-muted mt-1">
				Unique agent identifier (string, primary key)
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">agent_url</code>
			<span class="text-[11px] text-red-400">required</span>
			<p class="text-xs text-nanda-text-muted mt-1">Agent's primary endpoint URL</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">api_url</code>
			<span class="text-[11px] text-nanda-text-dim">optional</span>
			<p class="text-xs text-nanda-text-muted mt-1">
				Separate API endpoint URL (if different from agent_url)
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">facts_url</code>
			<span class="text-[11px] text-nanda-text-dim">optional</span>
			<p class="text-xs text-nanda-text-muted mt-1">URL to the agent's AgentFacts document</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">capabilities</code>
			<span class="text-[11px] text-nanda-text-dim">optional</span>
			<p class="text-xs text-nanda-text-muted mt-1">JSON array of capability strings</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">tags</code>
			<span class="text-[11px] text-nanda-text-dim">optional</span>
			<p class="text-xs text-nanda-text-muted mt-1">JSON array of categorization tags</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">status</code>
			<span class="text-[11px] text-nanda-text-dim">auto</span>
			<p class="text-xs text-nanda-text-muted mt-1">
				Agent lifecycle status (default: <code>alive</code>)
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">version</code>
			<span class="text-[11px] text-nanda-text-dim">auto</span>
			<p class="text-xs text-nanda-text-muted mt-1">
				Semantic version string (default: <code>1.0.0</code>)
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">source</code>
			<span class="text-[11px] text-nanda-text-dim">auto</span>
			<p class="text-xs text-nanda-text-muted mt-1">
				<code>local</code> or <code>federated</code> — set by the system
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">registered_at</code>
			<span class="text-[11px] text-nanda-text-dim">auto</span>
			<p class="text-xs text-nanda-text-muted mt-1">Unix timestamp of initial registration</p>
		</div>
	</div>
	<p class="text-sm text-nanda-text-muted">
		<strong>Note:</strong> Geographic <code>jurisdiction</code> data is stored on the
		<a href="/docs/agentfacts">AgentFacts</a> metadata document, not the agents table directly.
	</p>

	<h2>Integration with Other Services</h2>
	<p>The Agent Registry is the backbone that all other services depend on:</p>
	<ul>
		<li>
			<strong><a href="/docs/infrastructure/certifier">Capability Certifier</a></strong> — reads agent
			registrations to run certification jobs and issue W3C VCs
		</li>
		<li>
			<strong><a href="/docs/infrastructure/compliance">Compliance Enforcer</a></strong> — evaluates registered
			agents against governance policies
		</li>
		<li>
			<strong><a href="/docs/infrastructure/observer">Observer Evaluator</a></strong> — probes registered
			agents for liveness, latency, and reputation
		</li>
		<li>
			<strong><a href="/docs/infrastructure/auditor">Points Auditor</a></strong> — tracks contribution
			credits for registered agents and operators
		</li>
		<li>
			<strong><a href="/docs/federation">Federation</a></strong> — synchronizes agent registrations across
			peer NANDA nodes
		</li>
	</ul>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/api">API Reference</a> for full endpoint details ·
		<a href="/docs/agentfacts">AgentFacts</a>
		for metadata specification · <a href="/docs/quickstart">Quickstart</a> to register your first agent
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/building-agent-dns">Building Agent DNS</a> — the architecture behind the registry
		and agent discovery ·
		<a href="/blog/agentfacts">AgentFacts: The Agent Nutrition Label</a> — design rationale for agent
		metadata
	</div>
</div>
