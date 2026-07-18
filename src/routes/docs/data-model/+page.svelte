<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Data Model — Homeport</title>
	<meta
		name="description"
		content="53-table Drizzle ORM schema across 21 domains — complete reference for the NANDA node data architecture."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-data-model.png" />
</svelte:head>

<div class="prose">
	<h1>Data Model Reference</h1>
	<p>
		The NANDA node stores all state in a <strong>Cloudflare D1</strong> database using
		<strong>Drizzle ORM</strong>. The current schema contains
		<strong>56 Drizzle table definitions</strong>
		across the node's service domains.
	</p>

	<h2>Domain Map</h2>
	<table>
		<thead><tr><th>Domain</th><th>Tables</th><th>Description</th></tr></thead>
		<tbody>
			<tr
				><td><strong>Registry</strong></td><td>agents, agent_facts, clients</td><td
					>Core agent registration, metadata, API keys</td
				></tr
			>
			<tr
				><td><strong>Certifier</strong></td><td
					>cert_jobs, trial_results, certificates, cert_revocations</td
				><td>Automated certification pipeline</td></tr
			>
			<tr
				><td><strong>Compliance</strong></td><td
					>compliance_decisions, violations, policies, scan_runs</td
				><td>Policy evaluation and enforcement</td></tr
			>
			<tr
				><td><strong>Observer</strong></td><td
					>probe_runs, reputation_snapshots, telemetry_events</td
				><td>Health monitoring and reputation scoring</td></tr
			>
			<tr
				><td><strong>Auditor</strong></td><td
					>audit_intents, settlements, reconciliations, wallets</td
				><td>Payment verification and financial audit</td></tr
			>
			<tr
				><td><strong>Trust</strong></td><td
					>federation_trust_scores, cross_registry_scores, behavior_metrics</td
				><td>Cross-registry trust framework</td></tr
			>
			<tr
				><td><strong>Trust Framework</strong></td><td>trust_framework_meta, trust_graph_edges</td
				><td>ToIP alignment and trust graphs</td></tr
			>
			<tr
				><td><strong>Webhooks</strong></td><td>webhook_subscriptions</td><td
					>Event notification subscriptions</td
				></tr
			>
			<tr
				><td><strong>Versioning</strong></td><td>agent_versions</td><td>Agent version history</td
				></tr
			>
			<tr
				><td><strong>UCP</strong></td><td>ucp_checkout_sessions</td><td
					>Universal Checkout Protocol sessions</td
				></tr
			>
			<tr
				><td><strong>Billing</strong></td><td>billing_periods, billing_line_items</td><td
					>Usage metering and billing cycles</td
				></tr
			>
			<tr
				><td><strong>Revenue Sharing</strong></td><td>revenue_splits, shares, settlements</td><td
					>Developer revenue distribution</td
				></tr
			>
			<tr
				><td><strong>Multi-Currency</strong></td><td>currencies</td><td
					>Supported currencies and exchange rates</td
				></tr
			>
			<tr
				><td><strong>Subscriptions</strong></td><td>subscriptions, subscription_events</td><td
					>Plan-based billing</td
				></tr
			>
			<tr
				><td><strong>Invoices</strong></td><td>invoices, invoice_sequence</td><td
					>Sequential invoice generation</td
				></tr
			>
			<tr
				><td><strong>Lean Index</strong></td><td>agent_addrs</td><td
					>DNS-like AgentAddr records with Ed25519 signatures</td
				></tr
			>
			<tr
				><td><strong>Resolver</strong></td><td>resolution_log, protocol_adapters</td><td
					>Adaptive resolution and protocol bridging</td
				></tr
			>
			<tr
				><td><strong>Federation v2</strong></td><td>federation_peers, gossip_log, quilt_routes</td
				><td>CRDT gossip and peer management</td></tr
			>
			<tr
				><td><strong>Orchestration</strong></td><td
					>workflows, steps, runs, step_runs, patterns, delegation_tasks, routing_decisions, events,
					conflict_resolutions</td
				><td>Multi-agent workflow engine</td></tr
			>
			<tr
				><td><strong>Developer Keys</strong></td><td>developer_keys</td><td
					>API key management for developers</td
				></tr
			>
			<tr
				><td><strong>Site Visitors</strong></td><td>site_visitors</td><td
					>Anonymous visitor tracking</td
				></tr
			>
		</tbody>
	</table>

	<h2>Key Relationships</h2>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-violet-500">
			<h3 class="font-semibold mb-1">agents → agent_facts</h3>
			<p class="text-sm text-nanda-text-muted">
				One-to-one. Each agent has a single AgentFacts document stored as JSON text. Facts URL can
				point to an external /.well-known/agent-facts.json.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-green-500">
			<h3 class="font-semibold mb-1">agents → certificates → cert_revocations</h3>
			<p class="text-sm text-nanda-text-muted">
				One-to-many. Each agent can have multiple certificates; each cert can be revoked. Bitstring
				Status List tracks revocation state.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-amber-500">
			<h3 class="font-semibold mb-1">workflows → steps → runs → step_runs</h3>
			<p class="text-sm text-nanda-text-muted">
				Hierarchical. A workflow has ordered steps (DAG). Each run produces step_runs tracking
				individual step execution with input/output and status.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-blue-500">
			<h3 class="font-semibold mb-1">federation_peers → gossip_log → quilt_routes</h3>
			<p class="text-sm text-nanda-text-muted">
				Peers exchange gossip messages. CRDT merge entries are logged. Quilt routes define optimized
				gossip topology.
			</p>
		</div>
	</div>

	<h2>Schema Source</h2>
	<p>
		The complete schema is defined in <code>src/lib/db/schema.ts</code> using Drizzle ORM's
		<code>sqliteTable</code> builder. Migrations are hand-written SQL in
		<code>drizzle/migrations/</code> (0000–0020).
	</p>

	<h2>Standards Referenced</h2>
	<ul>
		<li>
			<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
				>W3C Verifiable Credentials v2.0</a
			> — credential format for agent_facts and certificates
		</li>
		<li>
			<a href="https://datatracker.ietf.org/doc/html/rfc8032" target="_blank" rel="noopener"
				>RFC 8032 — Ed25519</a
			> — signing algorithm for AgentAddr records and credentials
		</li>
		<li>
			<a href="https://trustoverip.org/" target="_blank" rel="noopener">Trust over IP Foundation</a> —
			governance model behind trust_framework_meta and trust_graph_edges
		</li>
		<li>
			<a
				href="https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type"
				target="_blank"
				rel="noopener">CRDTs (Conflict-free Replicated Data Types)</a
			> — merge semantics for gossip_log federation entries
		</li>
	</ul>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/building-agent-dns">Building Agent DNS</a> — how the data model powers agent
		discovery at scale ·
		<a href="/blog/crdt-gossip">CRDTs &amp; Gossip Protocols</a> — federation data merge semantics in
		detail
	</div>
</div>
