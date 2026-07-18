<script lang="ts">
	import { page } from '$app/state';
	import { ShieldCheck, Globe, Zap, Lock, Network, Handshake } from 'lucide-svelte';
	import ShowcaseGrid from '$lib/components/ShowcaseGrid.svelte';

	const missionCards = [
		{
			icon: ShieldCheck,
			title: 'Verifiable Trust',
			desc: 'Cryptographic proof over marketing claims — Ed25519 signatures, W3C Verifiable Credentials, and Bitstring Status List revocation.'
		},
		{
			icon: Globe,
			title: 'Open Standards',
			desc: 'A2A Protocol, NANDA Index, AgentFacts — built on open specifications anyone can implement and verify.'
		},
		{
			icon: Zap,
			title: 'Edge-First Performance',
			desc: 'Globally distributed infrastructure — low latency, high availability, zero cold starts.'
		}
	];

	const principleCards = [
		{
			icon: Lock,
			title: 'Open Source',
			desc: 'NANDA is an open protocol — specification, reference implementation, and SDKs are publicly available under permissive licenses.'
		},
		{
			icon: Network,
			title: 'Decentralized by Design',
			desc: 'No single point of control. Nodes are independently operated and federate through gossip-based peer sync — like DNS, not a walled garden.'
		},
		{
			icon: ShieldCheck,
			title: 'Cryptographic Accountability',
			desc: 'Every credential, attestation, and reputation score is signed with Ed25519 keys. Trust is earned through math, not marketing.'
		},
		{
			icon: Handshake,
			title: 'Interoperability First',
			desc: 'Built on W3C, A2A, and MCP standards. Agents registered on any NANDA node can be discovered and verified by any other — across vendors, clouds, and runtimes.'
		}
	];

	const milestones = [
		{ date: '2024 Q3', label: 'NANDA protocol specification published' },
		{ date: '2024 Q4', label: 'First NANDA Node launched on Cloudflare edge' },
		{ date: '2025 Q1', label: 'A2A Protocol + MCP integration released' },
		{ date: '2025 Q2', label: 'Federation v2 — gossip-based peer sync live' },
		{ date: '2025 Q3', label: 'Lean Index + adaptive resolution engine' },
		{ date: '2025 Q4', label: 'Orchestration engine + SDK public beta' },
		{ date: '2026 Q1', label: 'Multi-currency billing + UCP checkout' },
		{ date: '2026 Q2', label: 'Trust Framework + ToIP alignment' }
	];
</script>

<svelte:head>
	<title>About — Homeport</title>
	<meta
		name="description"
		content="Homeport — trust and discovery infrastructure for AI agents, built by Nexartis."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/about.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/about.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4">
	<!-- Page Header -->
	<div
		class="py-12 pb-8 border-b border-nanda-border/40"
		style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
	>
		<h1 class="text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mb-3 gradient-text">
			Building the Trust Backbone for AI Agents
		</h1>
		<p class="text-nanda-text-muted max-w-[640px]">
			The Homeport is built by <strong class="text-nanda-text">Nexartis</strong> — a production NANDA
			protocol node providing naming, discovery, trust, and interoperability for the agentic web.
		</p>
	</div>

	<!-- Mission -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">Our Mission</h2>
		<p class="text-nanda-text-muted mb-8 max-w-[700px] text-[15px]">
			AI agents are increasingly delegating critical decisions to other AI agents. But there's no
			standardized way to discover, verify, or trust those agents across the open internet. NANDA
			solves this with decentralized infrastructure — and this node is part of that network.
		</p>
		<div class="grid md:grid-cols-3 gap-5">
			{#each missionCards as c}
				<div class="nanda-card">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-nanda-primary/10 mb-3"
					>
						<c.icon class="h-5 w-5 text-nanda-primary" />
					</div>
					<h3 class="font-semibold mb-2">{c.title}</h3>
					<p class="text-sm text-nanda-text-muted leading-relaxed">{c.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Principles -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">Our Principles</h2>
		<p class="text-nanda-text-muted mb-8 max-w-[700px] text-[15px]">
			The values that guide every technical and product decision we make.
		</p>
		<div class="grid md:grid-cols-2 gap-5">
			{#each principleCards as c}
				<div class="nanda-card">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-nanda-accent/10 mb-3"
					>
						<c.icon class="h-5 w-5 text-nanda-accent" />
					</div>
					<h3 class="font-semibold mb-2">{c.title}</h3>
					<p class="text-sm text-nanda-text-muted leading-relaxed">{c.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Key Milestones -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">Key Milestones</h2>
		<p class="text-nanda-text-muted mb-8 max-w-[700px] text-[15px]">
			Major moments in the evolution of the NANDA protocol and this node.
		</p>
		<div class="relative ml-4 border-l-2 border-nanda-border/50 pl-6 space-y-6">
			{#each milestones as m, i}
				<div class="relative">
					<div
						class="absolute -left-[calc(1.5rem+5px)] top-1 h-2.5 w-2.5 rounded-full {i ===
						milestones.length - 1
							? 'bg-nanda-accent ring-2 ring-nanda-accent/30'
							: 'bg-nanda-border'}"
					></div>
					<p class="text-xs font-mono text-nanda-accent mb-0.5">{m.date}</p>
					<p class="text-sm text-nanda-text-muted">{m.label}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- CTA -->
	<section class="py-14 text-center">
		<div
			class="rounded-2xl p-12"
			style="background:linear-gradient(135deg,rgba(105,66,230,0.1),rgba(12,211,218,0.1));border:1px solid rgba(105,66,230,0.2)"
		>
			<h2 class="text-2xl font-bold mb-3">Explore the NANDA Network</h2>
			<p class="text-nanda-text-muted mb-6 text-[15px] max-w-[600px] mx-auto">
				Whether you're a developer, enterprise, or AI platform — register your agents and join the
				decentralized trust network.
			</p>
			<div class="flex gap-3 justify-center flex-wrap">
				<a href="/docs/quickstart" class="nanda-btn-primary">Quickstart Guide →</a>
				<a
					href="https://github.com/Nexartis"
					target="_blank"
					rel="noopener"
					class="nanda-btn-secondary">View on GitHub</a
				>
			</div>
		</div>
	</section>

	<!-- Ecosystem -->
	<section class="py-16 border-t border-nanda-border">
		<div class="mx-auto max-w-4xl px-4 text-center">
			<p class="text-[10px] uppercase tracking-wider text-nanda-text-dim font-semibold mb-3">
				Part of the Nexartis Platform
			</p>
			<h2 class="text-2xl font-bold text-nanda-text mb-3">The Nexartis AI Trust Platform</h2>
			<p class="text-nanda-text-muted mb-8 max-w-xl mx-auto text-sm">
				NANDA Node and KnowYourModel work together — agent discovery infrastructure and trust
				registration for the AI ecosystem.
			</p>
			<div class="grid gap-4 sm:grid-cols-2 text-left">
				<div class="rounded-xl border border-nanda-accent/20 bg-nanda-accent/5 p-5">
					<div class="text-xs font-semibold text-nanda-accent uppercase tracking-wider mb-1">
						You are here
					</div>
					<h3 class="text-base font-bold text-nanda-text mb-1">NANDA Node</h3>
					<p class="text-sm text-nanda-text-muted">
						Agent discovery infrastructure — federation, certification, compliance, and the NANDA
						open protocol.
					</p>
				</div>
				<a
					href="https://knowyourmodel.ai"
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-xl border border-nanda-primary/20 bg-nanda-primary/5 p-5 hover:border-nanda-primary/40 transition-colors group"
				>
					<div
						class="text-xs font-semibold text-nanda-primary uppercase tracking-wider mb-1 flex items-center gap-1"
					>
						Explore <span class="text-xs">↗</span>
					</div>
					<h3
						class="text-base font-bold text-nanda-text mb-1 group-hover:text-nanda-accent transition-colors"
					>
						KnowYourModel
					</h3>
					<p class="text-sm text-nanda-text-muted">
						The Trust Registry for AI — multi-provider verification, trust scoring, and
						cryptographic attestations.
					</p>
				</a>
			</div>
		</div>
	</section>

	<section class="mt-16 border-t border-nanda-border pt-10">
		<h2 class="text-xl font-bold text-nanda-text mb-4">Standards & Specifications</h2>
		<p class="text-sm text-nanda-text-muted mb-4">
			NANDA is built on open standards. Learn more about the specifications we implement:
		</p>
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
			<a
				href="https://www.w3.org/TR/vc-data-model-2.0/"
				target="_blank"
				rel="noopener"
				class="text-sm text-nanda-primary hover:underline">W3C Verifiable Credentials v2.0</a
			>
			<a
				href="https://www.w3.org/TR/did-1.0/"
				target="_blank"
				rel="noopener"
				class="text-sm text-nanda-primary hover:underline">W3C DID Core</a
			>
			<a
				href="https://a2a-protocol.org/"
				target="_blank"
				rel="noopener"
				class="text-sm text-nanda-primary hover:underline">A2A Protocol</a
			>
			<a
				href="https://modelcontextprotocol.io/"
				target="_blank"
				rel="noopener"
				class="text-sm text-nanda-primary hover:underline">Model Context Protocol (MCP)</a
			>
			<a
				href="https://trustoverip.org/"
				target="_blank"
				rel="noopener"
				class="text-sm text-nanda-primary hover:underline">Trust over IP Foundation</a
			>
			<a
				href="https://datatracker.ietf.org/doc/html/rfc8032"
				target="_blank"
				rel="noopener"
				class="text-sm text-nanda-primary hover:underline">RFC 8032 — Ed25519</a
			>
		</div>
	</section>

	<!-- Born at the NANDA hackathon — fleet showcase -->
	<section class="mt-16 border-t border-nanda-border pt-12 pb-16" id="hackathon">
		<div class="mb-8">
			<p class="text-[10.5px] uppercase tracking-[0.18em] text-nanda-text-dim font-semibold mb-3">
				Born at the NANDA hackathon
			</p>
			<h2 class="text-2xl sm:text-3xl font-extrabold text-nanda-text mb-3">
				Nodes under development — built on the same template as Homeport.
			</h2>
			<p class="text-nanda-text-muted max-w-[720px] text-[15px] leading-relaxed">
				Homeport is the OSS release of the cubicube these teams shipped on during the NANDA
				hackathon — streaming micropayments, delegation tokens, live trust scoring, an agent-powered
				marketplace, a Formula 1 race-narration node, a storytelling world, a full cockpit for the
				agentic web. Every one of these is a NANDA node running the same code you can fork today.
			</p>
			<p class="mt-3 text-nanda-text-muted max-w-[720px] text-[15px] leading-relaxed">
				<strong class="text-nanda-text">What will you build on your Homeport?</strong>
			</p>
		</div>
		<ShowcaseGrid />
		<div class="mt-10 flex flex-wrap gap-3">
			<a
				href="/docs/quickstart"
				class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-nanda-primary-400 transition-colors"
			>
				Start your own node
			</a>
			<a
				href="https://github.com/Nexartis/homeport"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-2 rounded-lg border border-nanda-border px-4 py-2.5 text-sm font-medium text-nanda-text-muted hover:text-nanda-text hover:border-nanda-text-dim transition-colors"
			>
				Fork Homeport on GitHub
			</a>
		</div>
	</section>
</div>
