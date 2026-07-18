<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Trust &amp; Security — Homeport</title>
	<meta
		name="description"
		content="Cryptographic trust infrastructure — Ed25519 signing, W3C Verifiable Credentials, Bitstring Status List revocation, and Zero Trust Agentic Access."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-trust.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-trust.png" />
</svelte:head>

<div class="prose">
	<h1>Trust &amp; Security</h1>
	<p>
		NANDA provides a cryptographic trust infrastructure for AI agents using <strong
			>Ed25519 signing</strong
		>, <strong>W3C Verifiable Credentials</strong>, and
		<strong>Bitstring Status List revocation</strong>. Every credential issued by a NANDA node is
		independently verifiable by any party.
	</p>

	<h2>Ed25519 Key Management</h2>
	<p>
		NANDA uses <strong>Ed25519</strong> (Edwards-curve Digital Signature Algorithm) for all credential
		signing. Keys are versioned to support seamless rotation:
	</p>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Versioned Keys</h4>
			<p class="text-sm text-nanda-text-muted">
				Private keys are stored as versioned secrets (v1, v2, etc.) with corresponding public keys.
				Up to 5 key versions are supported simultaneously for seamless rotation.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Sign with Latest</h4>
			<p class="text-sm text-nanda-text-muted">
				<code>signWithLatestKey()</code> automatically uses the newest available private key. The key
				version is included in the signed payload so verifiers know which public key to use.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Verify with Any</h4>
			<p class="text-sm text-nanda-text-muted">
				<code>verifyWithAnyKey()</code> tries all available public key versions, enabling graceful key
				rotation without invalidating existing credentials.
			</p>
		</div>
	</div>

	<h3>Public Key Retrieval</h3>
	<p>Public keys are published at well-known URLs for external verification:</p>
	<pre><code
			>GET /.well-known/keys/ed25519-v1
GET /.well-known/keys/ed25519-v2</code
		></pre>

	<h2>W3C Verifiable Credentials</h2>
	<p>
		NANDA issues credentials following the <a
			href="https://www.w3.org/TR/vc-data-model-2.0/"
			target="_blank"
			rel="noopener">W3C Verifiable Credentials Data Model v2.0</a
		>. Each credential includes:
	</p>
	<ul>
		<li><strong>Issuer</strong> — the NANDA node's public URL</li>
		<li><strong>Subject</strong> — the agent being credentialed</li>
		<li>
			<strong>Proof</strong> — Ed25519 (Ed25519Signature2020 suite) with multibase base58btc-encoded proof
			value
		</li>
		<li>
			<strong>Status</strong> — Bitstring Status List (StatusList2021) reference for revocation checking
		</li>
	</ul>

	<h3>Proof Format</h3>
	<pre><code
			>&#123;
  "type": "Ed25519Signature2020",
  "created": "2026-02-19T12:00:00.000Z",
  "verificationMethod": "https://your-node.example.com/.well-known/keys/ed25519-v1",
  "proofPurpose": "assertionMethod",
  "proofValue": "z3FXQzA..."
&#125;</code
		></pre>
	<p>
		The <code>proofValue</code> is a <code>z</code>-prefixed base58btc encoding of the raw Ed25519
		signature, following the
		<a href="https://www.w3.org/TR/vc-di-eddsa/" target="_blank" rel="noopener"
			>EdDSA Cryptosuite (Ed25519Signature2020)</a
		> specification.
	</p>

	<h2>Bitstring Status List Revocation</h2>
	<p>
		Credential revocation uses the <a
			href="https://www.w3.org/TR/vc-bitstring-status-list/"
			target="_blank"
			rel="noopener">W3C Bitstring Status List</a
		> specification (implementation uses StatusList2021 type names) — a compressed bitstring where each
		bit represents a credential's revocation status.
	</p>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Capacity</h4>
			<p class="text-sm text-nanda-text-muted">
				16KB bitstring = 131,072 credential slots. Each revoked certificate is assigned a unique bit
				index.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Encoding</h4>
			<p class="text-sm text-nanda-text-muted">
				Bitstring is gzip-compressed then base64url-encoded per the spec. Bit = 1 means revoked, bit
				= 0 means active.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Check Revocation</h4>
			<p class="text-sm text-nanda-text-muted">
				<code>GET /credentials/status/:id</code> returns the full status list credential. Verifiers
				can also use the A2A <code>certificate.check</code> action.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Revoke via A2A</h4>
			<p class="text-sm text-nanda-text-muted">
				Certificates can be revoked via the A2A protocol using the <code>certificate.revoke</code> action
				with a cert_id and optional reason.
			</p>
		</div>
	</div>

	<h2>Zero Trust Agentic Access (ZTAA)</h2>
	<p>
		NANDA's enterprise governance framework applies <strong>Zero Trust</strong> principles to inter-agent
		communication:
	</p>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xl text-nanda-accent">⬡</span>
				<h4 class="font-semibold">Verify Explicitly</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Every agent interaction requires cryptographic verification — no implicit trust based on
				network position or previous interactions.
			</p>
		</div>
		<div class="nanda-card">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xl text-nanda-accent">⬡</span>
				<h4 class="font-semibold">Least Privilege</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Agents are granted only the minimum capabilities needed for each interaction. Selective
				Disclosure JWTs (agent-sd-jwt) enable claim-level privacy.
			</p>
		</div>
		<div class="nanda-card">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xl">⚠️</span>
				<h4 class="font-semibold">Assume Breach</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Credential revocation, reputation scoring, and continuous monitoring ensure compromised
				agents are detected and isolated quickly.
			</p>
		</div>
	</div>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust/toip">ToIP Alignment</a> for trust framework registration and trust graphs
		·
		<a href="/docs/a2a">A2A Protocol</a> for revocation actions ·
		<a href="/docs/agentfacts">AgentFacts</a>
		for credential metadata · <a href="/docs/federation">Federation</a> for cross-node trust
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/zero-trust-agents">Zero-Trust for Agents</a> — applying zero-trust principles to
		agent interactions ·
		<a href="/blog/cross-platform-trust">Cross-Platform Trust</a> — portable trust across registries
		·
		<a href="/series/agentic-web/trust-without-borders">Trust Without Borders</a> — the Agentic Web series
		on cross-registry identity
	</div>
</div>
