<script lang="ts">
	import { page } from '$app/state';
	import {
		Package,
		Terminal,
		Rocket,
		KeyRound,
		BookOpen,
		Radio,
		Settings,
		Heart,
		ExternalLink,
		ShieldCheck,
		Network,
		Webhook,
		Wallet,
		Users
	} from 'lucide-svelte';

	const pkg = '@nexartis/homeport-sdk';
	const encoded = encodeURIComponent(pkg);
	const badges = [
		{
			alt: 'npm version',
			src: `https://img.shields.io/npm/v/${encoded}?style=flat-square&color=6942e6&labelColor=0b0b10`,
			href: `https://www.npmjs.com/package/${pkg}`
		},
		{
			alt: 'license',
			src: `https://img.shields.io/npm/l/${encoded}?style=flat-square&color=0cd3da&labelColor=0b0b10`,
			href: 'https://github.com/Nexartis/homeport-sdk/blob/prod/LICENSE'
		},
		{
			alt: 'bundle size',
			src: `https://img.shields.io/bundlephobia/minzip/${encoded}?style=flat-square&color=6942e6&labelColor=0b0b10&label=min%2Bgzip`,
			href: `https://bundlephobia.com/package/${pkg}`
		},
		{
			alt: 'provenance',
			src: 'https://img.shields.io/badge/npm-provenance-0cd3da?style=flat-square&labelColor=0b0b10&logo=npm',
			href: 'https://docs.npmjs.com/generating-provenance-statements'
		}
	];
</script>

<svelte:head>
	<title>SDK — Homeport</title>
	<meta
		name="description"
		content="The official Homeport TypeScript SDK — agent registration, A2A discovery, DAG orchestration, and NANDA index lookups."
	/>
	<meta property="og:title" content="SDK — Homeport" />
	<meta
		property="og:description"
		content="The official Homeport TypeScript SDK — agent registration, A2A discovery, DAG orchestration, and NANDA index lookups."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/sdk.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4 py-8">
	<div
		class="pb-8 mb-8 border-b border-nanda-border/40"
		style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
	>
		<div class="flex items-center gap-3 mb-3">
			<Package class="h-8 w-8 text-nanda-accent" />
			<div>
				<h1 class="text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold gradient-text">NANDA Node SDK</h1>
				<p class="text-sm text-nanda-text-muted font-mono">@nexartis/homeport-sdk</p>
			</div>
		</div>
		<p class="text-nanda-text-muted max-w-[640px] mt-4">
			The official TypeScript SDK for the Homeport — agent registration, A2A discovery, DAG-based
			workflow orchestration, and NANDA index lookups. Zero runtime dependencies.
		</p>

		<!-- Badges -->
		<div class="flex flex-wrap items-center gap-2 mt-5">
			{#each badges as b}
				<a href={b.href} target="_blank" rel="noopener" aria-label={b.alt}>
					<img src={b.src} alt={b.alt} height="20" loading="lazy" />
				</a>
			{/each}
		</div>

		<!-- Primary CTAs -->
		<div class="flex flex-wrap gap-3 mt-6">
			<a
				href="https://homeport-sdk.nexartis.com"
				target="_blank"
				rel="noopener"
				class="nanda-btn-primary inline-flex items-center gap-2"
			>
				<BookOpen class="h-4 w-4" /> Full API reference
			</a>
			<a
				href="https://github.com/Nexartis/homeport-sdk"
				target="_blank"
				rel="noopener"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path
						d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
					/>
				</svg>
				View on GitHub
			</a>
		</div>
	</div>

	<!-- Install -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold text-nanda-text mb-4 flex items-center gap-2">
			<Terminal class="h-5 w-5 text-nanda-accent" />
			Installation
		</h2>
		<div class="nanda-card font-mono text-sm space-y-1">
			<p class="text-nanda-text-muted"># Published on npmjs.com — no registry config required</p>
			<p class="text-nanda-text">pnpm add @nexartis/homeport-sdk</p>
			<p class="text-nanda-text-muted pt-2"># or with npm / yarn</p>
			<p class="text-nanda-text-dim">npm install @nexartis/homeport-sdk</p>
			<p class="text-nanda-text-dim">yarn add @nexartis/homeport-sdk</p>
		</div>
		<p class="text-xs text-nanda-text-dim mt-3">
			Apache-2.0 licensed · Works in Node 20+, Bun, Deno, Cloudflare Workers, and modern browsers ·
			Built with npm provenance attestations.
		</p>
	</section>

	<!-- Quick Start -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold text-nanda-text mb-4 flex items-center gap-2">
			<Rocket class="h-5 w-5 text-nanda-accent" />
			Quick Start
		</h2>
		<div class="nanda-card font-mono text-sm overflow-x-auto whitespace-pre leading-relaxed">
			<span class="text-nanda-text-muted">// Import the client</span>
			<span class="text-purple-400">import</span>
			{'{'} NnnClient } <span class="text-purple-400">from</span>
			<span class="text-emerald-400">'@nexartis/homeport-sdk'</span>;

			<span class="text-nanda-text-muted"
				>// Initialize — namespaced API (client.agents, client.orchestration, ...)</span
			>
			<span class="text-purple-400">const</span> nnn = <span class="text-purple-400">new</span>
			NnnClient({'{'}
			baseUrl: <span class="text-emerald-400">'https://your-node.example.com'</span>, apiKey:
			<span class="text-emerald-400">'your-api-key'</span>, });

			<span class="text-nanda-text-muted">// Register an agent</span>
			<span class="text-purple-400">await</span> nnn.agents.register({'{'}
			agent_id: <span class="text-emerald-400">'my-agent'</span>, agent_url:
			<span class="text-emerald-400">'https://my-agent.example.com'</span>, capabilities: [<span
				class="text-emerald-400">'code-generation'</span
			>, <span class="text-emerald-400">'analysis'</span>], tags: [<span class="text-emerald-400"
				>'llm'</span
			>, <span class="text-emerald-400">'typescript'</span>], });

			<span class="text-nanda-text-muted">// Discover agents (single page)</span>
			<span class="text-purple-400">const</span> agents = <span class="text-purple-400">await</span>
			nnn.agents.search({'{'}
			capabilities: [<span class="text-emerald-400">'code-generation'</span>], min_trust:
			<span class="text-emerald-400">0.8</span>, });

			<span class="text-nanda-text-muted">// Auto-paginate across all matching agents</span>
			<span class="text-purple-400">for await</span> (<span class="text-purple-400">const</span>
			agent <span class="text-purple-400">of</span> nnn.agents.searchAll({'{'} capabilities: [<span
				class="text-emerald-400">'code-review'</span
			>] })) {'{'}
			console.log(agent.agent_id); }

			<span class="text-nanda-text-muted">// Create and run a DAG workflow</span>
			<span class="text-purple-400">await</span> nnn.orchestration.createWorkflow({'{'}
			name: <span class="text-emerald-400">'Analysis Pipeline'</span>, owner_id:
			<span class="text-emerald-400">'my-org'</span>, dag: {'{'}
			nodes: [
			{'{'} id: <span class="text-emerald-400">'analyze'</span>, type:
			<span class="text-emerald-400">'agent'</span>, data: {'{'} agent_id:
			<span class="text-emerald-400">'analyzer'</span>
			} },
			{'{'} id: <span class="text-emerald-400">'review'</span>, type:
			<span class="text-emerald-400">'agent'</span>, data: {'{'} agent_id:
			<span class="text-emerald-400">'reviewer'</span>
			} }, ], edges: [{'{'} source: <span class="text-emerald-400">'analyze'</span>, target:
			<span class="text-emerald-400">'review'</span>
			}], }, });

			<span class="text-purple-400">const</span> run = <span class="text-purple-400">await</span>
			nnn.orchestration.runWorkflow(<span class="text-emerald-400">'workflow-123'</span>, {'{'} prompt:
			<span class="text-emerald-400">'Analyze this PR'</span>
			});
		</div>
	</section>

	<!-- Configuration -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold text-nanda-text mb-4 flex items-center gap-2">
			<KeyRound class="h-5 w-5 text-nanda-accent" />
			Configuration
		</h2>
		<div class="nanda-card overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-nanda-border text-left">
						<th class="pb-2 pr-4 text-nanda-text font-semibold">Property</th>
						<th class="pb-2 pr-4 text-nanda-text font-semibold">Type</th>
						<th class="pb-2 text-nanda-text font-semibold">Description</th>
					</tr>
				</thead>
				<tbody class="text-nanda-text-muted">
					<tr class="border-b border-nanda-border/50">
						<td class="py-2 pr-4 font-mono text-purple-400">baseUrl</td>
						<td class="py-2 pr-4 font-mono">string</td>
						<td class="py-2">NNN base URL <span class="opacity-60">(required)</span></td>
					</tr>
					<tr class="border-b border-nanda-border/50">
						<td class="py-2 pr-4 font-mono text-purple-400">apiKey</td>
						<td class="py-2 pr-4 font-mono">string?</td>
						<td class="py-2">Bearer token for authenticated endpoints</td>
					</tr>
					<tr class="border-b border-nanda-border/50">
						<td class="py-2 pr-4 font-mono text-purple-400">verbose</td>
						<td class="py-2 pr-4 font-mono">boolean?</td>
						<td class="py-2">Enable debug logging</td>
					</tr>
					<tr>
						<td class="py-2 pr-4 font-mono text-purple-400">retryConfig</td>
						<td class="py-2 pr-4 font-mono">NnnRetryConfig?</td>
						<td class="py-2"
							>Custom retry settings (maxRetries, baseDelayMs, maxDelayMs, timeoutMs)</td
						>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- API Reference -->
	<section class="mb-10">
		<h2 class="text-lg font-semibold text-nanda-text mb-6 flex items-center gap-2">
			<BookOpen class="h-5 w-5 text-nanda-accent" />
			Namespaced API
		</h2>
		<p class="text-sm text-nanda-text-muted mb-6 max-w-[720px]">
			Methods are grouped into logical namespaces on the client. The only direct methods on
			<code>NnnClient</code> are <code>health()</code>, <code>isHealthy()</code>, and
			<code>deepHealth()</code>. The full typedoc reference lives at
			<a
				href="https://homeport-sdk.nexartis.com"
				target="_blank"
				rel="noopener"
				class="text-nanda-accent hover:underline">homeport-sdk.nexartis.com</a
			>.
		</p>

		<!-- agents -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Radio class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.agents</code>
			</h3>
			<div class="space-y-3">
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						register(req) · lookup(id) · search(params?) · getFacts(id) · getNandaIndex()
					</p>
					<p class="text-sm text-nanda-text-muted">
						Agent registration, lookup, search, and discovery metadata (AgentFacts, NANDA Index).
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						update(id, updates) · updateStatus(id, status) · delete(id) · refresh(id)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Mutate or refresh agent records. Status changes re-trigger live probes.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						deprecate(id, opts) · tombstone(id) · listVersions(id) · createVersion(id, req)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Lifecycle operations — deprecate, tombstone, and version history.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						searchAll(params?) · listAll(params?)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Async generators that auto-paginate across every result with stale-cursor guards.
					</p>
				</div>
			</div>
		</div>

		<!-- orchestration -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Settings class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.orchestration</code>
			</h3>
			<div class="space-y-3">
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						createWorkflow(req) · listWorkflows(params?) · getWorkflow(id) · updateWorkflow(id,
						updates) · deleteWorkflow(id)
					</p>
					<p class="text-sm text-nanda-text-muted">
						DAG workflow CRUD. Nodes and edges describe the multi-agent execution graph.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						runWorkflow(id, input?) · listWorkflowRuns(id) · getWorkflowStatus(runId) ·
						cancelWorkflowRun(runId)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Execute workflows and inspect run progress, step statuses, and final outputs.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						routeRequest(params) · delegateTask(params) · listDelegations(id)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Intelligent agent routing and sub-task delegation for dynamic workflows.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						listPatterns(opts?) · createPattern(params) · listConflicts(params?) ·
						raiseConflict(params)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Reusable orchestrator patterns and conflict resolution.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						diffIndex(since) · subscribeToIndex(cb, intervalMs?)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Watch the agent index for additions, updates, and removals (long-poll watcher).
					</p>
				</div>
			</div>
		</div>

		<!-- trust -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<ShieldCheck class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.trust</code>
			</h3>
			<div class="space-y-3">
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						resolveAgent(id) · adaptiveResolve(id, ctx?) · getReputation()
					</p>
					<p class="text-sm text-nanda-text-muted">
						Multi-strategy resolution through the Lean Index + reputation snapshots.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						getScores(opts?) · getFrameworks(opts?) · syncCrossRegistry(adminKey?) · getGraph(opts?)
						· getPath(from, to)
					</p>
					<p class="text-sm text-nanda-text-muted">
						Trust scores, framework metadata, and trust-graph traversal.
					</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						getBehaviorAnalytics(opts?) · scanCompliance(opts?)
					</p>
					<p class="text-sm text-nanda-text-muted">Behavior analytics and compliance scan runs.</p>
				</div>
			</div>
		</div>

		<!-- federation -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Network class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.federation</code>
			</h3>
			<div class="nanda-card">
				<p class="font-mono text-sm text-purple-400 mb-1">
					getPeers() · getStatus() · getAgents() · sendA2ARequest(params)
				</p>
				<p class="text-sm text-nanda-text-muted">
					Inspect federation peers, gossip state, and dispatch JSON-RPC A2A requests to remote
					agents. External A2A calls are scoped through a separate circuit breaker.
				</p>
			</div>
		</div>

		<!-- webhooks -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Webhook class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.webhooks</code>
			</h3>
			<div class="nanda-card">
				<p class="font-mono text-sm text-purple-400 mb-1">
					list() · create(params) · get(id) · update(id, action) · delete(id)
				</p>
				<p class="text-sm text-nanda-text-muted">
					Manage webhook subscriptions. <code>create()</code> returns a one-time
					<code>secret</code> used to verify delivery HMAC signatures.
				</p>
			</div>
		</div>

		<!-- developers -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Users class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.developers</code>
			</h3>
			<div class="nanda-card">
				<p class="font-mono text-sm text-purple-400 mb-1">
					listKeys() · createKey(params) · revokeKey(id) · getEarnings(developerId, view?) ·
					earningsAction(params)
				</p>
				<p class="text-sm text-nanda-text-muted">
					Programmatic developer-portal operations — API key lifecycle and revenue share reporting.
				</p>
			</div>
		</div>

		<!-- billing -->
		<div class="mb-8">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Wallet class="h-4 w-4 text-nanda-accent" />
				<code class="font-mono">client.billing</code>
			</h3>
			<div class="space-y-3">
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						getSubscription(keyId) · createSubscription(params) · listInvoices(keyId) ·
						createInvoice(params)
					</p>
					<p class="text-sm text-nanda-text-muted">Subscriptions and invoicing per API key.</p>
				</div>
				<div class="nanda-card">
					<p class="font-mono text-sm text-purple-400 mb-1">
						createCheckoutSession(params) · getCheckoutSession(id) · submitCheckoutPayment(id,
						payment) · cancelCheckoutSession(id) · verifyNpPayment(params)
					</p>
					<p class="text-sm text-nanda-text-muted">
						UCP checkout sessions and NP payment verification.
					</p>
				</div>
			</div>
		</div>

		<!-- direct client methods -->
		<div class="mb-2">
			<h3 class="text-base font-semibold text-nanda-text mb-3 flex items-center gap-2">
				<Heart class="h-4 w-4 text-nanda-accent" />
				Direct client methods
			</h3>
			<div class="nanda-card">
				<p class="font-mono text-sm text-purple-400 mb-1">
					client.health() · client.isHealthy() · client.deepHealth()
				</p>
				<p class="text-sm text-nanda-text-muted">
					Subsystem health (DB, R2, KV, Queues). <code>isHealthy()</code> never throws.
				</p>
			</div>
		</div>
	</section>

	<!-- Links -->
	<section class="mb-10">
		<div class="grid sm:grid-cols-2 gap-4">
			<a
				href="https://homeport-sdk.nexartis.com"
				target="_blank"
				rel="noopener"
				class="nanda-card group flex items-start gap-4 hover:border-nanda-accent/60 transition-colors"
			>
				<BookOpen class="h-6 w-6 text-nanda-accent shrink-0 mt-1" />
				<div class="flex-1">
					<p class="text-sm font-semibold text-nanda-text">Full typedoc reference</p>
					<p class="text-sm text-nanda-text-muted mt-1">
						Generated from source — every method, every type, every example.
					</p>
					<p class="text-xs text-nanda-accent mt-2 inline-flex items-center gap-1">
						homeport-sdk.nexartis.com <ExternalLink class="h-3 w-3" />
					</p>
				</div>
			</a>
			<a
				href="https://github.com/Nexartis/homeport-sdk"
				target="_blank"
				rel="noopener"
				class="nanda-card group flex items-start gap-4 hover:border-nanda-accent/60 transition-colors"
			>
				<svg
					class="h-6 w-6 text-nanda-accent shrink-0 mt-1"
					viewBox="0 0 16 16"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
					/>
				</svg>
				<div class="flex-1">
					<p class="text-sm font-semibold text-nanda-text">View on GitHub</p>
					<p class="text-sm text-nanda-text-muted mt-1">
						Source, issues, examples, and contributing guidelines. Apache-2.0 licensed.
					</p>
					<p class="text-xs text-nanda-accent mt-2 inline-flex items-center gap-1">
						Nexartis/homeport-sdk <ExternalLink class="h-3 w-3" />
					</p>
				</div>
			</a>
		</div>
	</section>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/nest-quickstart">NestJS Quickstart</a> — integrate NANDA into a NestJS
		application step by step ·
		<a href="/blog/developer-api-keys">Developer API Keys</a> — authentication, key management, and tier
		rate limits
	</div>
</div>
