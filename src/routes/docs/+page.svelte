<script lang="ts">
	import { page } from '$app/state';
	import {
		Globe,
		Rocket,
		Plug,
		Radio,
		Network,
		ShieldCheck,
		ClipboardList,
		Settings,
		Workflow,
		Bell,
		Wrench,
		Database,
		Search,
		CreditCard,
		Code
	} from 'lucide-svelte';

	interface DocTopic {
		icon: typeof Globe;
		href: string;
		title: string;
		desc: string;
	}

	const sections: { label: string; topics: DocTopic[] }[] = [
		{
			label: 'Getting Started',
			topics: [
				{
					icon: Globe,
					href: '/docs/nanda',
					title: 'What is NANDA',
					desc: 'Networked AI Agents in Decentralized Architecture — the open protocol providing DNS-like naming, trust, and discovery for the agentic web.'
				},
				{
					icon: Rocket,
					href: '/docs/quickstart',
					title: 'Quickstart',
					desc: 'Get up and running with the NANDA API in under 5 minutes — register your first agent with a single curl command.'
				},
				{
					icon: Radio,
					href: '/docs/api',
					title: 'API Reference',
					desc: 'Complete REST API documentation — 100+ endpoints for registration, discovery, federation, trust, orchestration, and billing.'
				}
			]
		},
		{
			label: 'Protocol & Integration',
			topics: [
				{
					icon: Plug,
					href: '/docs/a2a',
					title: 'A2A Protocol',
					desc: 'The Agent-to-Agent JSON-RPC protocol for interoperable agentic communication. Discover agents, delegate tasks, stream results.'
				},
				{
					icon: Network,
					href: '/docs/federation',
					title: 'Federation',
					desc: 'Pull-based peer-to-peer registry synchronization — how NANDA nodes share agent registrations across the decentralized network.'
				},
				{
					icon: Wrench,
					href: '/docs/mcp',
					title: 'MCP Integration',
					desc: 'Model Context Protocol server with 15 tools — connect AI assistants directly to the NANDA registry for agent lookup, orchestration, and trust.'
				},
				{
					icon: Code,
					href: '/docs/sdk',
					title: 'SDK & Libraries',
					desc: 'TypeScript SDK, code examples, and integration guides for building with the NANDA API.'
				},
				{
					icon: Search,
					href: '/docs/resolver',
					title: 'Resolution & Discovery',
					desc: 'Lean Index AgentAddr, adaptive multi-strategy resolution, SafeSearch filtering, and Switchboard protocol bridging.'
				}
			]
		},
		{
			label: 'Trust & Credentials',
			topics: [
				{
					icon: ShieldCheck,
					href: '/docs/trust',
					title: 'Trust & Security',
					desc: 'Ed25519 signing, W3C Verifiable Credentials, Bitstring Status List revocation, and Wilson confidence interval scoring.'
				},
				{
					icon: ClipboardList,
					href: '/docs/agentfacts',
					title: 'AgentFacts',
					desc: 'Rich agent metadata as W3C VCs — skills, capabilities, trust scores, input/output modes, and compliance attestations.'
				},
				{
					icon: Database,
					href: '/docs/data-model',
					title: 'Data Model',
					desc: '53-table Drizzle ORM schema across 21 domains — complete reference for the NANDA node data architecture.'
				}
			]
		},
		{
			label: 'Infrastructure & Operations',
			topics: [
				{
					icon: Settings,
					href: '/docs/infrastructure',
					title: 'Infrastructure',
					desc: 'Purpose-built services powering the NANDA network — Registry, Certifier, Compliance, Observer, and Auditor.'
				},
				{
					icon: Workflow,
					href: '/docs/orchestration',
					title: 'Orchestration',
					desc: 'Multi-agent workflow orchestration — DAG engine, templates, A2A routing, sub-agent delegation, streaming, and conflict resolution.'
				},
				{
					icon: Bell,
					href: '/docs/webhooks',
					title: 'Webhooks',
					desc: 'Real-time event notifications for agent registrations, certifications, reputation changes, and compliance alerts.'
				},
				{
					icon: CreditCard,
					href: '/docs/billing',
					title: 'Billing & Payments',
					desc: 'Subscriptions, invoices, revenue sharing, multi-currency support, and Universal Checkout Protocol (UCP).'
				}
			]
		}
	];
</script>

<svelte:head>
	<title>Documentation — Homeport</title>
	<meta
		name="description"
		content="Homeport documentation — guides, API reference, and architecture overview for building on the NANDA agent discovery network."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs.png" />
</svelte:head>

<div
	class="pb-8 mb-8 border-b border-nanda-border/40"
	style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
>
	<h1 class="text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mb-3 gradient-text">Documentation</h1>
	<p class="text-nanda-text-muted max-w-[640px]">
		Learn how Homeport works — trust and discovery infrastructure for AI agents, built by Nexartis.
	</p>
</div>

{#each sections as section, i}
	<div class={i > 0 ? 'mt-10' : ''}>
		<h2 class="text-lg font-semibold text-nanda-text-muted mb-4">{section.label}</h2>
		<div class="grid gap-4" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
			{#each section.topics as t}
				<a href={t.href} class="nanda-card block text-nanda-text no-underline">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-nanda-primary/10 mb-3"
					>
						<t.icon class="h-5 w-5 text-nanda-primary" />
					</div>
					<h3 class="font-semibold mb-2">{t.title}</h3>
					<p class="text-sm text-nanda-text-muted leading-relaxed">{t.desc}</p>
				</a>
			{/each}
		</div>
	</div>
{/each}

<!-- Ecosystem cross-link -->
<div class="mt-10">
	<a
		href="https://knowyourmodel.ai/docs"
		target="_blank"
		rel="noopener noreferrer"
		class="block rounded-xl border border-nanda-primary/30 bg-gradient-to-r from-nanda-primary/5 to-nanda-accent/5 p-6 hover:border-nanda-primary/50 transition-colors group"
	>
		<div class="flex items-center gap-4">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-lg bg-nanda-primary/10 shrink-0"
			>
				<ShieldCheck class="h-5 w-5 text-nanda-primary" />
			</div>
			<div class="flex-1">
				<h3
					class="text-base font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors"
				>
					KnowYourModel Documentation →
				</h3>
				<p class="text-sm text-nanda-text-muted mt-0.5">
					Trust registry docs — registries, voting, payments, and multi-provider aggregation.
				</p>
			</div>
		</div>
	</a>
</div>

<div class="mt-14 text-center">
	<div
		class="rounded-2xl p-12"
		style="background:linear-gradient(135deg,rgba(105,66,230,0.1),rgba(12,211,218,0.1));border:1px solid rgba(105,66,230,0.2)"
	>
		<h2 class="text-2xl font-bold mb-3">Ready to get started?</h2>
		<p class="text-nanda-text-muted mb-6 text-[15px] max-w-[600px] mx-auto">
			Register your first agent in under 5 minutes with the NANDA Quickstart guide.
		</p>
		<a href="/docs/quickstart" class="nanda-btn-primary">Quickstart Guide →</a>
	</div>
</div>
