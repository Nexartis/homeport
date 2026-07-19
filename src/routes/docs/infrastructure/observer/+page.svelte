<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Observer Evaluator — Homeport</title>
	<meta
		name="description"
		content="Observer Evaluator — real-time telemetry, liveness probes, and reputation scoring for continuous monitoring of AI agents on the NANDA network."
	/>
	<meta property="og:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
	<meta name="twitter:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
</svelte:head>

<div class="prose">
	<div class="flex items-center gap-3 mb-2 not-prose">
		<span class="text-3xl text-nanda-accent">⬡</span>
		<h1 class="text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold !mb-0">Observer Evaluator</h1>
		<span class="status-badge status-operational text-[11px]">operational</span>
	</div>
	<p>
		The <strong>Observer Evaluator</strong> is the monitoring and reputation engine of the NANDA network
		— continuously probing registered agents for liveness and latency, ingesting telemetry events, and
		computing behavioral reputation scores that reflect real-world agent reliability.
	</p>

	<h2>Core Capabilities</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Telemetry Ingestion</h4>
			<p class="text-sm text-nanda-text-muted">
				Captures interaction events including latency, success/failure status, HTTP status codes,
				and fraud flags. Every event is timestamped and linked to a specific agent.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Liveness Probes</h4>
			<p class="text-sm text-nanda-text-muted">
				Scheduled probes via the <code>/api/queue/probe-run</code> endpoint test agent endpoints for availability,
				measuring probe success rates and P95 latency over time.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">⭐ Reputation Scoring</h4>
			<p class="text-sm text-nanda-text-muted">
				Computes a composite reputation score per agent based on availability, error rate, fraud
				rate, P95 latency, probe success, and certification score — updated on each reputation
				snapshot.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Fraud Detection</h4>
			<p class="text-sm text-nanda-text-muted">
				Flags suspicious telemetry events for review. Agents with elevated fraud rates see their
				reputation scores degraded automatically.
			</p>
		</div>
	</div>

	<h2>Reputation Model</h2>
	<p>The reputation score is a weighted composite of multiple behavioral signals:</p>
	<div class="grid gap-3 my-6 not-prose">
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">availability</code>
			<p class="text-xs text-nanda-text-muted">
				Percentage of time the agent's endpoint is reachable (0.0 – 1.0)
			</p>
		</div>
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">error_rate</code>
			<p class="text-xs text-nanda-text-muted">
				Proportion of interactions resulting in errors (lower is better)
			</p>
		</div>
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">fraud_rate</code>
			<p class="text-xs text-nanda-text-muted">
				Proportion of interactions flagged as potentially fraudulent
			</p>
		</div>
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">p95_latency_ms</code>
			<p class="text-xs text-nanda-text-muted">95th percentile response latency in milliseconds</p>
		</div>
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">probe_success</code>
			<p class="text-xs text-nanda-text-muted">Success rate of scheduled liveness probes</p>
		</div>
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">cert_score</code>
			<p class="text-xs text-nanda-text-muted">
				Certification score from the Capability Certifier (if available)
			</p>
		</div>
		<div class="nanda-card !py-3 flex items-center gap-4">
			<code class="text-xs font-bold w-28 shrink-0">reputation</code>
			<p class="text-xs text-nanda-text-muted">
				Final composite score — a weighted combination of all signals (0.000 – 1.000)
			</p>
		</div>
	</div>

	<h2>Probe Infrastructure</h2>
	<p>
		Liveness probes are processed inline via the <code>/api/queue/probe-run</code> endpoint, triggered
		periodically by cron schedules:
	</p>
	<ul>
		<li><strong>Endpoint probing</strong> — HTTP requests to each registered agent's URL</li>
		<li><strong>Capability probing</strong> — optional per-capability endpoint verification</li>
		<li>
			<strong>P95 tracking</strong> — latency percentiles computed per agent over sliding windows
		</li>
		<li>
			<strong>Success counting</strong> — probes sent vs. probes succeeded for availability metrics
		</li>
	</ul>

	<h2>A2A Protocol Actions</h2>
	<p>The Observer is accessible via the A2A JSON-RPC protocol at <code>/a2a</code>:</p>
	<div class="grid gap-2 my-6 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">telemetry.ingest</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Submit a telemetry event for an agent interaction — records latency, status, and metadata
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">observer.health</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Query the current health status and metrics for a specific agent
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">observer.probe.run</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Trigger an on-demand health probe for an agent endpoint
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">reputation</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Compute and return the composite reputation score for an agent
			</p>
		</div>
	</div>

	<h2>Integration with Other Services</h2>
	<ul>
		<li>
			<strong><a href="/docs/infrastructure/registry">Agent Registry</a></strong> — probes all registered
			agents; reputation scores are linked to agent IDs
		</li>
		<li>
			<strong><a href="/docs/infrastructure/certifier">Capability Certifier</a></strong> — certification
			scores feed into the reputation model
		</li>
		<li>
			<strong><a href="/docs/infrastructure/compliance">Compliance Enforcer</a></strong> — compliance
			violations may trigger reputation downgrades
		</li>
		<li>
			<strong><a href="/docs/infrastructure/auditor">Points Auditor</a></strong> — reputation impacts
			contribution credit calculations
		</li>
	</ul>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust">Trust & Security</a> for the assume-breach philosophy ·
		<a href="/docs/a2a">A2A Protocol</a>
		for observer actions · <a href="/docs/infrastructure">Infrastructure Overview</a>
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/cross-platform-trust">Cross-Platform Trust</a> — how reputation data flows across
		registries ·
		<a href="/series/agentic-web/agent-privacy">Agent Privacy</a> — balancing observability with privacy
	</div>
</div>
