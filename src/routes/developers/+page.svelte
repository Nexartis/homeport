<script lang="ts">
	import { page } from '$app/state';
	import {
		ExternalLink,
		Key,
		BookOpen,
		Gauge,
		Code,
		Shield,
		Zap,
		Check,
		Package,
		Rocket,
		ArrowRight
	} from 'lucide-svelte';

	const features = [
		{
			icon: Key,
			title: 'API Keys',
			desc: 'Generate API keys to authenticate write operations. Free tier includes 1,000 requests/month.'
		},
		{
			icon: Gauge,
			title: 'Usage Dashboard',
			desc: 'Monitor your API usage, rate limits, and key status in real time.'
		},
		{
			icon: Code,
			title: 'Full API Access',
			desc: 'Register agents, store AgentFacts, run A2A discovery — all via REST API.'
		},
		{
			icon: Shield,
			title: 'Read Without Keys',
			desc: 'Search, lookup, and list operations are always open. No key required to read.'
		},
		{
			icon: BookOpen,
			title: 'Documentation',
			desc: 'Comprehensive docs with curl examples, response schemas, and integration guides.'
		},
		{
			icon: Zap,
			title: 'Edge Performance',
			desc: 'Sub-50ms responses from 300+ global edge locations. Zero cold starts.'
		}
	];

	const tiers = [
		{
			name: 'Free',
			price: '$0',
			limit: '1,000 req/mo',
			keys: '5 keys',
			features: ['Agent registration', 'AgentFacts storage', 'A2A protocol', 'Community support']
		},
		{
			name: 'Pro',
			price: 'Contact us',
			limit: '10,000 req/mo',
			keys: '25 keys',
			features: [
				'Everything in Free',
				'Priority rate limits',
				'Webhook notifications',
				'Email support'
			]
		},
		{
			name: 'Enterprise',
			price: 'Custom',
			limit: '100,000 req/mo',
			keys: 'Unlimited',
			features: ['Everything in Pro', 'Dedicated support', 'SLA guarantee', 'Custom scopes']
		}
	];

	const quickstartSteps = [
		{
			step: '1',
			title: 'Sign in',
			desc: 'Create a free account or sign in with your existing Nexartis account.'
		},
		{
			step: '2',
			title: 'Generate a key',
			desc: "Go to your dashboard and create an API key. Save it — it's shown only once."
		},
		{
			step: '3',
			title: 'Start building',
			desc: 'Use your key in the Authorization header to register agents and store facts.'
		}
	];
</script>

<svelte:head>
	<title>Developers — Homeport</title>
	<meta
		name="description"
		content="Build on the Homeport — API keys, documentation, and tools for AI agent registration, discovery, and trust."
	/>
	<meta property="og:title" content="Developers — Homeport" />
	<meta
		property="og:description"
		content="Build on the Homeport — API keys, documentation, and tools for AI agent registration, discovery, and trust."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/developers.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4">
	<!-- Hero -->
	<div
		class="py-14 pb-10 border-b border-nanda-border/40"
		style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
	>
		<div
			class="inline-flex items-center gap-2 rounded-full bg-nanda-primary-500/10 px-3 py-1 text-xs font-medium text-nanda-primary-400 mb-4"
		>
			<Key class="h-3 w-3" /> Developer Program
		</div>
		<h1 class="text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mb-3 gradient-text">
			Build on the NANDA Network
		</h1>
		<p class="text-nanda-text-muted max-w-[640px] text-[15px] mb-6">
			Register AI agents, issue trust credentials, and discover services on the decentralized NANDA
			protocol. Read operations are always open — get an API key to write.
		</p>
		<div class="flex flex-wrap gap-3">
			<a
				href="/developers/getting-started"
				class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-nanda-primary-500 transition-colors"
			>
				<Rocket class="h-4 w-4" /> 60-second quickstart
			</a>
			<a
				href="/developers/dashboard"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
			>
				<Key class="h-4 w-4" /> Get your API key
			</a>
			<a
				href="/docs/developers"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
			>
				<BookOpen class="h-4 w-4" /> Read the Docs
			</a>
		</div>
	</div>

	<!-- Features grid -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">What You Get</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px]">
			Everything you need to integrate with the Homeport.
		</p>
		<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each features as f}
				<div class="nanda-card">
					<f.icon class="h-6 w-6 text-nanda-primary-400 mb-3" />
					<h3 class="font-semibold mb-1.5">{f.title}</h3>
					<p class="text-sm text-nanda-text-muted leading-relaxed">{f.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Quickstart -->
	<section class="py-14 border-t border-nanda-border/40">
		<h2 class="text-2xl font-bold mb-2">Quickstart</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px]">Get up and running in under 2 minutes.</p>
		<div class="grid md:grid-cols-3 gap-5 mb-8">
			{#each quickstartSteps as s}
				<div class="nanda-card">
					<div
						class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-nanda-primary-500/15 text-nanda-primary-400 text-sm font-bold mb-3"
					>
						{s.step}
					</div>
					<h3 class="font-semibold mb-1.5">{s.title}</h3>
					<p class="text-sm text-nanda-text-muted">{s.desc}</p>
				</div>
			{/each}
		</div>
		<div class="nanda-card font-mono text-sm overflow-x-auto">
			<p class="text-nanda-text-dim mb-1"># Register an agent with your API key</p>
			<p class="text-nanda-text">curl -X POST {page.data.registryUrl}/register \</p>
			<p class="text-nanda-text pl-4">-H "Authorization: Bearer nanda_YOUR_KEY" \</p>
			<p class="text-nanda-text pl-4">-H "Content-Type: application/json" \</p>
			<p class="text-nanda-text pl-4">
				-d '{"{'"}agent_id":"my-agent","agent_url":"https://my-agent.example.com"}'
			</p>
		</div>
	</section>

	<!-- Install the SDK -->
	<section class="py-14 border-t border-nanda-border/40">
		<div class="flex items-center gap-3 mb-2">
			<Package class="h-6 w-6 text-nanda-primary-400" />
			<h2 class="text-2xl font-bold">Install the SDK</h2>
		</div>
		<p class="text-nanda-text-muted mb-6 text-[15px] max-w-[640px]">
			Skip raw HTTP — use the official TypeScript SDK. Namespaced methods (<code>client.agents</code
			>, <code>client.orchestration</code>, ...), typed errors, built-in retry &amp; circuit
			breaker. Zero runtime dependencies, Apache-2.0 licensed.
		</p>
		<div class="nanda-card font-mono text-sm mb-6">
			<p class="text-nanda-text">pnpm add @nexartis/homeport-sdk</p>
		</div>
		<div class="flex flex-wrap gap-3">
			<a
				href="/developers/getting-started"
				class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-nanda-primary-500 transition-colors"
			>
				<Rocket class="h-4 w-4" /> 60-second quickstart <ArrowRight class="h-3.5 w-3.5" />
			</a>
			<a
				href="/docs/sdk"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
			>
				<BookOpen class="h-4 w-4" /> SDK reference
			</a>
			<a
				href="https://github.com/Nexartis/homeport-sdk"
				target="_blank"
				rel="noopener"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
			>
				<ExternalLink class="h-4 w-4" /> GitHub
			</a>
		</div>
		<p class="text-nanda-text-muted text-sm mt-6 max-w-[640px]">
			Building on the node itself? Homeport is open source and ships as a Cubicube Core Cubi — a
			manifest-honest fork stays one-command deployable, and your customization can be offered to
			<a
				href="https://cubicube.com"
				target="_blank"
				rel="noopener"
				class="text-nanda-accent hover:underline">Cubicube</a
			>'s customers. See
			<a
				href="https://github.com/Nexartis/homeport/blob/dev/docs/CUBICUBE-DISTRIBUTION.md"
				target="_blank"
				rel="noopener"
				class="text-nanda-accent hover:underline">the distribution guide</a
			>.
		</p>
	</section>

	<!-- Tiers -->
	<section class="py-14 border-t border-nanda-border/40">
		<h2 class="text-2xl font-bold mb-2">API Key Tiers</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px]">Start free. Scale when you need to.</p>
		<div class="grid md:grid-cols-3 gap-5">
			{#each tiers as t, i}
				<div class="nanda-card {i === 0 ? 'ring-1 ring-nanda-primary-500/30' : ''}">
					<h3 class="text-lg font-bold mb-1">{t.name}</h3>
					<p class="text-2xl font-extrabold text-nanda-primary-400 mb-1">{t.price}</p>
					<p class="text-xs text-nanda-text-dim mb-4">{t.limit} · {t.keys}</p>
					<ul class="space-y-2">
						{#each t.features as f}
							<li class="flex items-start gap-2 text-sm text-nanda-text-muted">
								<Check class="h-3.5 w-3.5 text-nanda-primary-400 mt-0.5 shrink-0" />
								{f}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>

	<!-- CTA -->
	<section class="py-14 border-t border-nanda-border/40 text-center">
		<h2 class="text-2xl font-bold mb-3">Ready to Build?</h2>
		<p class="text-nanda-text-muted mb-6 max-w-md mx-auto text-[15px]">
			Join the NANDA network and start registering AI agents today. Free tier, no credit card.
		</p>
		<div class="flex flex-wrap justify-center gap-3">
			<a
				href="/developers/dashboard"
				class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-nanda-primary-500 transition-colors"
			>
				Get Started Free
			</a>
			<a
				href="/docs/api"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-5 py-2.5 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
			>
				API Reference <ExternalLink class="h-3 w-3" />
			</a>
		</div>
	</section>
</div>
