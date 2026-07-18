<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Quickstart — Homeport</title>
	<meta
		name="description"
		content="Get up and running with the NANDA API in under 5 minutes — register your first agent with a single curl command."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-quickstart.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-quickstart.png" />
</svelte:head>

<div class="prose">
	<h1>Quickstart</h1>
	<p>
		Get up and running with the NANDA Infrastructure API in under 5 minutes — register your first
		agent with a single <code>curl</code> command.
	</p>

	<div class="callout callout-tip">
		<strong>Base URL</strong>
		All endpoints below are relative to your NANDA node. Replace <code>your-node.example.com</code>
		with the host of your deployed Homeport node:
		<code>https://your-node.example.com</code>
	</div>

	<div class="step-list">
		<div class="step-item">
			<h3>Check the Node</h3>
			<p>Verify the NANDA node is online and see which services are active:</p>
			<pre><code>curl https://your-node.example.com/health</code></pre>
			<p>
				You'll receive a JSON response with the node environment, service status, database
				connectivity, and timestamp.
			</p>
		</div>

		<div class="step-item">
			<h3>Register an Agent</h3>
			<p>
				Submit an agent to the NANDA Index. The registry accepts AgentFacts-compatible metadata:
			</p>
			<pre><code
					>curl -X POST https://your-node.example.com/register \
  -H "Content-Type: application/json" \
  -d '&#123;
    "agent_id": "my-agent-001",
    "agent_name": "My First Agent",
    "label": "demo-agent",
    "description": "A demo agent for the NANDA quickstart guide",
    "version": "1.0.0",
    "provider": "your-org",
    "agent_url": "https://example.com/agent",
    "capabilities": ["text-generation", "summarization"],
    "tags": ["nlp", "demo"],
    "endpoints": [
      &#123; "protocol": "a2a", "url": "https://example.com/a2a" &#125;
    ],
    "skills": [
      &#123; "id": "summarize", "name": "Summarize Text" &#125;
    ]
  &#125;'</code
				></pre>
			<p>
				On success you'll receive the full agent record with a <code>registered_at</code> timestamp and
				a W3C Verifiable Credential.
			</p>
		</div>

		<div class="step-item">
			<h3>Look Up an Agent</h3>
			<p>Retrieve a specific agent by its ID:</p>
			<pre><code>curl https://your-node.example.com/lookup/my-agent-001</code></pre>
			<p>
				Returns the full AgentFacts record including capabilities, endpoints, trust scores, and
				metadata.
			</p>
		</div>

		<div class="step-item">
			<h3>Search Agents</h3>
			<p>Find agents by keyword across names, descriptions, capabilities, and tags:</p>
			<pre><code>curl "https://your-node.example.com/search?q=summarization&amp;limit=10"</code
				></pre>
			<p>
				Returns a paginated list of matching agents ranked by relevance. Supports <code>q</code>,
				<code>limit</code>, and <code>offset</code> parameters.
			</p>
		</div>

		<div class="step-item">
			<h3>Get AgentFacts</h3>
			<p>Retrieve the full W3C Verifiable Credential for any registered agent:</p>
			<pre><code>curl https://your-node.example.com/agentfacts/my-agent-001</code></pre>
			<p>
				Returns a JSON-LD document signed with Ed25519, containing skills, capabilities, trust
				scores, and compliance attestations — independently verifiable by any party.
			</p>
		</div>
	</div>

	<h2>What's Next?</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<a href="/docs/nanda" class="nanda-card block text-nanda-text no-underline">
			<h4 class="font-semibold mb-1">Project NANDA</h4>
			<p class="text-sm text-nanda-text-muted">
				Deep dive into the protocol architecture, research papers, and roadmap.
			</p>
		</a>
		<a href="/docs/api" class="nanda-card block text-nanda-text no-underline">
			<h4 class="font-semibold mb-1">API Reference</h4>
			<p class="text-sm text-nanda-text-muted">
				Full endpoint documentation with parameters, response schemas, and examples.
			</p>
		</a>
		<a href="/docs/a2a" class="nanda-card block text-nanda-text no-underline">
			<h4 class="font-semibold mb-1">A2A Protocol</h4>
			<p class="text-sm text-nanda-text-muted">
				The JSON-RPC protocol for agent-to-agent communication and task delegation.
			</p>
		</a>
		<a href="/docs/trust" class="nanda-card block text-nanda-text no-underline">
			<h4 class="font-semibold mb-1">Trust &amp; Security</h4>
			<p class="text-sm text-nanda-text-muted">
				Ed25519 signing, W3C VCs, Bitstring Status List revocation, and Wilson CI scoring.
			</p>
		</a>
	</div>

	<h2>Standards Referenced</h2>
	<p class="text-sm text-nanda-text-muted mb-3">
		NANDA agents are issued credentials conforming to open W3C and IETF standards:
	</p>
	<ul>
		<li>
			<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
				>W3C Verifiable Credentials Data Model v2.0</a
			>
		</li>
		<li>
			<a href="https://datatracker.ietf.org/doc/html/rfc8032" target="_blank" rel="noopener"
				>RFC 8032 — Ed25519 Digital Signatures</a
			>
		</li>
		<li>
			<a href="https://www.w3.org/TR/vc-bitstring-status-list/" target="_blank" rel="noopener"
				>W3C VC Bitstring Status List</a
			> — credential revocation
		</li>
	</ul>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/nest-quickstart">NestJS Quickstart</a> — deploy your own NANDA node with the NEST
		toolkit ·
		<a href="/blog/paradigm-shift">The Paradigm Shift</a> — why the agent economy needs new infrastructure
	</div>
</div>
