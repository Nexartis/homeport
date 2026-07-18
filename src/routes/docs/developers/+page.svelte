<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Developer API Keys — Homeport</title>
	<meta
		name="description"
		content="How to generate and use API keys for the Homeport developer program — authentication, rate limits, tiers, and endpoint access."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-developers.png" />
</svelte:head>

<div class="prose">
	<h1>Developer API Keys</h1>
	<p class="lead">
		The Homeport uses API keys to authenticate write operations. Read operations (search, lookup,
		list, health) are always open — no key required.
	</p>

	<h2>How It Works</h2>
	<ul>
		<li>
			<strong>Read endpoints are open</strong> — <code>GET /list</code>, <code>GET /search</code>,
			<code>GET /lookup/:id</code>, <code>GET /agentfacts/:id</code>, <code>GET /health</code>,
			<code>GET /stats</code>, <code>GET /reputation</code>
		</li>
		<li>
			<strong>Write endpoints accept API keys</strong> — <code>POST /register</code>,
			<code>PUT /agentfacts/:id</code>, <code>DELETE /agents/:id</code>
		</li>
		<li>
			Keys use the <code>nanda_</code> prefix and are passed via the <code>Authorization</code> header
		</li>
		<li>
			Keys are hashed with SHA-256 before storage — the raw key is shown only once at generation
			time
		</li>
	</ul>

	<h2>Getting a Key</h2>
	<ol>
		<li><a href="/auth">Sign in</a> to your Nexartis account (or create one for free)</li>
		<li>Go to the <a href="/developers/dashboard">Developer Dashboard</a></li>
		<li>Click <strong>Generate</strong>, give your key a name, and copy the raw key immediately</li>
	</ol>

	<p>You can also generate keys via the API:</p>
	<pre><code
			>curl -X POST {page.data.registryUrl}/api/developers/keys \
  -H "Cookie: access_token=YOUR_SESSION" \
  -H "Content-Type: application/json" \
  -d '{'{'}"name": "my-agent-key"}'</code
		></pre>

	<h2>Using Your Key</h2>
	<p>
		Include your key in the <code>Authorization</code> header with the <code>Bearer</code> scheme:
	</p>
	<pre><code
			>curl -X POST {page.data.registryUrl}/register \
  -H "Authorization: Bearer nanda_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{'{'}"agent_id": "my-agent", "agent_url": "https://my-agent.example.com"}'</code
		></pre>

	<h2>Rate Limits</h2>
	<p>Rate limits are applied monthly per key. Usage counters reset on the 1st of each month.</p>

	<div class="not-prose">
		<table class="w-full text-sm border border-nanda-border/40 rounded-lg overflow-hidden">
			<thead>
				<tr class="bg-nanda-bg-muted text-left">
					<th class="px-4 py-2 font-semibold text-nanda-text">Tier</th>
					<th class="px-4 py-2 font-semibold text-nanda-text">Requests/Month</th>
					<th class="px-4 py-2 font-semibold text-nanda-text">Max Active Keys</th>
					<th class="px-4 py-2 font-semibold text-nanda-text">Price</th>
				</tr>
			</thead>
			<tbody class="text-nanda-text-muted">
				<tr class="border-t border-nanda-border/30">
					<td class="px-4 py-2 font-medium text-nanda-text">Free</td>
					<td class="px-4 py-2">1,000</td>
					<td class="px-4 py-2">5</td>
					<td class="px-4 py-2">$0</td>
				</tr>
				<tr class="border-t border-nanda-border/30">
					<td class="px-4 py-2 font-medium text-nanda-text">Pro</td>
					<td class="px-4 py-2">10,000</td>
					<td class="px-4 py-2">25</td>
					<td class="px-4 py-2">Contact us</td>
				</tr>
				<tr class="border-t border-nanda-border/30">
					<td class="px-4 py-2 font-medium text-nanda-text">Enterprise</td>
					<td class="px-4 py-2">100,000</td>
					<td class="px-4 py-2">Unlimited</td>
					<td class="px-4 py-2">Custom</td>
				</tr>
			</tbody>
		</table>
	</div>

	<h2>Key Management API</h2>

	<h3>Generate a key</h3>
	<pre><code
			>POST /api/developers/keys
Content-Type: application/json

{'{'}"name": "my-key", "tier": "free"}

→ 201 {'{'}"key": {'{'}"id": "...", "raw_key": "nanda_...", ...}}</code
		></pre>

	<h3>List your keys</h3>
	<pre><code
			>GET /api/developers/keys

→ 200 {'{'}"keys": [...]}</code
		></pre>

	<h3>Revoke a key</h3>
	<pre><code
			>DELETE /api/developers/keys/:id

→ 200 {'{'}"message": "API key revoked successfully", ...}</code
		></pre>

	<h2>Security Notes</h2>
	<ul>
		<li>Keys are <strong>SHA-256 hashed</strong> before storage — we never store the raw key</li>
		<li>The raw key is returned <strong>exactly once</strong> at generation time</li>
		<li>Revoked keys cannot be un-revoked — generate a new one instead</li>
		<li>
			Keys that exceed their monthly rate limit will receive <code>429 Too Many Requests</code>
		</li>
		<li>Expired keys are automatically rejected</li>
	</ul>

	<h2>Transition Period</h2>
	<p>
		During the initial rollout, API keys are <strong>accepted but not required</strong> for write
		endpoints. This allows existing integrations (like
		<a href="https://knowyourmodel.ai">KnowYourModel</a>) to continue working without interruption.
		Once all known consumers have adopted keys, write endpoints will require authentication.
	</p>

	<div class="not-prose mt-8 flex gap-3">
		<a
			href="/developers/dashboard"
			class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-nanda-primary-500 transition-colors"
		>
			Get Your API Key
		</a>
		<a
			href="/docs/api"
			class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
		>
			Full API Reference
		</a>
	</div>

	<div class="callout callout-info mt-8">
		<strong>Related reading</strong>
		<a href="/blog/developer-api-keys">Developer API Keys</a> — a deep dive into key management,
		rate limits, and scopes ·
		<a href="/blog/nest-quickstart">NestJS Quickstart</a> — integrating NANDA into a NestJS application
	</div>
</div>
