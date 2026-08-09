<script lang="ts">
	import { page } from '$app/state';
	import {
		Server,
		GitFork,
		Cloud,
		Package,
		ShieldCheck,
		Settings,
		Users,
		ExternalLink,
		BookOpen,
		TriangleAlert,
		CircleCheck
	} from 'lucide-svelte';

	const registryUrl = $derived(page.data.registryUrl ?? page.url.origin);

	const prerequisites = [
		'Cloudflare account with Workers Paid plan (D1, R2, KV, Queues access).',
		'Node.js 20+ and pnpm 10.',
		'A domain you control (for your node URL and .well-known agent discovery).',
		'Familiarity with Cloudflare Wrangler and SvelteKit 2.'
	];
</script>

<svelte:head>
	<title>Self-Hosting a NANDA Node — Homeport</title>
	<meta
		name="description"
		content="Run your own NANDA Node on Cloudflare Workers — fork the repo, configure bindings, deploy, and plug into the federation."
	/>
	<meta property="og:title" content="Self-Hosting a NANDA Node — Homeport" />
	<meta
		property="og:description"
		content="Run your own NANDA Node on Cloudflare Workers — fork the repo, configure bindings, deploy, and plug into the federation."
	/>
	<meta property="og:image" content="{registryUrl}/og/self-hosting.png" />
</svelte:head>

<div class="mx-auto max-w-[1000px] px-4 py-10">
	<!-- Hero -->
	<div class="pb-8 mb-10 border-b border-nanda-border/40">
		<div
			class="inline-flex items-center gap-2 rounded-full bg-nanda-primary-500/10 px-3 py-1 text-xs font-medium text-nanda-primary-400 mb-4"
		>
			<Server class="h-3 w-3" /> Self-hosting guide
		</div>
		<h1 class="text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold mb-3 gradient-text">
			Run your own NANDA Node
		</h1>
		<p class="text-nanda-text-muted max-w-[720px] text-[15px]">
			Fork the codebase, provision a handful of Cloudflare bindings, and you have a
			federation-capable agent registry running on your own domain — for data residency, air-gapped
			deployments, or as an alternative trust anchor in the NANDA network.
		</p>
	</div>

	<!-- Prerequisites -->
	<section class="mb-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<CircleCheck class="h-5 w-5 text-nanda-accent" /> Prerequisites
		</h2>
		<ul class="space-y-2">
			{#each prerequisites as item (item)}
				<li class="flex items-start gap-2 text-sm text-nanda-text-muted">
					<span class="text-nanda-primary-400 mt-0.5">•</span>
					<span>{item}</span>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Fork and deploy -->
	<section class="mb-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<GitFork class="h-5 w-5 text-nanda-accent" /> Fork &amp; deploy
		</h2>
		<p class="text-sm text-nanda-text-muted mb-4 max-w-[720px]">
			Homeport is the open-source NANDA node reference implementation — this repository is the
			public deploy. The pattern below is what Nexartis-operated nodes use today.
		</p>
		<div class="nanda-card font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed mb-3">
			<span class="text-nanda-text-dim"># 1. Clone &amp; install</span>
			git clone https://github.com/Nexartis/homeport.git cd homeport pnpm install

			<span class="text-nanda-text-dim"># 2. Provision Cloudflare resources</span>
			wrangler d1 create my-nanda-node wrangler r2 bucket create my-nanda-evidence wrangler kv namespace
			create NANDA_NODE_CACHE

			<span class="text-nanda-text-dim"># 3. Wire bindings into wrangler.jsonc, then:</span>
			pnpm run migrate:dev <span class="text-nanda-text-dim"># apply migrations</span>
			pnpm run deploy:dev <span class="text-nanda-text-dim"># deploy to Workers</span>
		</div>
		<p class="text-xs text-nanda-text-muted">
			Migrations are hand-written SQL in <code>drizzle/migrations/</code>. Never run
			<code>drizzle-kit push</code> — that will corrupt your schema journal.
		</p>
	</section>

	<!-- SDK link -->
	<section class="mb-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<Package class="h-5 w-5 text-nanda-accent" /> Point the SDK at your node
		</h2>
		<p class="text-sm text-nanda-text-muted mb-3 max-w-[720px]">
			The TypeScript SDK works against any conformant NANDA Node — just pass your own
			<code>baseUrl</code>.
		</p>
		<div class="nanda-card font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed mb-3">
			<span class="text-purple-400">import</span>
			{'{'} NnnClient } <span class="text-purple-400">from</span>
			<span class="text-emerald-400">'@nexartis/homeport-sdk'</span>;

			<span class="text-purple-400">const</span> nnn = <span class="text-purple-400">new</span>
			NnnClient({'{'}
			baseUrl: <span class="text-emerald-400">'https://nanda.mycompany.com'</span>, apiKey:
			process.env.NANDA_API_KEY!, });
		</div>
		<a
			href="/docs/sdk"
			class="inline-flex items-center gap-2 text-sm text-nanda-primary-400 hover:text-nanda-primary-300"
		>
			<BookOpen class="h-4 w-4" /> Full SDK reference
		</a>
	</section>

	<!-- Admin settings note -->
	<section class="mb-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<Settings class="h-5 w-5 text-nanda-accent" /> Node configuration
		</h2>
		<p class="text-sm text-nanda-text-muted mb-3 max-w-[720px]">
			Once deployed, visit <code>/admin/settings</code> as an authenticated operator to set your node's
			public metadata, moderation policies, federation peers, and invitation flow. Per-node branding lives
			under your node's own public pages; infrastructure services are frozen and should not be forked-and-modified
			lightly.
		</p>
	</section>

	<!-- Security -->
	<section class="mb-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<ShieldCheck class="h-5 w-5 text-nanda-accent" /> Security considerations
		</h2>
		<ul class="space-y-2 text-sm text-nanda-text-muted max-w-[720px]">
			<li class="flex items-start gap-2">
				<span class="text-nanda-primary-400 mt-0.5">•</span>
				<span>
					Store Ed25519 signing keys in Cloudflare Secrets Store — never in
					<code>wrangler.jsonc</code> or environment variables.
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-nanda-primary-400 mt-0.5">•</span>
				<span>
					Rotate <code>CRON_AUTH_TOKEN</code> and HMAC secrets on a documented schedule.
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-nanda-primary-400 mt-0.5">•</span>
				<span>
					Federation gossip is signed but not encrypted — treat peer lists as semi-public.
				</span>
			</li>
			<li class="flex items-start gap-2">
				<span class="text-nanda-primary-400 mt-0.5">•</span>
				<span> Enable ZTAA middleware and rate limits before accepting public API traffic. </span>
			</li>
		</ul>
		<div
			class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3"
		>
			<TriangleAlert class="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
			<p class="text-xs text-amber-200/90">
				Self-hosted nodes are responsible for their own uptime, backups, and incident response.
				Nexartis does not provide SLA coverage for third-party deployments during the beta.
			</p>
		</div>
	</section>

	<!-- Community -->
	<section class="mb-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<Cloud class="h-5 w-5 text-nanda-accent" /> Built as a Cubicube Core Cubi
		</h2>
		<p class="text-nanda-text-muted text-[15px] max-w-[680px]">
			Homeport is a self-describing template: <code>cube.jsonc</code> declares every resource the
			node needs, and the same contract that powers <code>pnpm run setup</code> lets
			<a
				href="https://cubicube.com"
				target="_blank"
				rel="noopener"
				class="text-nanda-accent hover:underline">Cubicube</a
			>
			deploy and operate it as a managed node. A manifest-honest fork stays deployable by the same engine
			— so a customization you build can be offered to Cubicube's customers. See
			<a
				href="https://github.com/Nexartis/homeport/blob/dev/docs/CUBICUBE-DISTRIBUTION.md"
				target="_blank"
				rel="noopener"
				class="text-nanda-accent hover:underline">the distribution guide</a
			> to partner with Cubicube.
		</p>
	</section>

	<section class="mb-12">
		<h2 class="text-xl font-bold text-nanda-text mb-4 flex items-center gap-2">
			<Users class="h-5 w-5 text-nanda-accent" /> Community &amp; support
		</h2>
		<div class="grid sm:grid-cols-2 gap-4">
			<a
				href="https://github.com/Nexartis/homeport-sdk"
				target="_blank"
				rel="noopener"
				class="nanda-card flex items-start gap-3 hover:border-nanda-accent/60 transition-colors"
			>
				<ExternalLink class="h-5 w-5 text-nanda-accent shrink-0 mt-1" />
				<div>
					<p class="text-sm font-semibold text-nanda-text">SDK on GitHub</p>
					<p class="text-xs text-nanda-text-muted mt-1">
						Open issues, propose enhancements, read the source.
					</p>
				</div>
			</a>
			<a
				href="/docs/sdk"
				class="nanda-card flex items-start gap-3 hover:border-nanda-accent/60 transition-colors"
			>
				<Cloud class="h-5 w-5 text-nanda-accent shrink-0 mt-1" />
				<div>
					<p class="text-sm font-semibold text-nanda-text">SDK reference</p>
					<p class="text-xs text-nanda-text-muted mt-1">
						Every namespace, every method — agents, orchestration, trust, webhooks.
					</p>
				</div>
			</a>
		</div>
	</section>
</div>
