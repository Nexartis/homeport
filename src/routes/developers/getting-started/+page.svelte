<script lang="ts">
	import { page } from '$app/state';
	import {
		KeyRound,
		Package,
		Terminal,
		BookOpen,
		Rocket,
		ArrowRight,
		ExternalLink,
		Timer
	} from 'lucide-svelte';

	const registryUrl = $derived(page.data.registryUrl ?? page.url.origin);
</script>

<svelte:head>
	<title>Getting Started — Homeport</title>
	<meta
		name="description"
		content="Your first NANDA agent query in 60 seconds — get an API key, install the SDK, and run your first discovery call."
	/>
	<meta property="og:title" content="Getting Started — Homeport" />
	<meta
		property="og:description"
		content="Your first NANDA agent query in 60 seconds — get an API key, install the SDK, and run your first discovery call."
	/>
	<meta property="og:image" content="{registryUrl}/og/developers.png" />
</svelte:head>

<div class="mx-auto max-w-[1000px] px-4 py-10">
	<!-- Hero -->
	<div
		class="pb-8 mb-10 border-b border-nanda-border/40"
		style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
	>
		<div
			class="inline-flex items-center gap-2 rounded-full bg-nanda-primary-500/10 px-3 py-1 text-xs font-medium text-nanda-primary-400 mb-4"
		>
			<Timer class="h-3 w-3" /> 60-second quickstart
		</div>
		<h1 class="text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold mb-3 gradient-text">
			Your first NANDA agent query in 60 seconds
		</h1>
		<p class="text-nanda-text-muted max-w-[640px] text-[15px]">
			Four steps from zero to your first agent discovery call. No framework lock-in, no local setup,
			nothing to deploy.
		</p>
	</div>

	<!-- Step 1 -->
	<section class="mb-10">
		<div class="flex items-center gap-3 mb-3">
			<span
				class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-nanda-primary-500/15 text-nanda-primary-400 text-sm font-bold"
				>1</span
			>
			<h2 class="text-lg font-semibold text-nanda-text flex items-center gap-2">
				<KeyRound class="h-5 w-5 text-nanda-accent" /> Get an API key
			</h2>
		</div>
		<p class="text-sm text-nanda-text-muted mb-4 max-w-[700px]">
			Sign in and create a key from the developer dashboard. The raw key is shown once — copy it to
			a password manager or <code>.env</code> file.
		</p>
		<a href="/developers/dashboard" class="inline-flex items-center gap-2 nanda-btn-primary">
			Open dashboard <ArrowRight class="h-4 w-4" />
		</a>
	</section>

	<!-- Step 2 -->
	<section class="mb-10">
		<div class="flex items-center gap-3 mb-3">
			<span
				class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-nanda-primary-500/15 text-nanda-primary-400 text-sm font-bold"
				>2</span
			>
			<h2 class="text-lg font-semibold text-nanda-text flex items-center gap-2">
				<Package class="h-5 w-5 text-nanda-accent" /> Install the SDK
			</h2>
		</div>
		<p class="text-sm text-nanda-text-muted mb-3 max-w-[700px]">
			The official TypeScript SDK is published on npmjs.com with provenance attestations — zero
			runtime dependencies beyond standard <code>fetch</code>.
		</p>
		<div class="nanda-card font-mono text-sm">
			<p class="text-nanda-text">pnpm add @nexartis/homeport-sdk</p>
		</div>
	</section>

	<!-- Step 3 -->
	<section class="mb-10">
		<div class="flex items-center gap-3 mb-3">
			<span
				class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-nanda-primary-500/15 text-nanda-primary-400 text-sm font-bold"
				>3</span
			>
			<h2 class="text-lg font-semibold text-nanda-text flex items-center gap-2">
				<Terminal class="h-5 w-5 text-nanda-accent" /> Run your first discovery call
			</h2>
		</div>
		<p class="text-sm text-nanda-text-muted mb-3 max-w-[700px]">
			Initialize <code>NnnClient</code> and search the registry. Methods are grouped by namespace (<code
				>client.agents</code
			>, <code>client.orchestration</code>, ...).
		</p>
		<div class="nanda-card font-mono text-sm overflow-x-auto whitespace-pre leading-relaxed">
			<span class="text-purple-400">import</span>
			{'{'} NnnClient } <span class="text-purple-400">from</span>
			<span class="text-emerald-400">'@nexartis/homeport-sdk'</span>;

			<span class="text-purple-400">const</span> nnn = <span class="text-purple-400">new</span>
			NnnClient({'{'}
			baseUrl: <span class="text-emerald-400">'{registryUrl}'</span>, apiKey:
			process.env.NANDA_API_KEY!, });

			<span class="text-nanda-text-muted">// Find agents that can review code</span>
			<span class="text-purple-400">const</span> agents = <span class="text-purple-400">await</span>
			nnn.agents.search({'{'}
			capabilities: [<span class="text-emerald-400">'code-review'</span>], min_trust:
			<span class="text-emerald-400">0.8</span>, }); console.log(agents.length,
			<span class="text-emerald-400">'matching agents'</span>);
		</div>
	</section>

	<!-- Step 4 -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-3">
			<span
				class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-nanda-primary-500/15 text-nanda-primary-400 text-sm font-bold"
				>4</span
			>
			<h2 class="text-lg font-semibold text-nanda-text flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" /> Where to go next
			</h2>
		</div>
		<div class="grid sm:grid-cols-2 gap-4">
			<a
				href="/docs/sdk"
				class="nanda-card flex items-start gap-3 hover:border-nanda-accent/60 transition-colors"
			>
				<Rocket class="h-5 w-5 text-nanda-accent shrink-0 mt-1" />
				<div>
					<p class="text-sm font-semibold text-nanda-text">SDK reference</p>
					<p class="text-xs text-nanda-text-muted mt-1">
						Full namespace catalogue — agents, orchestration, trust, federation, webhooks, billing.
					</p>
				</div>
			</a>
			<a
				href="https://homeport-sdk.nexartis.com"
				target="_blank"
				rel="noopener"
				class="nanda-card flex items-start gap-3 hover:border-nanda-accent/60 transition-colors"
			>
				<BookOpen class="h-5 w-5 text-nanda-accent shrink-0 mt-1" />
				<div>
					<p class="text-sm font-semibold text-nanda-text inline-flex items-center gap-1">
						Typedoc API docs <ExternalLink class="h-3 w-3" />
					</p>
					<p class="text-xs text-nanda-text-muted mt-1">
						Auto-generated from source — every method, every type.
					</p>
				</div>
			</a>
			<a
				href="/developers/dashboard"
				class="nanda-card flex items-start gap-3 hover:border-nanda-accent/60 transition-colors"
			>
				<KeyRound class="h-5 w-5 text-nanda-accent shrink-0 mt-1" />
				<div>
					<p class="text-sm font-semibold text-nanda-text">Developer dashboard</p>
					<p class="text-xs text-nanda-text-muted mt-1">
						Manage API keys, monitor usage, and track rate limits.
					</p>
				</div>
			</a>
			<a
				href="/docs/self-hosting"
				class="nanda-card flex items-start gap-3 hover:border-nanda-accent/60 transition-colors"
			>
				<Package class="h-5 w-5 text-nanda-accent shrink-0 mt-1" />
				<div>
					<p class="text-sm font-semibold text-nanda-text">Self-hosting guide</p>
					<p class="text-xs text-nanda-text-muted mt-1">
						Run your own NANDA Node on Cloudflare for data residency or air-gapped deployments.
					</p>
				</div>
			</a>
		</div>
	</section>
</div>
