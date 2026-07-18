<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>AgentFacts — Homeport</title>
	<meta
		name="description"
		content="AgentFacts v1 specification — rich agent metadata encoded as W3C Verifiable Credentials with skills, capabilities, trust scores, and compliance attestations."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-agentfacts.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-agentfacts.png" />
</svelte:head>

<div class="prose">
	<h1>AgentFacts</h1>
	<p>
		<strong>AgentFacts</strong> are rich metadata documents that describe an AI agent's identity,
		capabilities, and trust profile. They complement the lean <strong>AgentAddr</strong> index
		records (~120 bytes) with detailed, verifiable information encoded as
		<strong>W3C Verifiable Credentials</strong>.
	</p>

	<div class="callout callout-info">
		<strong>AgentAddr vs AgentFacts</strong>
		AgentAddr is the minimum discovery record (ID, URL, protocol, capability summary). AgentFacts is the
		full metadata dossier — skills, trust scores, compliance, and more — cryptographically signed and
		independently verifiable.
	</div>

	<h2>API Endpoints</h2>
	<div class="grid gap-3 my-6 not-prose">
		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
					>GET</span
				>
				<code class="text-sm">/agentfacts/:id</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				Retrieve the AgentFacts document for a given agent ID. Returns 404 if no facts are stored.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-amber-500/20 text-amber-400"
					>PUT</span
				>
				<code class="text-sm">/agentfacts/:id</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				Store or update the AgentFacts document for an agent. The agent must already be registered.
			</p>
		</div>
	</div>

	<h2>Document Structure</h2>
	<p>An AgentFacts document is a JSON-LD object that includes:</p>

	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">🆔 Identity</h4>
			<p class="text-sm text-nanda-text-muted">
				Agent ID, DID (Decentralized Identifier), display name, description, and the agent's primary
				and API endpoint URLs.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">🧠 Skills &amp; Capabilities</h4>
			<p class="text-sm text-nanda-text-muted">
				Structured list of capabilities (e.g., <code>text-generation</code>,
				<code>code-review</code>, <code>data-analysis</code>) with optional confidence scores and
				supported input/output modes.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">⭐ Trust Profile</h4>
			<p class="text-sm text-nanda-text-muted">
				Trust scores computed via Wilson confidence intervals from multi-trial capability
				evaluations. Includes overall trust score, per-capability scores, and evaluation history.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Compliance Attestations</h4>
			<p class="text-sm text-nanda-text-muted">
				Declarations of compliance with governance policies — data handling rules, PII protections,
				regional routing constraints, and operational limits.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Cryptographic Proof</h4>
			<p class="text-sm text-nanda-text-muted">
				EdDSA (Ed25519) proof block making the entire document a W3C Verifiable Credential —
				independently verifiable by any party with the public key.
			</p>
		</div>
	</div>

	<h2>W3C VC Encoding</h2>
	<p>AgentFacts are encoded as W3C Verifiable Credentials with the following structure:</p>
	<pre><code
			>&#123;
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://nanda.nexartis.com/contexts/agentfacts/v1"
  ],
  "type": ["VerifiableCredential", "AgentFactsCredential"],
  "issuer": "https://your-node.example.com",
  "issuanceDate": "2026-02-19T12:00:00Z",
  "credentialSubject": &#123;
    "id": "did:nanda:my-agent",
    "type": "AgentFacts",
    "skills": ["text-generation", "summarization"],
    "trustScore": 0.87
  &#125;,
  "proof": &#123; "..." &#125;
&#125;</code
		></pre>

	<h2>Validation Rules</h2>
	<ul>
		<li>The <code>agent_id</code> in the facts document must match an existing registered agent</li>
		<li>The <code>credentialSubject.id</code> should reference the agent's DID</li>
		<li>
			Capability names should follow a lowercase hyphenated convention (e.g., <code
				>text-generation</code
			>)
		</li>
		<li>Trust scores are decimal values between 0.0 and 1.0</li>
		<li>The proof block is generated server-side using the node's latest Ed25519 key</li>
	</ul>

	<h2>Relationship to the NANDA Index</h2>
	<p>
		The NANDA Index stores <strong>AgentAddr</strong> records for fast global lookup. When a client discovers
		an agent via the index, they can fetch the full AgentFacts from the agent's home registry for detailed
		evaluation before interaction.
	</p>

	<h2>References</h2>
	<ul>
		<li>
			<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
				>W3C Verifiable Credentials Data Model v2.0</a
			> — the credential format AgentFacts are encoded as
		</li>
		<li>
			<a href="https://www.w3.org/TR/did-1.0/" target="_blank" rel="noopener">W3C DID Core v1.0</a> —
			decentralized identifiers used for agent identity
		</li>
		<li>
			<a href="https://datatracker.ietf.org/doc/html/rfc8032" target="_blank" rel="noopener"
				>RFC 8032 — Ed25519</a
			> — the signing algorithm used for credential proofs
		</li>
		<li>
			<a href="https://www.w3.org/TR/vc-bitstring-status-list/" target="_blank" rel="noopener"
				>W3C VC Bitstring Status List</a
			> — revocation mechanism for issued credentials
		</li>
	</ul>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust">Trust &amp; Security</a> for credential signing and revocation ·
		<a href="/docs/api">API Reference</a>
		for endpoint details · <a href="/docs/nanda">NANDA Overview</a> for the full architecture
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/agentfacts">AgentFacts: The Agent Nutrition Label</a> — the design rationale
		behind AgentFacts ·
		<a href="/series/agentic-web/agent-identity">Agent Identity</a> — how identity and metadata fit into
		the Agentic Web
	</div>
</div>
