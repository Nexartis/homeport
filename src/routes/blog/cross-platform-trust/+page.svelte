<script lang="ts">
	import { page } from '$app/state';
	import {
		Activity,
		Calendar,
		Clock,
		Shield,
		Network,
		Globe,
		Gauge,
		Lock,
		Eye
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title
		>Cross-Platform Trust Signals: How Reputation Flows Between KYM and NANDA | Blog — Homeport</title
	>
	<meta
		name="description"
		content="How trust data flows between KnowYourModel and NANDA — certification grades, observer reputation, and bidirectional dashboard controls for agent lifecycle management."
	/>
	<meta property="og:title" content="Cross-Platform Trust Signals — Homeport" />
	<meta
		property="og:description"
		content="How reputation data flows between KYM's trust registry and NANDA's discovery infrastructure."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/cross-platform-trust" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-cross-platform-trust.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-cross-platform-trust.png" />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-8">
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div class="flex items-center gap-3 mb-4">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2.5 py-0.5 text-[10px] font-medium text-nanda-success"
				>Published</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Calendar class="h-4 w-4" />February 2026</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Clock class="h-4 w-4" />8 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			Cross-Platform Trust Signals
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			How reputation data flows between KnowYourModel's trust registry and NANDA's discovery
			infrastructure — building a unified view of agent trustworthiness across platforms.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Network class="h-3 w-3" /> Ecosystem</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Shield class="h-3 w-3" /> Trust</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />The Two-Platform Trust Model
			</h2>
			<p>
				Trust in the agentic web isn't a single number — it's a composite of signals from different
				vantage points. <a href="https://knowyourmodel.ai" target="_blank" rel="noopener noreferrer"
					>KnowYourModel</a
				>
				evaluates agents through <strong>usage receipts and economic incentives</strong>:
				orchestrators submit Ed25519-signed proof-of-use, and trust scores reflect real-world
				performance. <a href="/">NANDA</a> evaluates agents through
				<strong>infrastructure observability</strong>: cron-triggered liveness probes, capability
				certification tests, and compliance checks.
			</p>
			<p>
				Neither signal alone tells the full story. An agent might have excellent KYM trust scores
				(users love it) but poor NANDA observer data (it's frequently offline). Or it might have
				perfect uptime but no usage history. The integration brings both signal types together into
				a single operational view.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Activity class="h-5 w-5 text-nanda-accent" />The /reputation Endpoint
			</h2>
			<p>
				The cornerstone of cross-platform trust is NANDA's <code>/reputation</code> REST endpoint — a
				read-only API that aggregates trust signals from the node's internal services and returns them
				in a single JSON response:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Gauge class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">Observer Reputation</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Weighted composite: <code
							>availability × 0.4 + probe_success × 0.4 + cert_score × 0.2 − fraud_rate × 0.1</code
						>, clamped to [0, 1]. Computed from persisted telemetry snapshots.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Shield class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Certification Grades</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Wilson confidence interval scoring from capability tests. Grades range from A+ (highest
						confidence) to F, each backed by a W3C Verifiable Credential.
					</p>
				</div>
			</div>
			<p>
				Critically, this endpoint reads from <strong>persisted snapshots</strong> — no expensive A2A computation
				or external calls are triggered per request. The Observer and Certifier services run on their
				own schedules (cron triggers and inline processing), and the reputation endpoint simply serves
				the latest results.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-primary" />Data Flow: NANDA → KYM
			</h2>
			<p>
				KYM's admin dashboard pulls NANDA reputation data through a proxy route at <code
					>/api/nanda/reputation</code
				>. The flow is straightforward:
			</p>
			<ol>
				<li>
					KYM admin UI calls <code>/api/nanda/reputation</code> (session-authenticated, admin-only)
				</li>
				<li>
					The proxy route instantiates <code>NandaClient</code> with the node URL from environment config
				</li>
				<li>
					<code>NandaClient.getReputationData()</code> fetches <code>/reputation</code> from the
					NANDA node with an <code>AbortController</code> timeout
				</li>
				<li>
					The response is parsed and mapped — NANDA agent IDs (prefixed <code>kym:</code>) are
					stripped to match KYM's internal entity IDs
				</li>
				<li>
					Cert grades and reputation scores are displayed inline in the admin table alongside KYM's
					own trust scores
				</li>
			</ol>
			<p>
				The result: a single admin view showing both <strong>"is this agent trustworthy?"</strong>
				(KYM) and <strong>"is this agent healthy?"</strong> (NANDA) — without the operator needing to
				check two dashboards.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Eye class="h-5 w-5 text-nanda-accent" />Bidirectional Controls
			</h2>
			<p>
				Trust signals flow in both directions, and so do the controls. From KYM's admin panel,
				operators can:
			</p>
			<ul>
				<li>
					<strong>View NANDA reputation</strong> — Cert grades and observer scores inline for every registered
					agent
				</li>
				<li>
					<strong>Deregister from NANDA</strong> — Remove an agent from the discovery network without
					leaving KYM's dashboard
				</li>
				<li>
					<strong>Search the NANDA Index</strong> — Query by capability, skill, or tag using KYM API key
					authentication
				</li>
				<li>
					<strong>Monitor registry health</strong> — Live stats card showing total agents, alive agents,
					and clients across the NANDA network
				</li>
			</ul>
			<p>
				From NANDA's side, cross-links point operators back to KYM for trust-specific operations:
				voting, usage receipt submission, and selection algorithm configuration. Each platform links
				to the other's relevant pages — not just the homepage, but the specific section where the
				action happens.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-nanda-primary-400" />Trust Portability
			</h2>
			<p>
				The deeper vision is <strong>trust that travels with the agent</strong>. KYM issues trust
				scores as W3C Verifiable Credentials — signed attestations that any NANDA participant can
				verify without trusting KYM's infrastructure directly. NANDA's certification grades follow
				the same pattern.
			</p>
			<p>
				This means an agent's reputation isn't locked into any single platform. A trust score earned
				through KYM usage receipts is verifiable by any node in the NANDA network. A certification
				grade issued by Nexartis's certifier is portable to any registry that understands W3C VCs.
				The platforms are independent but the trust signals are interoperable.
			</p>
			<div class="callout callout-tip">
				<strong>Explore the integration.</strong>
				See the <a href="/case-studies/kym-nanda-integration">KYM + NANDA Integration</a> case study
				for the full architecture, or the <a href="/blog/developer-api-keys">Developer API Keys</a>
				article for programmatic access. For the credential format, see
				<a href="/blog/agentfacts">AgentFacts</a>.
			</div>
		</section>

		<section class="mb-12 not-prose">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				References
			</h3>
			<ul class="space-y-2 text-sm text-nanda-text-muted">
				<li>
					<a
						href="https://www.w3.org/TR/vc-data-model-2.0/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">W3C Verifiable Credentials Data Model v2.0</a
					>
				</li>
				<li>
					<a
						href="https://knowyourmodel.ai"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">KnowYourModel — AI Trust Registry</a
					>
				</li>
			</ul>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/developer-api-keys" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Developer API Keys
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Programmatic access to the NANDA registry — tiers, scopes, and rate limits.
					</p>
				</a>
				<a href="/blog/agentfacts" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						AgentFacts Format
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How agent metadata is encoded as verifiable credentials.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
