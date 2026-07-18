<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>A2A Protocol — Homeport</title>
	<meta
		name="description"
		content="Agent-to-Agent JSON-RPC protocol documentation — how NANDA nodes handle inter-agent communication at the /a2a endpoint."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-a2a.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-a2a.png" />
</svelte:head>

<div class="prose">
	<h1>A2A Protocol</h1>
	<p>
		The <strong>Agent-to-Agent (A2A)</strong> protocol is a JSON-RPC 2.0 interface for inter-agent
		communication. NANDA nodes expose a single <code>POST /a2a</code> endpoint that routes messages based
		on action types.
	</p>

	<h2>Endpoint</h2>
	<pre><code
			>POST /a2a
Content-Type: application/json</code
		></pre>

	<h2>Request Format</h2>
	<p>All A2A messages follow the JSON-RPC 2.0 envelope with a nested message structure:</p>
	<pre><code
			>&#123;
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": &#123;
    "message": &#123;
      "role": "user",
      "parts": [&#123; "text": "&#123;\"action\": \"certificate.check\", \"cert_id\": \"cert-abc-123\"&#125;" &#125;]
    &#125;
  &#125;,
  "id": "req-001"
&#125;</code
		></pre>
	<p>
		The <code>text</code> field inside <code>parts[0]</code> must be a JSON string containing an
		<code>action</code> field that determines the routing.
	</p>

	<h2>Supported Actions</h2>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">certificate.revoke</h4>
			<p class="text-xs text-nanda-success mb-1.5">Certifier · Implemented</p>
			<p class="text-sm text-nanda-text-muted">
				Revoke a W3C Verifiable Credential by cert ID. Requires <code>cert_id</code> (string) and
				optional <code>reason</code> (string). Updates the Bitstring Status List revocation bitmap.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">certificate.check</h4>
			<p class="text-xs text-nanda-success mb-1.5">Certifier · Implemented</p>
			<p class="text-sm text-nanda-text-muted">
				Check whether a certificate has been revoked. Requires <code>cert_id</code> (string). Returns
				revocation status and Bitstring Status List index.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">start · status · certificate</h4>
			<p class="text-xs text-nanda-success mb-1.5">Certifier · Implemented</p>
			<p class="text-sm text-nanda-text-muted">
				Certification lifecycle — start a capability evaluation, check progress, and retrieve the
				issued credential.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">policy.*</h4>
			<p class="text-xs text-nanda-success mb-1.5">Compliance · Implemented</p>
			<p class="text-sm text-nanda-text-muted">
				Compliance policy management — create, evaluate, and enforce governance rules for registered
				agents.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">observer.* · telemetry.* · reputation</h4>
			<p class="text-xs text-nanda-success mb-1.5">Observer · Implemented</p>
			<p class="text-sm text-nanda-text-muted">
				Liveness probes, latency telemetry, and reputation scoring for registered agents.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">audit.*</h4>
			<p class="text-xs text-nanda-success mb-1.5">Auditor · Implemented</p>
			<p class="text-sm text-nanda-text-muted">
				Payment intent reconciliation, settlement verification, and wallet management for x402-NP
				agent transactions.
			</p>
		</div>
	</div>

	<h2>Response Format</h2>
	<p>Successful responses return a JSON-RPC 2.0 result with the same A2A message envelope:</p>
	<pre><code
			>&#123;
  "jsonrpc": "2.0",
  "result": &#123;
    "role": "agent",
    "parts": [&#123; "text": "&#123;\"status\": \"revoked\", \"cert_id\": \"cert-abc-123\"&#125;" &#125;]
  &#125;,
  "id": "req-001"
&#125;</code
		></pre>

	<h2>Error Codes</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<code class="text-xs">-32700</code>
			<p class="text-sm text-nanda-text-muted mt-1">Parse error — invalid JSON body</p>
		</div>
		<div class="nanda-card">
			<code class="text-xs">-32600</code>
			<p class="text-sm text-nanda-text-muted mt-1">
				Invalid request — missing jsonrpc/method/message
			</p>
		</div>
		<div class="nanda-card">
			<code class="text-xs">-32601</code>
			<p class="text-sm text-nanda-text-muted mt-1">Method not found — unknown action</p>
		</div>
		<div class="nanda-card">
			<code class="text-xs">-32602</code>
			<p class="text-sm text-nanda-text-muted mt-1">Invalid params — missing required fields</p>
		</div>
	</div>

	<h2>References</h2>
	<ul>
		<li>
			<a href="https://a2a-protocol.org/latest/specification/" target="_blank" rel="noopener"
				>A2A Protocol Specification</a
			> — the official Agent-to-Agent protocol spec
		</li>
		<li>
			<a href="https://www.jsonrpc.org/specification" target="_blank" rel="noopener"
				>JSON-RPC 2.0 Specification</a
			> — the wire format used by A2A
		</li>
		<li>
			<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
				>W3C Verifiable Credentials Data Model v2.0</a
			> — credential format used for cert.issue and cert.revoke actions
		</li>
	</ul>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/nanda-a2a-mcp">NANDA Meets A2A &amp; MCP</a> — how NANDA implements both
		protocols side by side ·
		<a href="/blog/protocol-bridge">The Protocol Bridge</a> — cross-protocol translation for agent interoperability
	</div>
</div>
