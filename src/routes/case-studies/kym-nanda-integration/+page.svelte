<script lang="ts">
	import { page } from '$app/state';
	import {
		Network,
		Calendar,
		Clock,
		Shield,
		Zap,
		Lock,
		Globe,
		FileCheck,
		ArrowRight,
		KeyRound,
		Activity,
		Gauge,
		LayoutDashboard,
		Key
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>KYM + NANDA Integration | Case Study — Homeport</title>
	<meta
		name="description"
		content="How KnowYourModel's trust registry and NANDA's agent discovery combine for end-to-end agent lifecycle management — registration, certification, discovery, runtime trust scoring, and cross-platform developer tools."
	/>
	<meta property="og:title" content="KYM + NANDA Integration | Case Study" />
	<meta property="og:url" content="{page.data.registryUrl}/case-studies/kym-nanda-integration" />
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/case-studies-kym-nanda-integration.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/case-studies-kym-nanda-integration.png"
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
				><Clock class="h-4 w-4" />10 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">KYM + NANDA Integration</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			How KnowYourModel's trust registry and NANDA's agent discovery protocol combine to deliver
			end-to-end agent lifecycle management — from ingestion and quality gating to global discovery,
			runtime trust scoring, and unified developer tools.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Network class="h-3 w-3" /> Case Study</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary/10 px-2.5 py-1 text-xs font-medium text-nanda-primary"
				><Shield class="h-3 w-3" /> Trust</span
			>
		</div>
	</header>

	<!-- Stats -->
	<section
		class="mb-12 grid gap-4 sm:grid-cols-5 not-prose"
		in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
	>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">7</div>
			<div class="text-sm text-nanda-text-muted">Lifecycle Phases</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">2</div>
			<div class="text-sm text-nanda-text-muted">W3C VC Types</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">9</div>
			<div class="text-sm text-nanda-text-muted">Provider Adapters</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">3</div>
			<div class="text-sm text-nanda-text-muted">API Key Tiers</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl font-bold gradient-text mb-1">6</div>
			<div class="text-sm text-nanda-text-muted">REST Endpoints</div>
		</div>
	</section>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />Two Halves of One Problem
			</h2>
			<p>
				The agentic web has a split-brain problem. <strong>NANDA</strong> answers
				<em>"this agent exists"</em>
				— a decentralized protocol for agent discovery, registry federation, and addressing.
				<strong>KnowYourModel</strong>
				answers <em>"this agent is trustworthy"</em> — a trust registry with cryptographic usage receipts,
				adaptive selection algorithms, and economic quality incentives.
			</p>
			<p>
				Neither platform alone solves the full agent lifecycle. An agent needs to be <strong
					>discovered</strong
				>
				(NANDA) and <strong>trusted</strong> (KYM). The integration brings both halves together: KYM
				becomes a <strong>Trust Credential Authority</strong> within the NANDA ecosystem, issuing portable
				W3C Verifiable Credentials that any participant in the network can verify.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-accent" />The Agent Lifecycle Pipeline
			</h2>
			<p>
				KYM implements a gated publication pipeline — an "App Store" model for agents. Every agent
				must pass quality gates before appearing on the NANDA network:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card overflow-x-auto">
					<div class="flex items-center gap-2 min-w-max text-xs">
						<span
							class="rounded-md bg-nanda-bg px-2 py-1 border border-nanda-border text-nanda-text-muted"
							>draft</span
						>
						<ArrowRight class="h-3 w-3 text-nanda-text-dim shrink-0" />
						<span
							class="rounded-md bg-nanda-bg px-2 py-1 border border-nanda-border text-nanda-text-muted"
							>testing</span
						>
						<ArrowRight class="h-3 w-3 text-nanda-text-dim shrink-0" />
						<span
							class="rounded-md bg-nanda-bg px-2 py-1 border border-nanda-border text-nanda-text-muted"
							>review</span
						>
						<ArrowRight class="h-3 w-3 text-nanda-text-dim shrink-0" />
						<span
							class="rounded-md bg-nanda-primary/20 px-2 py-1 border border-nanda-primary/40 text-nanda-primary font-medium"
							>staging</span
						>
						<ArrowRight class="h-3 w-3 text-nanda-text-dim shrink-0" />
						<span
							class="rounded-md bg-nanda-success/20 px-2 py-1 border border-nanda-success/40 text-nanda-success font-medium"
							>published</span
						>
					</div>
					<p class="text-xs text-nanda-text-dim mt-3">
						NANDA registration triggers at <strong class="text-nanda-primary">staging</strong> — agents
						must pass name, description, skill, version, and type gates first.
					</p>
				</div>
			</div>
			<p>
				Each transition enforces specific quality gates: <code>draft → testing</code> requires a
				name, description, and at least one skill. <code>testing → review</code> requires a version.
				<code>review → staging</code>
				validates the entity type and non-negative trust score. Only at <code>staging</code> does
				NANDA registration fire — and the agent must be successfully registered before advancing to
				<code>published</code>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<KeyRound class="h-5 w-5 text-nanda-primary" />Decentralized Identity & Credentials
			</h2>
			<p>
				Every agent registered through KYM receives a <a
					href="https://www.w3.org/TR/did-1.0/"
					target="_blank"
					rel="noopener noreferrer">W3C DID</a
				>
				— <code>did:web:knowyourmodel.ai:agents:&#123;id&#125;</code> — a globally resolvable
				identifier that any system on the internet can verify. KYM then issues two types of
				<a href="/blog/agentfacts">W3C Verifiable Credentials</a>:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<FileCheck class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">AgentFacts Credential</h4>
					</div>
					<p class="text-xs text-nanda-text-muted mb-2">
						Full agent metadata — name, capabilities, skills, trust score, git verification status.
						Signed with Ed25519 and refreshed every <strong>24 hours</strong>.
					</p>
					<code class="text-[10px] text-nanda-text-dim">KYMAgentFactsCredential</code>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Zap class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Trust Score Credential</h4>
					</div>
					<p class="text-xs text-nanda-text-muted mb-2">
						Lightweight real-time attestation of the agent's current trust score. Refreshed every <strong
							>5 minutes</strong
						> for near-real-time trust signals.
					</p>
					<code class="text-[10px] text-nanda-text-dim">KYMTrustScoreCredential</code>
				</div>
			</div>
			<p>
				Both credential types use <strong>EdDSA</strong> proofs with
				<a
					href="https://www.w3.org/TR/vc-bitstring-status-list/"
					target="_blank"
					rel="noopener noreferrer">Bitstring Status List</a
				>
				revocation. Credentials are portable — any NANDA participant can fetch an agent's
				<code>/facts</code> endpoint and cryptographically verify the claims without trusting KYM's server
				infrastructure.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />Bidirectional Sync
			</h2>
			<p>The integration operates in two directions:</p>
			<ul>
				<li>
					<strong>Outbound</strong> — KYM's <code>NandaClient</code> registers agents with the NANDA
					Index when they reach the <code>staging</code> lifecycle phase. Each registration builds
					an <code>AgentAddr</code> record containing the agent's ID, URL, API endpoint, and AgentFacts
					URL, optionally signed with Ed25519.
				</li>
				<li>
					<strong>Inbound</strong> — The <code>kym-sync-worker</code> runs a dedicated NANDA adapter
					that performs two-phase discovery: first paginating the NANDA <code>/list</code> endpoint
					to discover agents, then enriching each record with AgentFacts metadata from the agent's
					<code>facts_url</code>.
				</li>
			</ul>
			<p>
				This bidirectional flow means agents registered anywhere in the NANDA network can be
				discovered and evaluated by KYM's trust infrastructure, while KYM-curated agents gain global
				visibility across every NANDA-compatible registry.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Activity class="h-5 w-5 text-nanda-primary-400" />Runtime Trust Signals
			</h2>
			<p>
				Trust doesn't stop at registration. The NANDA node exposes a dedicated <code
					>/reputation</code
				> REST endpoint that aggregates real-time trust signals from both platforms into a single response:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Gauge class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">Observer Reputation</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Weighted composite of availability, probe success, certification score, and fraud rate —
						clamped to [0, 1]. Computed from cron-triggered liveness probes and telemetry
						collection.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Shield class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Certification Grades</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Wilson confidence interval scoring (A+ through F) based on capability test results. Each
						grade carries a W3C Verifiable Credential with Bitstring Status List revocation.
					</p>
				</div>
			</div>
			<p>
				KYM's admin dashboard pulls this data via its <code>/api/nanda/reputation</code> proxy
				route, displaying cert grade badges and reputation scores inline for every registered agent.
				This gives operators a <strong>single-pane view</strong> of both KYM trust scores and NANDA infrastructure
				health — without switching between platforms.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 700 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<LayoutDashboard class="h-5 w-5 text-nanda-accent" />Cross-Platform Dashboard Controls
			</h2>
			<p>
				The integration goes beyond read-only data sharing. KYM's admin panel now provides full <strong
					>lifecycle controls</strong
				> for NANDA-registered agents:
			</p>
			<ul>
				<li>
					<strong>Deregister</strong> — Remove an agent from the NANDA Index directly from KYM's admin
					UI, without logging into the NANDA node separately
				</li>
				<li>
					<strong>Registry Stats</strong> — Live card showing total registered agents, alive agents, and
					total clients across the NANDA network
				</li>
				<li>
					<strong>Search & Filter</strong> — Query the NANDA Index by capability, skill, or tag using
					KYM API key authentication or session auth
				</li>
				<li>
					<strong>Cross-links</strong> — One-click navigation between platforms: "View on NANDA Node"
					from KYM, "Manage in KnowYourModel" from NANDA
				</li>
			</ul>
			<p>
				Six dedicated KYM API routes (<code>/api/nanda/health</code>,
				<code>/api/nanda/deregister</code>, <code>/api/nanda/registry-stats</code>,
				<code>/api/nanda/search</code>, <code>/api/nanda/list</code>,
				<code>/api/nanda/reputation</code>) proxy requests to the NANDA node with proper auth guards
				— admin-only for write operations, API Key OR session for search.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 800 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Key class="h-5 w-5 text-nanda-primary" />Developer API Key Programs
			</h2>
			<p>
				Both platforms now offer parallel API key programs that share a common architecture but
				serve distinct use cases:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<KeyRound class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">
							KYM Keys (<code class="text-[10px]">kym_</code>)
						</h4>
					</div>
					<p class="text-xs text-nanda-text-muted mb-2">
						Trust registry access — agent lookup, voting, usage receipt submission, selection
						algorithms. Three tiers: Free (1,000 req/month), Pro (10,000 req/month), Enterprise
						(100,000 req/month).
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<KeyRound class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">
							NANDA Keys (<code class="text-[10px]">nanda_</code>)
						</h4>
					</div>
					<p class="text-xs text-nanda-text-muted mb-2">
						Discovery infrastructure — agent search, list, registration, AgentFacts retrieval. Three
						tiers: Free (1,000 req/month), Pro (10,000 req/month), Enterprise (100,000 req/month).
					</p>
				</div>
			</div>
			<p>
				Both systems use SHA-256 hashed storage, Bearer token authentication in middleware, and
				session-based key management dashboards. The parallel design means developers can use one or
				both platforms — an agent registered via KYM automatically gets NANDA discoverability, and
				NANDA-discovered agents can be evaluated through KYM's trust infrastructure.
			</p>
			<div class="callout callout-info">
				<strong>One identity, two platforms.</strong>
				A developer with a KYM API key can search the NANDA Index through KYM's proxy routes without needing
				a separate NANDA key. The platforms complement rather than duplicate each other.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 900 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-nanda-primary-400" />Usage Receipts & Trust Scoring
			</h2>
			<p>
				Trust in KYM isn't self-reported — it's <strong
					>earned through cryptographic usage proof</strong
				>. When an orchestrator like
				<a href="https://cubicube.com" target="_blank" rel="noopener noreferrer"
					>Cubicube's Pegasus</a
				> uses an agent, it submits an Ed25519-signed usage receipt to KYM. Each receipt includes the
				agent ID, task description, outcome, and timestamp — all signed by a registered orchestrator key.
			</p>
			<p>
				Receipts feed the voting system: a valid unused receipt is required to cast an upvote or
				downvote on an agent. This creates a <strong>proof-of-use</strong> mechanism that prevents
				Sybil attacks and ensures trust scores reflect real-world performance. The resulting trust
				signals are then packaged into W3C Verifiable Credentials and served via the agent's
				<code>/facts</code> endpoint — making them available to every node in the NANDA network.
			</p>
			<div class="callout callout-info">
				<strong>Trust portability.</strong>
				Because trust scores travel as signed VCs, an agent's reputation is not locked into any single
				registry. A trust score earned through KYM is verifiable by any NANDA participant — no API keys
				or platform accounts required.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 1000 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-nanda-success" />What This Enables
			</h2>
			<p>
				The KYM + NANDA integration creates a complete agent lifecycle that no single platform
				provides alone:
			</p>
			<ul>
				<li>
					<strong>Discover</strong> — Find agents by capability, skill, or tag across the entire NANDA
					network
				</li>
				<li>
					<strong>Evaluate</strong> — Check trust scores backed by cryptographic usage receipts, not self-reported
					claims
				</li>
				<li><strong>Verify</strong> — Validate W3C VCs without trusting any central authority</li>
				<li>
					<strong>Select</strong> — Use adaptive algorithms (Thompson Sampling, UCB1) to dynamically choose
					the best agent for each task
				</li>
				<li>
					<strong>Monitor</strong> — Real-time reputation and certification data via the
					<code>/reputation</code> API, surfaced directly in the KYM admin dashboard
				</li>
				<li>
					<strong>Manage</strong> — Full cross-platform controls: deregister, search, and inspect agents
					from either dashboard
				</li>
				<li>
					<strong>Audit</strong> — Full receipt trail with Ed25519 signatures for every agent interaction
				</li>
			</ul>
			<div class="callout callout-tip">
				<strong>Learn more.</strong>
				See the
				<a href="https://knowyourmodel.ai/docs/nanda" target="_blank" rel="noopener noreferrer"
					>KYM NANDA documentation</a
				>
				for integration details, or the <a href="/blog/agentfacts">AgentFacts specification</a> for
				the credential format. For developer API access, see the
				<a href="/developers">Developer Portal</a>
				or the <a href="/blog/developer-api-keys">API Keys deep-dive</a>.
			</div>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-3">
				<a href="/case-studies/nexartis-nanda-node" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Homeport
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Five-service implementation on Cloudflare Workers.
					</p>
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
				<a href="/blog/cross-platform-trust" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Cross-Platform Trust Signals
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How reputation data flows between KYM and NANDA.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
