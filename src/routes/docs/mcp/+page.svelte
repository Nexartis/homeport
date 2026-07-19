<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>MCP Integration — Homeport</title>
	<meta
		name="description"
		content="Model Context Protocol server with 21 tools for AI assistant integration with the NANDA registry, orchestration, trust, switchboard, and payments."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-mcp.png" />
</svelte:head>

<div class="prose">
	<h1>MCP Integration</h1>
	<p>
		The NANDA node exposes a <strong>Model Context Protocol (MCP)</strong> server at
		<code>POST /mcp</code>. Connect any MCP-compatible AI assistant (Claude, Cursor, etc.) to
		interact with the NANDA registry directly — register agents, run workflows, query trust scores,
		bridge protocols, and manage payments.
	</p>

	<div class="callout callout-info">
		<strong>Authentication:</strong> All MCP requests require
		<code>Authorization: Bearer nanda_YOUR_KEY</code> (case-insensitive scheme). Get your API key
		from the <a href="/developers">Developer Portal</a>.
	</div>

	<h2>Available Tools (21)</h2>
	<p>Tools are organized into six functional groups:</p>

	<h3>Registry (6 tools)</h3>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_lookup_agent</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Look up a single agent by ID. Returns full agent record.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id</code> (required)</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_search_agents</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Search agents by query string, capabilities array, or tags array.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>query?</code>, <code>capabilities?</code>, <code>tags?</code>
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_list_agents</code>
			<p class="text-xs text-nanda-text-muted mt-1">List all registered agents on the node.</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_register_agent</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Register a new agent or update an existing one.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>agent_id</code>, <code>agent_url</code>, <code>capabilities?</code>,
				<code>tags?</code>
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_get_agentfacts</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Retrieve AgentFacts metadata (W3C VC-based) for an agent.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id</code> (required)</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_resolve_agent</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Resolve agent via the Lean Index — returns signed AgentAddr record.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id</code> (required)</p>
		</div>
	</div>

	<h3>Trust &amp; Compliance (4 tools)</h3>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_get_reputation</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Get reputation scores (local, federated, combined) with trust badges.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id?</code></p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_check_cert</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Check certification status and revocation for a certificate.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>cert_id</code> (required)</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_trust_scores</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Get trust framework scores — cross-registry aggregation with confidence metrics.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id?</code></p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_compliance_check</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Run a compliance policy evaluation against an agent.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id</code> (required)</p>
		</div>
	</div>

	<h3>Orchestration (2 tools)</h3>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_create_workflow</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Create a multi-agent workflow with DAG definition.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>name</code> (required), <code>owner_id</code>, <code>dag</code>
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_run_workflow</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Execute a workflow run with optional input parameters.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>workflow_id</code> (required), <code>input?</code>
			</p>
		</div>
	</div>

	<h3>Switchboard (3 tools)</h3>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_discover_agent</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Auto-discover an agent by URL — probes for A2A, MCP, and NLWeb protocols and registers
				adapters.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>url</code> (required)</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_list_adapters</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				List all registered protocol adapters for an agent.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id</code> (required)</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_export_agent</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Export agent metadata to A2A, MCP, or NLWeb format.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>agent_id</code> (required), <code>target_protocol</code> (required:
				<code>a2a</code>
				| <code>mcp</code> | <code>nlweb</code>)
			</p>
		</div>
	</div>

	<h3>Infrastructure &amp; Payments (6 tools)</h3>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_check_health</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Infrastructure health check — verifies DB, R2, and KV subsystems.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_federation_status</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Federation status — peer summary, gossip stats, quilt routes, vector clocks.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_subscribe_webhook</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Create a webhook subscription for real-time event notifications.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>url</code> (required), <code>events?</code>
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_get_exchange_rates</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Get exchange rates between supported currencies. Optionally filter by from/to pair.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>from?</code>, <code>to?</code></p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_get_wallet_balance</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Get multi-currency wallet balances for an agent.
			</p>
			<p class="text-xs opacity-50 mt-1">Params: <code>agent_id</code> (required)</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold text-purple-400">nanda_convert_currency</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Convert an amount between currencies at current exchange rates.
			</p>
			<p class="text-xs opacity-50 mt-1">
				Params: <code>from</code> (required), <code>to</code> (required), <code>amount</code> (required)
			</p>
		</div>
	</div>

	<h2>Configuration</h2>
	<p>Add the NANDA MCP server to your AI assistant configuration:</p>
	<pre><code class="language-json"
			>{@html `{
  "mcpServers": {
    "nanda": {
      "url": "https://your-node.example.com/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer nanda_YOUR_KEY"
      }
    }
  }
}`}</code
		></pre>

	<h2>Protocol</h2>
	<p>
		The MCP endpoint uses <strong>JSON-RPC 2.0</strong> over HTTP (Streamable HTTP transport,
		protocol version <code>2025-03-26</code>). Supported methods:
	</p>
	<ul>
		<li>
			<code>initialize</code> — Handshake returning server info (<code
				>nanda-infrastructure-mcp v1.0.0</code
			>) and capabilities
		</li>
		<li><code>tools/list</code> — List all 21 available tools with input schemas</li>
		<li>
			<code>tools/call</code> — Execute a tool with parameters (must be an object, not an array)
		</li>
	</ul>

	<div class="callout callout-info">
		<strong>Parameter validation:</strong> Tool parameters must be a JSON object. Arrays are
		rejected with error code <code>-32602</code>. The server echoes back the caller's
		<code>id</code> in all responses, including auth and validation errors.
	</div>

	<h2>Example: Search Agents</h2>
	<pre><code class="language-json"
			>{@html `{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": "1",
  "params": {
    "name": "nanda_search_agents",
    "arguments": {
      "query": "translation",
      "capabilities": ["text-to-text"]
    }
  }
}`}</code
		></pre>

	<h2>Example: Discover Agent via Switchboard</h2>
	<pre><code class="language-json"
			>{@html `{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": "2",
  "params": {
    "name": "nanda_discover_agent",
    "arguments": {
      "url": "https://my-agent.example.com"
    }
  }
}`}</code
		></pre>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="https://modelcontextprotocol.io/" target="_blank" rel="noopener">MCP Specification</a>
		·
		<a href="/docs/api">API Reference</a> for REST endpoints ·
		<a href="/docs/sdk">SDK Reference</a> for TypeScript integration
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/nanda-a2a-mcp">NANDA Meets A2A &amp; MCP</a> — how NANDA bridges both protocols ·
		<a href="/blog/protocol-bridge">The Protocol Bridge</a> — translating between agent communication
		standards
	</div>
</div>
