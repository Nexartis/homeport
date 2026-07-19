<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Resolution &amp; Discovery — Homeport</title>
	<meta
		name="description"
		content="Lean Index AgentAddr records, adaptive multi-strategy resolution with composite scoring, SafeSearch filtering, and Switchboard protocol bridging."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-resolver.png" />
</svelte:head>

<div class="prose">
	<h1>Resolution &amp; Discovery</h1>
	<p>
		NANDA provides a <strong>DNS-like resolution</strong> system for agents. The Lean Index maps agent
		IDs to signed endpoint records (AgentAddr), while the adaptive resolver selects the best endpoint
		using multi-strategy scoring. SafeSearch filters results by trust and compliance, and the Switchboard
		bridges across protocols.
	</p>

	<h2>Lean Index &amp; AgentAddr</h2>
	<p>
		Every registered agent gets an <strong>AgentAddr</strong> record — an Ed25519-signed, KV-cached record
		containing the agent's endpoint URLs, TTL, and cryptographic provenance.
	</p>

	<h3>AgentAddr Record Fields</h3>
	<table>
		<thead><tr><th>Field</th><th>Description</th></tr></thead>
		<tbody>
			<tr><td><code>agent_id</code></td><td>Unique agent identifier</td></tr>
			<tr
				><td><code>public_key_hex</code></td><td
					>Ed25519 public key (hex-encoded) used for signature verification</td
				></tr
			>
			<tr
				><td><code>facts_url</code></td><td
					>Primary URL pointing to the agent's AgentFacts document</td
				></tr
			>
			<tr
				><td><code>private_url</code></td><td
					>Optional private/internal URL (not publicly advertised)</td
				></tr
			>
			<tr
				><td><code>resolver_url</code></td><td>Optional override URL for adaptive resolution</td
				></tr
			>
			<tr
				><td><code>ttl_seconds</code></td><td>Cache TTL (default: 300s). KV minimum is 60s.</td></tr
			>
			<tr
				><td><code>signature_hex</code></td><td
					>Ed25519 signature over canonical JSON of all signable fields</td
				></tr
			>
			<tr
				><td><code>signer_id</code></td><td
					>Identity of the signing node (e.g. <code>nexartis-nanda-node</code>)</td
				></tr
			>
			<tr
				><td><code>quilt_type</code></td><td
					>Federation quilt type: <code>native</code>, <code>mirror</code>, or
					<code>proxy</code></td
				></tr
			>
		</tbody>
	</table>

	<pre><code class="language-bash"
			># Resolve an agent by ID
curl https://your-node.example.com/resolve/my-agent-id

# Public discovery of all AgentAddr records
curl https://your-node.example.com/.well-known/nanda-index</code
		></pre>

	<h3>Signature Verification</h3>
	<p>
		AgentAddr records use <strong>canonical JSON serialization</strong> (sorted keys, no whitespace)
		for deterministic signing. Any party can verify a record by importing the embedded
		<code>public_key_hex</code> as an Ed25519 key and verifying the <code>signature_hex</code>
		against the canonical form.
	</p>

	<h2>Adaptive Resolution</h2>
	<p>
		The <code>POST /resolve</code> endpoint performs <strong>context-aware resolution</strong>. The
		resolver selects one of three strategies based on the request:
	</p>

	<h3>Resolution Strategies</h3>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-green-500 !py-3">
			<h4 class="font-semibold mb-1">Static</h4>
			<p class="text-xs text-nanda-text-muted">
				No context provided → returns endpoints from AgentFacts in order, scored by position (1.0,
				0.9, 0.8…). Used for simple lookups.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-amber-500 !py-3">
			<h4 class="font-semibold mb-1">Rotating</h4>
			<p class="text-xs text-nanda-text-muted">
				Agent has a <code>resolver_url</code> but no context → round-robin across the endpoint pool with
				health awareness. Unhealthy endpoints are deprioritized (moved to end) rather than removed.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-violet-500 !py-3">
			<h4 class="font-semibold mb-1">Adaptive</h4>
			<p class="text-xs text-nanda-text-muted">
				Context body provided → full composite scoring with geo proximity, trust, capability match,
				and health. Returns endpoints ranked by composite score.
			</p>
		</div>
	</div>

	<h3>Scoring Weights</h3>
	<p>The adaptive strategy computes a composite score per endpoint:</p>
	<pre><code
			>composite = (geo × w_geo) + (trust × w_trust) + (capability × w_cap) + (health × w_health)</code
		></pre>
	<table>
		<thead><tr><th>Factor</th><th>Scoring</th></tr></thead>
		<tbody>
			<tr
				><td><strong>Geo proximity</strong></td><td
					>Same country = 1.0, same region = 0.7, different region = 0.3, unknown = 0.5</td
				></tr
			>
			<tr
				><td><strong>Trust score</strong></td><td>Normalized 0.0–1.0 from reputation snapshots</td
				></tr
			>
			<tr
				><td><strong>Capability match</strong></td><td
					>Intersection / required capabilities (1.0 if no requirements)</td
				></tr
			>
			<tr
				><td><strong>Health</strong></td><td
					>70% success rate + 30% latency score (p95 &lt; 5s). Unknown = 0.5</td
				></tr
			>
		</tbody>
	</table>

	<h3>Context Parameters</h3>
	<pre><code class="language-json"
			>{@html `{
  "requester_location": "US",
  "required_capabilities": ["text-to-text"],
  "protocol_preference": "a2a",
  "min_trust_score": 0.7
}`}</code
		></pre>

	<h2>SafeSearch</h2>
	<p>
		SafeSearch mode filters agents by trust thresholds, jurisdictions, and compliance status. Enable
		it by passing SafeSearch parameters to the <code>/search</code> endpoint:
	</p>
	<pre><code class="language-bash"
			>curl "https://your-node.example.com/search?q=translation&amp;min_trust=0.7&amp;jurisdiction=EU"</code
		></pre>
	<p>SafeSearch filters include:</p>
	<ul>
		<li><code>min_trust</code> — Minimum trust score threshold (0.0–1.0)</li>
		<li><code>required_certs</code> — Only return agents with specific certifications</li>
		<li><code>jurisdiction</code> — Filter by compliance jurisdiction (e.g. EU, US)</li>
		<li><code>content_flags</code> — Exclude agents with specific content flags</li>
	</ul>

	<h2>Switchboard (Protocol Bridge)</h2>
	<p>
		The Switchboard bridges between protocols (<strong>A2A ↔ MCP ↔ NLWeb</strong>), allowing agents
		registered with one protocol to be discovered and called via another. It auto-discovers an
		agent's supported protocols by probing well-known endpoints.
	</p>
	<ul>
		<li>
			<strong>Auto-discovery</strong> — <code>nanda_discover_agent</code> probes a URL for A2A, MCP, and
			NLWeb support
		</li>
		<li>
			<strong>Protocol adapters</strong> — Registered per-agent in the
			<code>protocol_adapters</code> table
		</li>
		<li>
			<strong>Export</strong> — <code>nanda_export_agent</code> generates metadata in any target protocol
			format
		</li>
	</ul>

	<h2>API Endpoints</h2>
	<table>
		<thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
		<tbody>
			<tr
				><td>POST</td><td><code>/resolve</code></td><td>Adaptive resolution with context body</td
				></tr
			>
			<tr
				><td>GET</td><td><code>/resolve/:agent_id</code></td><td
					>AgentAddr lookup by ID (KV cache → D1 fallback)</td
				></tr
			>
			<tr
				><td>GET</td><td><code>/.well-known/nanda-index</code></td><td
					>All AgentAddr records (public)</td
				></tr
			>
			<tr
				><td>GET</td><td><code>/search?min_trust=&amp;jurisdiction=</code></td><td
					>SafeSearch filtered discovery</td
				></tr
			>
			<tr
				><td>POST</td><td><code>/api/switchboard/discover</code></td><td
					>Auto-discover agent protocols</td
				></tr
			>
			<tr
				><td>GET</td><td><code>/api/switchboard/adapters/:agent_id</code></td><td
					>List protocol adapters</td
				></tr
			>
		</tbody>
	</table>

	<h2>MCP Integration</h2>
	<p>
		Resolution and discovery are available via MCP tools:
		<code>nanda_resolve_agent</code>, <code>nanda_discover_agent</code>,
		<code>nanda_list_adapters</code>, and <code>nanda_export_agent</code>.
	</p>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust">Trust &amp; Security</a> for trust scoring ·
		<a href="/docs/federation">Federation</a> for cross-node resolution ·
		<a href="/docs/mcp">MCP Tools</a> for programmatic access
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/adaptive-resolution">Adaptive Resolution</a> — how the resolver selects the best
		strategy at runtime ·
		<a href="/blog/building-agent-dns">Building Agent DNS</a> — the architecture behind agent discovery
		at scale
	</div>
</div>
