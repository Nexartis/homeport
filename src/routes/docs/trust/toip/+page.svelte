<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>ToIP Alignment — Homeport</title>
	<meta
		name="description"
		content="Trust over IP (ToIP) alignment — trust framework registration, DIF trust graph model, and interoperable trust infrastructure for AI agents."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-toip.png" />
</svelte:head>

<div class="prose">
	<h1>ToIP Alignment</h1>
	<p>
		NANDA aligns with the <a href="https://trustoverip.org/" target="_blank" rel="noopener"
			>Trust over IP (ToIP) Foundation</a
		>
		and the
		<a href="https://identity.foundation/" target="_blank" rel="noopener"
			>Decentralized Identity Foundation (DIF)</a
		> Trust Establishment working group to provide interoperable, standards-based trust infrastructure
		for AI agents.
	</p>

	<h2>Trust Framework Model</h2>
	<p>
		A <strong>Trust Framework</strong> defines the governance rules, policies, and standards that participants
		in a trust ecosystem agree to follow. NANDA registers trust frameworks as metadata records that agents
		can reference:
	</p>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Framework Registration</h4>
			<p class="text-sm text-nanda-text-muted">
				Each framework has a unique <code>framework_id</code>, version, governance URL, and
				alignment tag (e.g. <code>toip-tswg</code>, <code>dif-trust-graph</code>).
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Pre-Seeded Framework</h4>
			<p class="text-sm text-nanda-text-muted">
				NANDA ships with the <code>kym-trust-v1</code> framework pre-seeded — the KnowYourModel Trust
				Framework, aligned with ToIP TSWG standards.
			</p>
		</div>
	</div>

	<h3>Framework Schema</h3>
	<pre><code
			>&#123;
  "framework_id": "kym-trust-v1",
  "name": "KnowYourModel Trust Framework",
  "version": "1.0",
  "governance_url": "https://knowyourmodel.ai/docs",
  "alignment": "toip-tswg"
&#125;</code
		></pre>

	<h2>Trust Graph</h2>
	<p>
		The <strong>Trust Graph</strong> models directed trust relationships between DIDs (Decentralized Identifiers).
		Each edge represents a trust assertion from one party to another:
	</p>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xl text-nanda-accent">⬡</span>
				<h4 class="font-semibold">Directed Edges</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Each edge has a <code>from_did</code>, <code>to_did</code>, <code>relationship</code> type
				(issuer, verifier, peer, endorser), and a <code>trust_level</code> from 0.0 to 1.0.
			</p>
		</div>
		<div class="nanda-card">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xl text-nanda-accent">⬡</span>
				<h4 class="font-semibold">Path Finding</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				BFS-based path computation finds the shortest trust chain between two DIDs. Trust is
				multiplicative along the path — each hop reduces the aggregate trust level.
			</p>
		</div>
		<div class="nanda-card">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xl text-nanda-accent">⬡</span>
				<h4 class="font-semibold">Evidence &amp; Validity</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Edges can reference an <code>evidence_uri</code> (e.g. a VC proof), a
				<code>framework_id</code>, and optional <code>valid_from</code> / <code>valid_until</code> timestamps.
			</p>
		</div>
	</div>

	<h3>Relationship Types</h3>
	<div class="overflow-x-auto my-4">
		<table>
			<thead>
				<tr><th>Relationship</th><th>Description</th><th>Example</th></tr>
			</thead>
			<tbody>
				<tr
					><td><code>issuer</code></td><td>Credential issuer → subject</td><td
						>NANDA node issues VC to agent</td
					></tr
				>
				<tr
					><td><code>verifier</code></td><td>Verifier trusts issuer</td><td
						>Consumer trusts NANDA node's credentials</td
					></tr
				>
				<tr
					><td><code>peer</code></td><td>Bidirectional peer trust</td><td
						>Two federated NANDA nodes</td
					></tr
				>
				<tr
					><td><code>endorser</code></td><td>Third-party endorsement</td><td
						>Audit body endorses agent compliance</td
					></tr
				>
			</tbody>
		</table>
	</div>

	<h2>API Endpoints</h2>
	<p>Trust framework and graph data are accessible via authenticated API endpoints:</p>
	<pre><code
			>GET /api/trust/framework              — List all registered frameworks
GET /api/trust/framework?id=kym-trust-v1  — Get specific framework
GET /api/trust/framework/graph?did=did:web:example  — Trust edges for a DID
GET /api/trust/framework/graph?from=did:A&amp;to=did:B  — Compute trust path</code
		></pre>
	<p>All endpoints require a valid <code>nanda_</code> API key via Bearer token authentication.</p>

	<h2>Standards Alignment</h2>
	<div class="grid md:grid-cols-3 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">ToIP TSWG</h4>
			<p class="text-sm text-nanda-text-muted">
				Trust Spanning Working Group — defines the Trust Spanning Protocol for cross-domain trust
				establishment.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">DIF Trust Graph</h4>
			<p class="text-sm text-nanda-text-muted">
				Joint ToIP/DIF initiative for modeling trust relationships as directed graphs with evidence
				and attestation.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">W3C VC</h4>
			<p class="text-sm text-nanda-text-muted">
				Verifiable Credentials Data Model v2.0 — the foundational standard for cryptographically
				verifiable claims.
			</p>
		</div>
	</div>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust">Trust &amp; Security</a> for Ed25519, VCs, and Bitstring Status List ·
		<a href="/docs/federation">Federation</a> for cross-node trust scores
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/series/agentic-web/trust-without-borders">Trust Without Borders</a> — cross-registry
		identity and trust in the Agentic Web series ·
		<a href="/series/agentic-web/governance-at-scale">Governance at Scale</a> — multi-stakeholder governance
		frameworks
	</div>
</div>
