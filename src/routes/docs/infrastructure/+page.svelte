<script lang="ts">
	import { page } from '$app/state';
	import {
		ClipboardList,
		Award,
		Shield,
		Radio,
		Gem,
		Zap,
		Database,
		KeyRound,
		HardDrive,
		MessageSquare,
		Clock
	} from 'lucide-svelte';
</script>

<svelte:head>
	<title>Infrastructure — Homeport</title>
	<meta
		name="description"
		content="Technical infrastructure architecture — edge compute, relational database, object storage, secrets management, and the five-service architecture."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-infrastructure.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-infrastructure.png" />
</svelte:head>

<div class="prose">
	<h1>Infrastructure</h1>
	<p>
		The Homeport is built on a globally distributed edge architecture with zero cold starts. The
		platform is designed for high availability, low latency, and horizontal scalability.
	</p>

	<h2>Services</h2>
	<p>
		The platform started with the core NANDA infrastructure services below and now includes
		additional domain layers for federation, switchboard, orchestration, billing, and operator
		settings:
	</p>
	<div class="grid gap-4 my-6 not-prose">
		<a
			href="/docs/infrastructure/registry"
			class="nanda-card border-l-[3px] !border-l-nanda-accent block text-nanda-text no-underline hover:border-nanda-primary-500/40 transition-colors"
		>
			<div class="flex items-center gap-2.5 mb-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
				>
					<ClipboardList class="h-4 w-4 text-nanda-accent" />
				</div>
				<h3 class="font-semibold">Agent Registry</h3>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Decentralized agent registration, discovery, search, and AgentFacts metadata. The
				foundational service — all other services build on the registry.
			</p>
		</a>
		<a
			href="/docs/infrastructure/certifier"
			class="nanda-card border-l-[3px] !border-l-nanda-accent block text-nanda-text no-underline hover:border-nanda-primary-500/40 transition-colors"
		>
			<div class="flex items-center gap-2.5 mb-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
				>
					<Award class="h-4 w-4 text-nanda-accent" />
				</div>
				<h3 class="font-semibold">Capability Certifier</h3>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Confidence interval scoring with W3C Verifiable Credentials — multi-trial testing and
				cryptographic proof of agent capabilities.
			</p>
		</a>
		<a
			href="/docs/infrastructure/compliance"
			class="nanda-card border-l-[3px] !border-l-nanda-accent block text-nanda-text no-underline hover:border-nanda-primary-500/40 transition-colors"
		>
			<div class="flex items-center gap-2.5 mb-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
				>
					<Shield class="h-4 w-4 text-nanda-accent" />
				</div>
				<h3 class="font-semibold">Compliance Enforcer</h3>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Policy decision engine with PII redaction and regional routing rules — governance and
				compliance for registered agents.
			</p>
		</a>
		<a
			href="/docs/infrastructure/observer"
			class="nanda-card border-l-[3px] !border-l-nanda-accent block text-nanda-text no-underline hover:border-nanda-primary-500/40 transition-colors"
		>
			<div class="flex items-center gap-2.5 mb-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
				>
					<Radio class="h-4 w-4 text-nanda-accent" />
				</div>
				<h3 class="font-semibold">Observer Evaluator</h3>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Real-time telemetry, liveness probes, and reputation scoring — continuous monitoring and
				health assessment of the agent network.
			</p>
		</a>
		<a
			href="/docs/infrastructure/auditor"
			class="nanda-card border-l-[3px] !border-l-nanda-accent block text-nanda-text no-underline hover:border-nanda-primary-500/40 transition-colors"
		>
			<div class="flex items-center gap-2.5 mb-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-accent/10 shrink-0"
				>
					<Gem class="h-4 w-4 text-nanda-accent" />
				</div>
				<h3 class="font-semibold">Points Auditor</h3>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Payment intent reconciliation, settlement verification, and wallet management — the economic
				layer for agent interactions.
			</p>
		</a>
	</div>

	<h2>Platform Architecture</h2>
	<p>
		The infrastructure leverages multiple cloud primitives for a fully serverless, globally
		distributed architecture:
	</p>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1 flex items-center gap-2">
				<Zap class="h-4 w-4 text-nanda-accent" /> Edge Compute
			</h4>
			<p class="text-sm text-nanda-text-muted">
				V8 isolates at 300+ edge locations worldwide. Zero cold starts, automatic scaling, sub-50ms
				latency.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1 flex items-center gap-2">
				<Database class="h-4 w-4 text-nanda-accent" /> Relational Database
			</h4>
			<p class="text-sm text-nanda-text-muted">
				Distributed relational database covering agents, certificates, revocations, compliance,
				telemetry, and audit records.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1 flex items-center gap-2">
				<KeyRound class="h-4 w-4 text-nanda-accent" /> Key-Value Cache
			</h4>
			<p class="text-sm text-nanda-text-muted">
				Distributed key-value store for rate limiting, cached responses, and session data.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1 flex items-center gap-2">
				<HardDrive class="h-4 w-4 text-nanda-accent" /> Object Storage
			</h4>
			<p class="text-sm text-nanda-text-muted">
				S3-compatible object storage for certification evidence, test artifacts, and audit logs.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1 flex items-center gap-2">
				<MessageSquare class="h-4 w-4 text-nanda-accent" /> Inline Processing
			</h4>
			<p class="text-sm text-nanda-text-muted">
				Certification trials, liveness probes, and webhook delivery are processed inline with
				cron-triggered scheduling and authenticated HTTP endpoints.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1 flex items-center gap-2">
				<Clock class="h-4 w-4 text-nanda-accent" /> Scheduled Tasks
			</h4>
			<p class="text-sm text-nanda-text-muted">
				Scheduled handlers for periodic liveness probes, reputation updates, and federation
				synchronization.
			</p>
		</div>
	</div>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/api">API Reference</a> for the full endpoint list ·
		<a href="/docs/quickstart">Quickstart</a>
		to register your first agent · <a href="/docs/federation">Federation</a> for multi-node deployment
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/case-studies/nexartis-nanda-node">Homeport Case Study</a> — how the infrastructure
		subsystems work together in production ·
		<a href="/blog/building-agent-dns">Building Agent DNS</a> — architecture behind agent discovery at
		scale
	</div>
</div>
