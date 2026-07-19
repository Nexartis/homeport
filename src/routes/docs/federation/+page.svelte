<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Federation — Homeport</title>
	<meta
		name="description"
		content="NANDA federation protocol — gossip-based peer registry sync, federated agent discovery, and multi-node coordination."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-federation.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-federation.png" />
</svelte:head>

<div class="prose">
	<h1>Federation</h1>
	<p>
		NANDA registries can <strong>federate</strong> — synchronizing agent listings across independent nodes
		so that agents registered on one node become discoverable on all connected peers.
	</p>

	<div class="callout callout-info">
		<strong>Pull-based model</strong>
		Federation uses a gossip-based sync model. Each node periodically fetches <code>GET /list</code>
		from its configured peers and upserts agents with <code>source = peerUrl</code> to distinguish local
		vs federated entries.
	</div>

	<h2>How It Works</h2>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-green-500">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-green-500 mb-2">Step 1</p>
			<h3 class="font-semibold mb-1">Peer Discovery</h3>
			<p class="text-sm text-nanda-text-muted">
				A registry is configured with one or more peer URLs via the <code
					>NANDA_FEDERATION_PEER_URL</code
				> environment variable. Each peer must expose the standard NANDA API.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-amber-500">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-2">Step 2</p>
			<h3 class="font-semibold mb-1">Sync Trigger</h3>
			<p class="text-sm text-nanda-text-muted">
				Sync is triggered via <code>POST /federation/sync</code> (uses the configured peer) or
				<code>POST /federation/sync-peer</code> (specify a custom peer URL). Both require admin authentication.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-nanda-primary mb-2">
				Step 3
			</p>
			<h3 class="font-semibold mb-1">Agent Upsert</h3>
			<p class="text-sm text-nanda-text-muted">
				The sync process fetches <code>GET /list</code> from the peer, then for each agent: inserts new
				agents or updates existing federated entries. Local agents (source = 'local') are never overwritten.
			</p>
		</div>
	</div>

	<h2>API Endpoints</h2>
	<div class="grid gap-3 my-6 not-prose">
		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-blue-500/20 text-blue-400"
					>POST</span
				>
				<code class="text-sm">/federation/sync</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				Trigger sync from the configured peer (<code>NANDA_FEDERATION_PEER_URL</code>). Requires
				<code>Authorization: Bearer $ADMIN_KEY</code>.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-blue-500/20 text-blue-400"
					>POST</span
				>
				<code class="text-sm">/federation/sync-peer</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				Sync from a specific peer URL provided in the request body. Requires admin authentication.
				Prevents SSRF via auth gate.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
					>GET</span
				>
				<code class="text-sm">/federation/agents</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				List all federated (non-local) agents, ordered by most recently updated.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
					>GET</span
				>
				<code class="text-sm">/federation/status</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				Returns per-peer sync status: agent count and last sync timestamp for each federated source.
			</p>
		</div>

		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-yellow-500/20 text-yellow-400"
					>POST</span
				>
				<code class="text-sm">/federation/gossip</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				CRDT gossip inbound endpoint. Receives and merges agent state from peer registries using
				LWW-Element-Set CRDTs. Requires admin authentication.
			</p>
		</div>

		<div class="nanda-card !py-3">
			<div class="flex items-center gap-2 mb-1">
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-bold font-mono bg-green-500/20 text-green-400"
					>GET</span
				>
				<code class="text-sm">/federation/peers</code>
			</div>
			<p class="text-xs text-nanda-text-muted">
				Returns all known federation peer registries with status and last sync time.
			</p>
		</div>
	</div>

	<h2>Sync Result</h2>
	<p>Each sync operation returns a result object:</p>
	<pre><code
			>&#123;
  "peerUrl": "https://peer-node.example.com",
  "imported": 12,
  "updated": 3,
  "errors": 0,
  "durationMs": 847
&#125;</code
		></pre>

	<h2>Data Model</h2>
	<p>
		Federated agents are stored in the same <code>agents</code> table as local agents. The
		<code>source</code> column distinguishes origin:
	</p>
	<ul>
		<li><code>source = 'local'</code> — registered directly on this node</li>
		<li>
			<code>source = 'https://peer.example.com'</code> — imported via federation sync from that peer URL
		</li>
	</ul>
	<p>
		During sync, only agents where <code>source</code> matches the peer URL are updated — local agents
		are never overwritten by federation.
	</p>

	<h2>Configuration</h2>
	<div class="grid md:grid-cols-3 gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">NANDA_FEDERATION_PEER_URL</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				URL of the default peer registry for <code>/federation/sync</code>
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">NANDA_FEDERATION_ADMIN_KEY</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Bearer token required for all sync endpoints — prevents unauthorized sync triggers
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">NANDA_NODE_ID</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Unique identifier for this node in the gossip protocol — used in peer registration and
				vector clocks
			</p>
		</div>
	</div>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/api">API Reference</a> for the full endpoint list ·
		<a href="/docs/trust">Trust &amp; Security</a> for credential verification across federated nodes
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/crdt-gossip">CRDTs &amp; Gossip Protocols</a> — how NANDA keeps federated
		registries in sync ·
		<a href="/blog/quilt-architecture">The Quilt Architecture</a> — federated overlays for agent
		discovery ·
		<a href="/series/agentic-web/trust-without-borders">Trust Without Borders</a> — cross-registry identity
		in the Agentic Web series
	</div>
</div>
