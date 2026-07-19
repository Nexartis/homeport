<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Webhooks — Homeport</title>
	<meta
		name="description"
		content="Real-time event notifications with HMAC-SHA256 signing, circuit breaker protection, and subscription lifecycle management."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-webhooks.png" />
</svelte:head>

<div class="prose">
	<h1>Webhooks</h1>
	<p>
		Subscribe to real-time events from the NANDA registry. Webhooks deliver HTTP POST callbacks when
		agents are registered, certified, reputation scores change, or compliance violations occur.
	</p>

	<div class="callout callout-info">
		<strong>Inline delivery:</strong> Webhooks are delivered inline (no queue infrastructure). The
		<code>/api/queue/webhook-deliver</code> endpoint is available for external callers but delivery
		happens synchronously during event dispatch. A <strong>circuit breaker</strong> disables subscriptions
		after 10 consecutive failures.
	</div>

	<h2>Event Types</h2>
	<table>
		<thead><tr><th>Event</th><th>Description</th></tr></thead>
		<tbody>
			<tr><td><code>agent.registered</code></td><td>New agent registered or updated</td></tr>
			<tr><td><code>agent.deprecated</code></td><td>Agent deprecated or tombstoned</td></tr>
			<tr><td><code>cert.issued</code></td><td>Certification issued or renewed</td></tr>
			<tr><td><code>cert.revoked</code></td><td>Certification revoked</td></tr>
			<tr><td><code>reputation.updated</code></td><td>Reputation score changed</td></tr>
			<tr><td><code>compliance.violation</code></td><td>Compliance violation detected</td></tr>
			<tr><td><code>federation.peer_added</code></td><td>New federation peer connected</td></tr>
		</tbody>
	</table>

	<h2>Creating a Subscription</h2>
	<p>
		The server generates a cryptographic secret (32-byte hex) for HMAC signing and returns it in the
		response. Store this secret securely — it is only shown once.
	</p>
	<pre><code class="language-bash"
			>{@html `curl -X POST https://your-node.example.com/api/admin/webhooks \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer nanda_YOUR_KEY" \\
  -d '{
    "callbackUrl": "https://your-app.com/hooks/nanda",
    "events": ["agent.registered", "cert.issued"]
  }'`}</code
		></pre>
	<p>Response:</p>
	<pre><code class="language-json"
			>{@html `{
  "id": "sub_abc123",
  "secret": "a1b2c3d4...64-char-hex-string",
  "status": "active"
}`}</code
		></pre>

	<h2>Subscription Lifecycle</h2>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<h4 class="font-semibold mb-1">Pause / Resume</h4>
			<p class="text-xs text-nanda-text-muted">
				Temporarily stop deliveries without deleting the subscription. Paused subscriptions retain
				their secret and event filters.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<h4 class="font-semibold mb-1">Circuit Breaker</h4>
			<p class="text-xs text-nanda-text-muted">
				After <strong>10 consecutive delivery failures</strong>, the subscription is automatically
				disabled. Successful deliveries reset the failure counter. Disabled subscriptions must be
				manually re-enabled.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<h4 class="font-semibold mb-1">Delete</h4>
			<p class="text-xs text-nanda-text-muted">
				Only the subscription owner can delete. Deletion is permanent — the secret is discarded.
			</p>
		</div>
	</div>

	<h2>Delivery Envelope</h2>
	<p>Each delivery POSTs a JSON envelope to your callback URL:</p>
	<pre><code class="language-json"
			>{@html `{
  "event": "agent.registered",
  "payload": { "agent_id": "my-agent", "name": "..." },
  "timestamp": "2026-04-05T12:00:00.000Z",
  "idempotency_key": "nk_abc123"
}`}</code
		></pre>

	<h3>Headers</h3>
	<table>
		<thead><tr><th>Header</th><th>Description</th></tr></thead>
		<tbody>
			<tr
				><td><code>X-Webhook-Signature</code></td><td
					>HMAC-SHA256 signature: <code>sha256=&#123;hex_digest&#125;</code></td
				></tr
			>
			<tr
				><td><code>X-Webhook-Event</code></td><td
					>Event type string (e.g. <code>agent.registered</code>)</td
				></tr
			>
			<tr><td><code>X-Idempotency-Key</code></td><td>Unique key for deduplication</td></tr>
			<tr><td><code>Content-Type</code></td><td><code>application/json</code></td></tr>
		</tbody>
	</table>

	<h3>Verifying Signatures</h3>
	<pre><code class="language-javascript"
			>{@html `import crypto from 'node:crypto';

function verifyWebhook(body, signature, secret) {
  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(body).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</code
		></pre>

	<h2>URL Validation</h2>
	<p>Callback URLs are validated at subscription creation:</p>
	<ul>
		<li>Must use <strong>HTTPS</strong> — HTTP is rejected</li>
		<li>
			Must not target <code>localhost</code>, <code>127.0.0.1</code>, <code>[::1]</code>, or any
			private/RFC1918 IP range
		</li>
		<li>
			Redirects are blocked during delivery (SSRF protection) — returns are discarded rather than
			followed
		</li>
	</ul>

	<h2>Delivery Behavior</h2>
	<ul>
		<li><strong>Timeout:</strong> 10-second delivery timeout per request</li>
		<li>
			<strong>Success:</strong> Any <code>2xx</code> response resets the failure counter and updates
			<code>last_delivered_at</code>
		</li>
		<li><strong>Failure:</strong> Non-2xx or network error increments the failure counter</li>
		<li><strong>Circuit breaker:</strong> ≥ 10 consecutive failures → subscription disabled</li>
	</ul>

	<h2>API Endpoints</h2>
	<table>
		<thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
		<tbody>
			<tr><td>POST</td><td><code>/api/admin/webhooks</code></td><td>Create subscription</td></tr>
			<tr><td>GET</td><td><code>/api/admin/webhooks</code></td><td>List subscriptions</td></tr>
			<tr
				><td>DELETE</td><td><code>/api/admin/webhooks/:id</code></td><td>Delete subscription</td
				></tr
			>
			<tr
				><td>PATCH</td><td><code>/api/admin/webhooks/:id/pause</code></td><td>Pause subscription</td
				></tr
			>
			<tr
				><td>PATCH</td><td><code>/api/admin/webhooks/:id/resume</code></td><td
					>Resume subscription</td
				></tr
			>
		</tbody>
	</table>

	<h2>MCP Integration</h2>
	<p>
		Create subscriptions via MCP: <code>nanda_subscribe_webhook</code> tool. Manage existing
		subscriptions via the <code>/api/admin/webhooks</code> REST endpoints.
	</p>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/api">API Reference</a> for all endpoints ·
		<a href="/docs/mcp">MCP Tools</a> for <code>nanda_subscribe_webhook</code>
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/developer-api-keys">Developer API Keys</a> — authentication and key management
		for webhook integrations ·
		<a href="/blog/nest-quickstart">NestJS Quickstart</a> — deploy and configure a NANDA node with webhook
		support
	</div>
</div>
