<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import {
		ShieldCheck,
		Server,
		GitFork,
		Cloud,
		Network,
		ArrowRight,
		ExternalLink,
		BookOpen,
		Terminal
	} from 'lucide-svelte';
	import ShowcaseMarquee from '$lib/components/ShowcaseMarquee.svelte';

	const { data }: { data: PageData } = $props();

	const registryUrl = $derived(page.data.registryUrl ?? page.url.origin);
	const yanezEnabled = $derived(data.yanezEnabled);

	const capabilityCards = [
		{
			icon: Network,
			title: 'Agent registry + discovery',
			desc: 'Public register / lookup / search / list endpoints, signed AgentFacts VCs, and .well-known agent-card.json for A2A discovery.'
		},
		{
			icon: ShieldCheck,
			title: 'Trust, compliance, reputation',
			desc: 'Certifier trials, compliance policy evaluation, observer probes, and reputation scoring — with W3C VCs and Bitstring Status List revocation.'
		},
		{
			icon: Server,
			title: 'Federation + resolution',
			desc: 'CRDT gossip, quilt routing, lean-index resolution, and switchboard adapters (A2A, MCP, NLWeb) across peer nodes.'
		},
		{
			icon: Cloud,
			title: 'Edge-native runtime',
			desc: 'SvelteKit 2 / Svelte 5 on Cloudflare Workers with D1, R2, KV, and Secrets Store — deployable to your own account in minutes.'
		}
	];
</script>

<svelte:head>
	<title>Homeport — the self-hostable NANDA node</title>
	<meta
		name="description"
		content="Homeport is an open-source, self-hostable NANDA node — an agent registry, trust and compliance layer, and federation-capable cubicube for the agentic web."
	/>
	<meta property="og:title" content="Homeport — the self-hostable NANDA node" />
	<meta
		property="og:description"
		content="Open-source agent registry, trust and compliance layer, and federation-capable NANDA node — self-host on Cloudflare Workers or get it managed from Cubicube."
	/>
	<meta property="og:image" content="{registryUrl}/og/home.png" />
	<meta name="twitter:image" content="{registryUrl}/og/home.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4">
	<!-- Hero -->
	<section class="pt-10 pb-14 sm:pt-14 sm:pb-16">
		<div
			class="relative mb-8 overflow-hidden rounded-2xl border border-nanda-border/60 bg-nanda-bg-elevated/40"
		>
			<img
				src="/brand/homeport-cubicube-header.webp"
				alt="Homeport — the self-hostable NANDA node, from Cubicube"
				class="block w-full h-auto"
				width="1600"
				height="640"
				loading="eager"
				fetchpriority="high"
				decoding="async"
			/>
		</div>
		<div class="flex items-center gap-2 mb-5">
			<img
				src="/brand/homeport-mark.svg"
				alt=""
				aria-hidden="true"
				class="h-6 w-6"
				width="24"
				height="24"
			/>
			<span class="text-xs uppercase tracking-[0.18em] text-nanda-text-dim font-semibold">
				Homeport
			</span>
		</div>
		<h1
			class="text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight text-nanda-text max-w-[820px]"
		>
			A self-hostable NANDA node for the agentic web.
		</h1>
		<p class="mt-5 text-[15px] sm:text-base text-nanda-text-muted max-w-[720px] leading-relaxed">
			Homeport is the open-source cubicube behind
			<a
				href="/docs/nanda"
				class="underline decoration-nanda-border hover:decoration-nanda-text-muted">Project NANDA</a
			>
			nodes: a public agent registry, trust and compliance layer, federation-capable resolver, and protocol
			switchboard — deployable to your own Cloudflare account, or
			<a
				href="https://cubicube.com"
				rel="noopener"
				class="underline decoration-nanda-primary-500/60 hover:decoration-nanda-primary-400"
			>
				managed for you by Cubicube
			</a>. Every agent needs a homeport.
		</p>
		<div class="mt-8 flex flex-wrap items-center gap-3">
			<a
				href="/docs/quickstart"
				class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-nanda-primary-400 transition-colors"
			>
				<Terminal class="h-4 w-4" />
				Quickstart
			</a>
			<a
				href="/docs/self-hosting"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2.5 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:border-nanda-text-dim transition-colors"
			>
				<GitFork class="h-4 w-4" />
				Self-host guide
			</a>
			<a
				href="https://github.com/Nexartis/homeport"
				rel="noopener"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2.5 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:border-nanda-text-dim transition-colors"
			>
				GitHub
				<ExternalLink class="h-3.5 w-3.5" />
			</a>
			<a
				href="/docs"
				class="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-nanda-text-muted hover:text-nanda-text transition-colors"
			>
				<BookOpen class="h-4 w-4" />
				Docs
			</a>
		</div>
		<p class="mt-6 text-[12.5px] text-nanda-text-dim">
			Apache-2.0 · Cloudflare Workers · Every agent needs a homeport.
		</p>
	</section>
</div>

<!-- Showcase marquee — social proof strip, above the fold on tall viewports -->
<ShowcaseMarquee />

<div class="mx-auto max-w-[1100px] px-4">
	<!-- Capability grid -->
	<section class="border-t border-nanda-border/40 py-14">
		<h2 class="text-xs uppercase tracking-[0.18em] text-nanda-text-dim font-semibold mb-6">
			What Homeport is
		</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			{#each capabilityCards as card (card.title)}
				<div
					class="rounded-xl border border-nanda-border/60 bg-nanda-bg-elevated/40 p-5 hover:border-nanda-border transition-colors"
				>
					<div class="flex items-center gap-3 mb-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-primary-500/10 text-nanda-primary-400"
						>
							<card.icon class="h-4 w-4" />
						</div>
						<h3 class="text-sm font-semibold text-nanda-text">{card.title}</h3>
					</div>
					<p class="text-[13.5px] leading-relaxed text-nanda-text-muted">{card.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Flagship: Yanez interop with NANDA Town -->
	<section class="border-t border-nanda-border/40 py-14">
		<div class="flex flex-col lg:flex-row gap-10">
			<div class="lg:w-1/2">
				<div
					class="inline-flex items-center gap-2 rounded-full bg-nanda-primary-500/10 px-3 py-1 text-xs font-medium text-nanda-primary-300 mb-4"
				>
					Flagship interoperability
				</div>
				<h2 class="text-2xl sm:text-3xl font-extrabold text-nanda-text mb-3">
					Proof-of-human by Yanez — the first Homeport ↔ NANDA Town interop.
				</h2>
				<p class="text-[15px] text-nanda-text-muted leading-relaxed">
					Homeport nodes can mint a Yanez biometric challenge, hand a signed QR to a human, and
					receive a signed callback that anchors real personhood to an agent's AgentFacts record. It
					is the first public point of interoperability between a self-hosted NANDA node and NANDA
					Town — and it ships with this release under Apache-2.0.
				</p>
				<ul class="mt-5 space-y-2 text-[14px] text-nanda-text-muted">
					<li class="flex items-start gap-2">
						<span class="mt-1.5 h-1 w-1 rounded-full bg-nanda-primary-400 shrink-0"></span>
						Mint challenge · signed QR · deep link —
						<code class="text-nanda-text-muted">/api/yanez/challenge</code>
					</li>
					<li class="flex items-start gap-2">
						<span class="mt-1.5 h-1 w-1 rounded-full bg-nanda-primary-400 shrink-0"></span>
						Signed callback verification with BLS + Ed25519 —
						<code class="text-nanda-text-muted">/api/yanez/callback</code>
					</li>
					<li class="flex items-start gap-2">
						<span class="mt-1.5 h-1 w-1 rounded-full bg-nanda-primary-400 shrink-0"></span>
						Status polling with short-lived tokens —
						<code class="text-nanda-text-muted">/api/yanez/status</code>
					</li>
					<li class="flex items-start gap-2">
						<span class="mt-1.5 h-1 w-1 rounded-full bg-nanda-primary-400 shrink-0"></span>
						Operator toggle in
						<a
							href="/admin/settings"
							class="underline decoration-nanda-border hover:decoration-nanda-text-muted"
							>admin settings</a
						>
						— currently
						<strong class="text-nanda-text">{yanezEnabled ? 'enabled' : 'disabled'}</strong> on this node.
					</li>
				</ul>
			</div>
			<aside class="lg:w-1/2">
				<div class="rounded-xl border border-nanda-border/60 bg-nanda-bg-elevated/40 p-6">
					<div class="flex items-center gap-3 mb-4">
						<img
							src="/brand/yanez-logo-light.webp"
							alt="Yanez"
							class="h-8 w-auto"
							width="200"
							height="135"
							loading="lazy"
							decoding="async"
						/>
						<span class="text-xs text-nanda-text-dim"
							>Powered by <a
								href="https://www.yanez.ai/"
								rel="noopener"
								class="underline decoration-nanda-border hover:decoration-nanda-text-muted"
								>yanez.ai</a
							></span
						>
					</div>
					<p class="text-[13.5px] text-nanda-text-muted leading-relaxed mb-4">
						Biometric sign-and-return: your Homeport node mints a challenge, the human signs on
						their Yanez-enrolled device, and the node verifies the returned signature before
						attaching a proof-of-human badge to the agent record.
					</p>
					<div class="grid grid-cols-3 gap-3 text-center">
						<div class="rounded-lg border border-nanda-border/40 p-3">
							<div class="text-[11px] uppercase tracking-wider text-nanda-text-dim mb-1">1</div>
							<div class="text-[12px] text-nanda-text">Mint</div>
						</div>
						<div class="rounded-lg border border-nanda-border/40 p-3">
							<div class="text-[11px] uppercase tracking-wider text-nanda-text-dim mb-1">2</div>
							<div class="text-[12px] text-nanda-text">Sign</div>
						</div>
						<div class="rounded-lg border border-nanda-border/40 p-3">
							<div class="text-[11px] uppercase tracking-wider text-nanda-text-dim mb-1">3</div>
							<div class="text-[12px] text-nanda-text">Verify</div>
						</div>
					</div>
					<a
						href="/docs/api"
						class="mt-5 inline-flex items-center gap-1.5 text-sm text-nanda-primary-300 hover:text-white transition-colors"
					>
						Yanez API reference
						<ArrowRight class="h-3.5 w-3.5" />
					</a>
				</div>
			</aside>
		</div>
	</section>

	<!-- Quickstart pointer -->
	<section class="border-t border-nanda-border/40 py-14">
		<div class="grid gap-6 sm:grid-cols-3">
			<a
				href="/docs/quickstart"
				class="group rounded-xl border border-nanda-border/60 p-5 hover:border-nanda-text-dim transition-colors"
			>
				<Terminal class="h-5 w-5 text-nanda-primary-400 mb-3" />
				<h3 class="text-sm font-semibold text-nanda-text mb-1">Quickstart</h3>
				<p class="text-[13px] text-nanda-text-muted">Query your first agent in 60 seconds.</p>
				<span
					class="mt-3 inline-flex items-center gap-1 text-xs text-nanda-text-dim group-hover:text-nanda-text-muted"
				>
					Open guide
					<ArrowRight class="h-3 w-3" />
				</span>
			</a>
			<a
				href="/docs/self-hosting"
				class="group rounded-xl border border-nanda-border/60 p-5 hover:border-nanda-text-dim transition-colors"
			>
				<Server class="h-5 w-5 text-nanda-primary-400 mb-3" />
				<h3 class="text-sm font-semibold text-nanda-text mb-1">Self-host</h3>
				<p class="text-[13px] text-nanda-text-muted">
					Fork, configure Cloudflare bindings, deploy your own node.
				</p>
				<span
					class="mt-3 inline-flex items-center gap-1 text-xs text-nanda-text-dim group-hover:text-nanda-text-muted"
				>
					Open guide
					<ArrowRight class="h-3 w-3" />
				</span>
			</a>
			<a
				href="/docs"
				class="group rounded-xl border border-nanda-border/60 p-5 hover:border-nanda-text-dim transition-colors"
			>
				<BookOpen class="h-5 w-5 text-nanda-primary-400 mb-3" />
				<h3 class="text-sm font-semibold text-nanda-text mb-1">Documentation</h3>
				<p class="text-[13px] text-nanda-text-muted">
					Registry, trust, federation, and protocol references.
				</p>
				<span
					class="mt-3 inline-flex items-center gap-1 text-xs text-nanda-text-dim group-hover:text-nanda-text-muted"
				>
					Browse docs
					<ArrowRight class="h-3 w-3" />
				</span>
			</a>
		</div>
	</section>

	<!-- Cubicube managed CTA -->
	<section class="border-t border-nanda-border/40 py-14 mb-8">
		<div
			class="rounded-2xl border border-nanda-primary-500/30 bg-gradient-to-br from-nanda-primary-500/10 via-nanda-bg-elevated/40 to-nanda-bg-elevated/20 p-8 sm:p-10"
		>
			<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
				<div class="max-w-[620px]">
					<div class="flex items-center gap-2 mb-3">
						<img
							src="/brand/cubicube-logo.svg"
							alt="Cubicube"
							class="h-5 w-auto"
							width="86"
							height="20"
						/>
						<span class="text-xs uppercase tracking-[0.18em] text-nanda-text-dim font-semibold">
							Managed hosting
						</span>
					</div>
					<h2 class="text-2xl sm:text-3xl font-extrabold text-nanda-text mb-2">
						Prefer to skip the ops? Get a managed Homeport from Cubicube.
					</h2>
					<p class="text-[14.5px] text-nanda-text-muted leading-relaxed">
						Same codebase, provisioned, deployed, and kept current on your own domain — with
						bindings, secrets, and federation peers handled for you.
					</p>
				</div>
				<a
					href="https://cubicube.com"
					rel="noopener"
					class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-500 px-5 py-3 text-sm font-semibold text-white hover:bg-nanda-primary-400 transition-colors shrink-0"
				>
					Get a managed Homeport
					<ExternalLink class="h-4 w-4" />
				</a>
			</div>
		</div>
	</section>
</div>
