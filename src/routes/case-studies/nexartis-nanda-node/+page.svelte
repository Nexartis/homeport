<script lang="ts">
	import { page } from '$app/state';
	import {
		Globe,
		Calendar,
		Clock,
		Server,
		Shield,
		Zap,
		Database,
		Network,
		Lock,
		ArrowRight,
		Key,
		Activity
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Homeport | Case Study — Homeport</title>
	<meta
		name="description"
		content="How Nexartis deployed a five-service NANDA node on Cloudflare Workers — global edge distribution with D1, KV, R2, and Secrets Store, plus a developer API key program."
	/>
	<meta property="og:title" content="Homeport | Case Study" />
	<meta property="og:url" content="{page.data.registryUrl}/case-studies/nexartis-nanda-node" />
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/case-studies-nexartis-nanda-node.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/case-studies-nexartis-nanda-node.png"
	/>
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-8">
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div class="flex items-center gap-3 mb-4">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2.5 py-0.5 text-[10px] font-medium text-nanda-success"
				>Live</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Calendar class="h-4 w-4" />February 2026</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Clock class="h-4 w-4" />8 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">Homeport</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			A five-service NANDA implementation running on Cloudflare Workers — from agent registration
			and discovery to federation sync and compliance, deployed at 300+ edge locations worldwide.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Globe class="h-3 w-3" /> Case Study</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Server class="h-3 w-3" /> Infrastructure</span
			>
		</div>
	</header>

	<!-- Stats -->
	<section
		class="mb-12 grid gap-4 sm:grid-cols-4 not-prose"
		in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
	>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">5</div>
			<div class="text-sm text-nanda-text-muted">Infrastructure Services</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">17</div>
			<div class="text-sm text-nanda-text-muted">Database Tables</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">3</div>
			<div class="text-sm text-nanda-text-muted">API Key Tiers</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">300+</div>
			<div class="text-sm text-nanda-text-muted">Edge Locations</div>
		</div>
	</section>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />The Challenge
			</h2>
			<p>
				Project NANDA defines the protocol for decentralized AI agent discovery, but the protocol
				needs <strong>reference implementations</strong> — real, running nodes that prove the
				architecture works at production scale. Nexartis set out to build the first TypeScript
				implementation of a full NANDA node, with a key constraint: <em>zero-ops infrastructure</em> that
				could scale globally without managing servers.
			</p>
			<p>
				The requirements were demanding: support all five NANDA services (registry, certifier,
				compliance, observer, points auditor), implement federation for multi-node sync, handle
				cryptographic operations for Ed25519-signed AgentFacts, and serve both API consumers and a
				full documentation site — all from a single deployment artifact.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Server class="h-5 w-5 text-nanda-accent" />The Solution: Cloudflare Workers
			</h2>
			<p>
				The Nexartis NANDA node runs as a <strong
					>SvelteKit 5 application compiled for Cloudflare Workers</strong
				>
				via <code>@sveltejs/adapter-cloudflare</code>. This gives us V8 isolates at every edge
				location — zero cold starts, automatic scaling, and sub-50ms response times globally.
			</p>
			<p>The architecture leverages the full Cloudflare platform:</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Database class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">D1 Database</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						SQLite-based relational store with 17 tables covering agents, certificates, revocations,
						compliance checks, telemetry, federation peers, and audit records.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Zap class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">KV Namespace</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						<code>NANDA_NODE_CACHE</code> — key-value store for rate limiting, cached agent lookups, and
						session state. Sub-millisecond reads at the edge.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Shield class="h-5 w-5 text-nanda-primary-400" />
						<h4 class="font-semibold text-nanda-text text-sm">R2 Object Storage</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						<code>KYM_NANDA_EVIDENCE</code> — S3-compatible storage for certification evidence, test artifacts,
						and immutable audit logs.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Network class="h-5 w-5 text-nanda-success" />
						<h4 class="font-semibold text-nanda-text text-sm">Secrets Store</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Cloudflare Secrets Store for HMAC keys, Ed25519 signing keys, and federation admin
						credentials — accessed via <code>resolveSecret()</code>.
					</p>
				</div>
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary" />Core Services and Domain Layers, One Worker
			</h2>
			<p>
				Instead of deploying separate microservices for every concern, the Nexartis node implements
				NANDA's core services plus newer federation, switchboard, billing, and orchestration layers
				within a single Cloudflare Worker. SvelteKit's file-based routing maps API endpoints cleanly
				to service boundaries:
			</p>
			<ul>
				<li>
					<strong>Agent Registry</strong> — <code>/register</code>, <code>/lookup</code>,
					<code>/search</code>, <code>/list</code>, <code>/agentfacts</code>, <code>/stats</code> — the
					foundational discovery layer
				</li>
				<li>
					<strong>Capability Certifier</strong> — Wilson confidence interval scoring with W3C
					Verifiable Credentials and <code>/credentials/status</code> for revocation checks
				</li>
				<li>
					<strong>Compliance Enforcer</strong> — Policy decision engine with PII redaction and regional
					routing rules
				</li>
				<li>
					<strong>Observer Evaluator</strong> — Cron-triggered liveness probes via
					<code>/health</code> and agent telemetry collection
				</li>
				<li>
					<strong>Points Auditor</strong> — Payment intent reconciliation and settlement verification
				</li>
			</ul>
			<p>
				The build chain extends SvelteKit with post-build injection scripts that add a <code
					>scheduled()</code
				>
				handler to the compiled worker — enabling Cloudflare's cron event triggers without framework modifications.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />Federation & Security
			</h2>
			<p>
				The node implements NANDA's <a href="/blog/quilt-architecture">Quilt federation protocol</a>
				with gossip-based peer synchronization. Federation endpoints (<code>/federation/sync</code>,
				<code>/federation/agents</code>, <code>/federation/status</code>) allow peer nodes to
				discover and sync agent records across the network.
			</p>
			<p>Security is enforced at every layer:</p>
			<ul>
				<li>
					<strong>Rate limiting</strong> via KV-backed counters on all API routes — configurable per endpoint,
					per IP
				</li>
				<li>
					<strong>CORS</strong> — global CORS headers applied via SvelteKit server hooks for cross-origin
					agent communication
				</li>
				<li>
					<strong>Admin authentication</strong> — federation write endpoints require bearer token verification
				</li>
				<li>
					<strong>A2A protocol support</strong> — the <code>/a2a</code> endpoint handles JSON-RPC
					2.0 agent-to-agent communication per the
					<a href="/blog/nanda-a2a-mcp">A2A specification</a>
				</li>
			</ul>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Key class="h-5 w-5 text-nanda-primary" />Developer Program
			</h2>
			<p>
				The Nexartis node includes a full developer API key program, giving external developers
				programmatic access to the NANDA discovery infrastructure:
			</p>
			<ul>
				<li>
					<strong>Developer Portal</strong> (<a href="/developers"><code>/developers</code></a>) —
					Feature overview, quickstart guide, and tier comparison for prospective developers
				</li>
				<li>
					<strong>Key Management Dashboard</strong> (<a href="/developers/dashboard"
						><code>/developers/dashboard</code></a
					>) — Session-authenticated interface to generate, view, and revoke API keys
				</li>
				<li>
					<strong>Three-Tier Rate Limiting</strong> — Free (1,000 req/month), Pro (10,000 req/month),
					Enterprise (100,000 req/month) with per-key D1-backed counters that reset monthly
				</li>
				<li>
					<strong>API Documentation</strong> (<a href="/docs/developers"
						><code>/docs/developers</code></a
					>) — Complete reference including authentication, endpoints, and code examples
				</li>
			</ul>
			<p>
				Keys use the <code>nanda_</code> prefix and SHA-256 hashed storage — only the key holder
				ever sees the raw token. Bearer authentication is enforced in the SvelteKit
				<code>hooks.server.ts</code> middleware, with rate limits checked per-key on every API route.
			</p>
			<div class="callout callout-info">
				<strong>Cross-platform access.</strong>
				Developers with a
				<a href="https://knowyourmodel.ai" target="_blank" rel="noopener noreferrer"
					>KnowYourModel</a
				>
				API key can also query NANDA data through KYM's proxy routes — the platforms share a harmonized
				developer experience. See the
				<a href="/blog/developer-api-keys">Developer API Keys</a> blog post for the full design rationale.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 700 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Activity class="h-5 w-5 text-nanda-accent" />Runtime Reputation
			</h2>
			<p>
				Beyond static registration, the node computes and exposes runtime trust signals via the <code
					>/reputation</code
				> REST endpoint. This aggregates data from two sources:
			</p>
			<ul>
				<li>
					<strong>Observer Evaluator</strong> — Cron-triggered liveness probes compute a weighted reputation
					score: availability × 0.3 + probe success × 0.3 + certification score × 0.3 − fraud rate × 0.1
				</li>
				<li>
					<strong>Capability Certifier</strong> — Wilson confidence interval grades (A+ through F) from
					capability test results, stored as W3C Verifiable Credentials
				</li>
			</ul>
			<p>
				The <code>/reputation</code> endpoint returns both data sets in a single JSON response, designed
				for consumption by partner platforms like KYM's admin dashboard. All data is read from persisted
				snapshots — no expensive A2A computation is triggered per request.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 800 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-nanda-primary-400" />Three-Environment Pipeline
			</h2>
			<p>
				The deployment pipeline mirrors enterprise best practices with three isolated environments,
				each with its own Cloudflare bindings:
			</p>
			<div class="not-prose grid gap-3 my-6">
				<div class="nanda-card !py-3 flex items-center gap-3">
					<span
						class="inline-block rounded-full bg-nanda-success/20 px-2 py-0.5 text-[10px] font-medium text-nanda-success"
						>dev</span
					>
					<code class="text-sm text-nanda-text">nanda-dev.nexartis.com</code>
					<span class="text-xs text-nanda-text-dim ml-auto">Development &amp; testing</span>
				</div>
				<div class="nanda-card !py-3 flex items-center gap-3">
					<span
						class="inline-block rounded-full bg-nanda-primary/20 px-2 py-0.5 text-[10px] font-medium text-nanda-primary"
						>test</span
					>
					<code class="text-sm text-nanda-text">nanda-test.nexartis.com</code>
					<span class="text-xs text-nanda-text-dim ml-auto">Staging &amp; integration</span>
				</div>
				<div class="nanda-card !py-3 flex items-center gap-3">
					<span
						class="inline-block rounded-full bg-nanda-accent/20 px-2 py-0.5 text-[10px] font-medium text-nanda-accent"
						>prod</span
					>
					<code class="text-sm text-nanda-text">nanda.nexartis.com</code>
					<span class="text-xs text-nanda-text-dim ml-auto">Production</span>
				</div>
			</div>
			<div class="callout callout-tip">
				<strong>Open source.</strong>
				The Nexartis NANDA node serves as a reference implementation for anyone building NANDA infrastructure.
				See the <a href="/docs/infrastructure">infrastructure docs</a> for the full architecture, or
				the <a href="/docs/quickstart">quickstart guide</a> to register your first agent.
			</div>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-3">
				<a href="/case-studies/kym-nanda-integration" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						KYM + NANDA Integration
					</h4>
					<p class="text-xs text-nanda-text-dim">Agent lifecycle management across platforms.</p>
				</a>
				<a href="/blog/developer-api-keys" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Developer API Keys
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Designing parallel key systems for decentralized infrastructure.
					</p>
				</a>
				<a href="/blog/nest-quickstart" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						NEST Quickstart
					</h4>
					<p class="text-xs text-nanda-text-dim">Deploy your first agent with the NANDA testbed.</p>
				</a>
			</div>
		</section>
	</div>
</article>
