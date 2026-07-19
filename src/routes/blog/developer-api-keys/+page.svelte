<script lang="ts">
	import { page } from '$app/state';
	import { Key, Calendar, Clock, Shield, Code, Lock, Layers, Zap, BookOpen } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Developer API Keys for Decentralized Infrastructure | Blog — Homeport</title>
	<meta
		name="description"
		content="Designing parallel API key systems for decentralized agent infrastructure — SHA-256 hashed storage, tiered rate limits, and Bearer auth across KYM and NANDA."
	/>
	<meta
		property="og:title"
		content="Developer API Keys for Decentralized Infrastructure — Homeport"
	/>
	<meta
		property="og:description"
		content="How KYM and NANDA implement parallel API key programs with SHA-256 hashed storage, tiered rate limits, and Bearer authentication."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/developer-api-keys" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-developer-api-keys.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-developer-api-keys.png" />
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
				><Clock class="h-4 w-4" />9 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			Developer API Keys for Decentralized Infrastructure
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			Designing parallel API key systems across two platforms — how KnowYourModel and NANDA
			implement complementary developer access with shared security patterns and distinct use cases.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Key class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Shield class="h-3 w-3" /> Security</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary" />The Access Problem
			</h2>
			<p>
				Decentralized infrastructure faces a paradox: the system is open by design, but <strong
					>programmatic access still needs authentication</strong
				>. Without API keys, you can't rate-limit abusive clients, track usage for billing, or
				distinguish between a developer building an integration and a bot scraping your registry.
			</p>
			<p>
				When <a href="https://knowyourmodel.ai" target="_blank" rel="noopener noreferrer"
					>KnowYourModel</a
				>
				(a trust registry) and <a href="/">NANDA</a> (a discovery protocol) needed developer
				programs, we faced an additional challenge: two platforms with overlapping audiences but
				distinct capabilities. A developer querying KYM's trust scores doesn't necessarily need
				NANDA discovery access, and vice versa. The solution: <strong>parallel key systems</strong> with
				a shared security architecture.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-accent" />Two Prefixes, One Architecture
			</h2>
			<p>
				Both platforms issue keys with distinct prefixes — <code>kym_</code> for KnowYourModel and
				<code>nanda_</code> for NANDA — making it immediately obvious which platform a key belongs to.
				Under the hood, the architecture is identical:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Key class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">
							KYM Keys (<code class="text-[10px]">kym_</code>)
						</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Trust registry operations: agent lookup, trust score queries, voting via usage receipts,
						selection algorithm access (Thompson Sampling, UCB1).
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Key class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">
							NANDA Keys (<code class="text-[10px]">nanda_</code>)
						</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Discovery infrastructure: agent search, list, registration, AgentFacts retrieval,
						federation status, reputation queries.
					</p>
				</div>
			</div>
			<p>
				The key insight: these programs <strong>complement rather than duplicate</strong>. A KYM key
				can search NANDA data through KYM's proxy routes (<code>/api/nanda/search</code>,
				<code>/api/nanda/list</code>), while a NANDA key accesses the discovery layer directly.
				Developers choose based on their use case — trust evaluation, agent discovery, or both.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-nanda-primary" />Security: SHA-256 + Bearer Auth
			</h2>
			<p>
				Both platforms follow the same security model, designed for zero-trust infrastructure
				running on Cloudflare Workers:
			</p>
			<ul>
				<li>
					<strong>Generation</strong> — Keys are generated as cryptographically random tokens (32
					bytes), prefixed with the platform identifier, and shown to the developer
					<strong>exactly once</strong>
				</li>
				<li>
					<strong>Storage</strong> — Only the SHA-256 hash of the key is persisted in D1. If the database
					is compromised, raw keys cannot be recovered
				</li>
				<li>
					<strong>Authentication</strong> — Keys are sent as <code>Bearer</code> tokens in the
					<code>Authorization</code>
					header. SvelteKit's <code>hooks.server.ts</code> middleware intercepts every request to API
					routes, hashes the provided token, and looks up the hash in the database
				</li>
				<li>
					<strong>Revocation</strong> — Keys can be revoked instantly via the management dashboard.
					The key's status is set to <code>revoked</code> in D1, and subsequent requests with that key
					fail immediately
				</li>
			</ul>
			<p>
				This pattern means neither platform ever stores a recoverable key — even Nexartis engineers
				cannot see a developer's raw API key after initial generation.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-nanda-accent" />Tiered Rate Limiting
			</h2>
			<p>
				Both platforms implement three-tier rate limiting with D1-backed per-key counters that reset
				monthly:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card overflow-x-auto">
					<table class="w-full text-sm">
						<thead
							><tr class="border-b border-nanda-border/40 text-left text-xs text-nanda-text-dim">
								<th class="pb-2 pr-4">Tier</th><th class="pb-2 pr-4">Rate Limit</th><th
									class="pb-2 pr-4">Use Case</th
								>
							</tr></thead
						>
						<tbody class="text-nanda-text-muted">
							<tr class="border-b border-nanda-border/20"
								><td class="py-2 pr-4 font-medium text-nanda-text">Free</td><td class="py-2 pr-4"
									><code>1,000 req/month</code></td
								><td class="py-2 pr-4">Prototyping, evaluation, small integrations</td></tr
							>
							<tr class="border-b border-nanda-border/20"
								><td class="py-2 pr-4 font-medium text-nanda-text">Pro</td><td class="py-2 pr-4"
									><code>10,000 req/month</code></td
								><td class="py-2 pr-4">Production applications, multi-agent systems</td></tr
							>
							<tr
								><td class="py-2 pr-4 font-medium text-nanda-text">Enterprise</td><td
									class="py-2 pr-4"><code>100,000 req/month</code></td
								><td class="py-2 pr-4">Infrastructure operators, registry federators</td></tr
							>
						</tbody>
					</table>
				</div>
			</div>
			<p>
				Rate limit state is stored in D1 alongside the key record. Each key tracks a monthly usage
				counter and a reset timestamp set to the first of the next month, so limits reset
				automatically without a cleanup job.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Code class="h-5 w-5 text-nanda-primary" />Developer Experience
			</h2>
			<p>
				Both platforms provide session-authenticated dashboards for key management — no API key
				required to manage your API keys. The flow is deliberately simple:
			</p>
			<ol>
				<li>
					Sign in to the <a href="/developers">Developer Portal</a> (NANDA) or
					<a
						href="https://knowyourmodel.ai/for/developers"
						target="_blank"
						rel="noopener noreferrer">Developer Page</a
					> (KYM)
				</li>
				<li>Navigate to the Key Management Dashboard</li>
				<li>Generate a key — it's shown once, with a copy-to-clipboard button</li>
				<li>Use the key as a <code>Bearer</code> token in API requests</li>
			</ol>
			<p>
				Both dashboards also display key metadata: creation date, tier, last used timestamp, and
				total request count. Revocation is a single click with immediate effect.
			</p>
			<div class="callout callout-tip">
				<strong>Getting started.</strong>
				For NANDA API access, visit the <a href="/developers/dashboard">Developer Dashboard</a>. For
				KYM trust registry access, see the
				<a href="https://knowyourmodel.ai/for/developers" target="_blank" rel="noopener noreferrer"
					>KYM developer page</a
				>. For the full endpoint reference, see the
				<a href="/docs/developers">API documentation</a>.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Design Principles
			</h2>
			<p>Several principles guided the design of both API key systems:</p>
			<ul>
				<li>
					<strong>Zero recoverable secrets</strong> — SHA-256 hashing means compromised databases don't
					leak keys
				</li>
				<li>
					<strong>Prefix-based routing</strong> — <code>kym_</code> vs <code>nanda_</code> makes misconfigurations
					immediately visible
				</li>
				<li>
					<strong>Edge-native rate limiting</strong> — D1-backed monthly counters enforced at the edge
					with automatic resets
				</li>
				<li>
					<strong>Complementary not competitive</strong> — Cross-platform proxy routes mean one key can
					serve multi-platform workflows
				</li>
				<li>
					<strong>Progressive access</strong> — Free tier is generous enough for real prototyping, not
					just "hello world" demos
				</li>
			</ul>
			<p>
				The result is a developer experience that feels like a single platform, even though it's
				built on two independent infrastructure stacks. Authentication patterns, dashboard
				conventions, and rate limit structures are all intentionally harmonized.
			</p>
		</section>

		<section class="mb-12 not-prose">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				References
			</h3>
			<ul class="space-y-2 text-sm text-nanda-text-muted">
				<li>
					<a
						href="https://knowyourmodel.ai"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">KnowYourModel — AI Trust Registry</a
					>
				</li>
				<li>
					<a
						href="https://datatracker.ietf.org/doc/html/rfc6750"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline"
						>RFC 6750 — The OAuth 2.0 Authorization Framework: Bearer Token Usage</a
					>
				</li>
			</ul>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/cross-platform-trust" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Cross-Platform Trust Signals
					</h4>
					<p class="text-xs text-nanda-text-dim">How reputation flows between KYM and NANDA.</p>
				</a>
				<a href="/blog/zero-trust-agents" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Zero Trust for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						ZTAA: enterprise-grade security for autonomous agents.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
