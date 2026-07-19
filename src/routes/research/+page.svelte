<script lang="ts">
	import { page } from '$app/state';
	import { Newspaper, BookOpen, FolderKanban } from 'lucide-svelte';
	const papers = [
		{
			title:
				'Beyond DNS: Unlocking the Internet of AI Agents via the NANDA Index and Verified AgentFacts',
			url: 'https://arxiv.org/abs/2507.14263',
			source: 'arXiv:2507.14263',
			desc: 'The foundational NANDA paper. Argues that the internet needs a new naming and discovery layer purpose-built for AI agents, and introduces the NANDA Index architecture.'
		},
		{
			title:
				'Upgrade or Switch: Do We Need a Next-Gen Trusted Architecture for the Internet of AI Agents?',
			url: 'https://arxiv.org/abs/2506.12003',
			source: 'arXiv:2506.12003',
			desc: 'Analyzes why traditional DNS and existing registries fail for AI agents, making the case for purpose-built agent discovery infrastructure.'
		},
		{
			title: 'NANDA Adaptive Resolver: Architecture for Dynamic Resolution of AI Agent Names',
			url: 'https://arxiv.org/abs/2508.03113',
			source: 'arXiv:2508.03113',
			desc: 'Presents the dynamic microservice architecture for agent name resolution in distributed environments, handling federation and failover.'
		},
		{
			title: 'Using the NANDA Index Architecture in Practice: An Enterprise Perspective',
			url: 'https://arxiv.org/abs/2508.03101',
			source: 'arXiv:2508.03101',
			desc: 'Explores Zero Trust Agentic Access (ZTAA), enterprise governance, and practical deployment patterns for NANDA in production environments.'
		},
		{
			title:
				'Evolution of AI Agent Registry Solutions: Centralized, Enterprise, and Distributed Approaches',
			url: 'https://arxiv.org/abs/2508.03095',
			source: 'arXiv:2508.03095',
			desc: 'Comparative survey of NANDA, MCP, A2A, Microsoft Entra, and other registry approaches, evaluating trade-offs in decentralization, trust, and interoperability.'
		}
	];

	const interopPapers = [
		{
			title: 'Towards Sandboxes for the Internet of Agents',
			url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5801322',
			source: 'SSRN:5801322',
			desc: 'Proposes a network of domain-specialized sandboxes to verify agent capabilities via signed, replayable attestations.'
		},
		{
			title: 'Collaborative Agentic AI Needs Interoperability Across Ecosystems',
			url: 'https://arxiv.org/abs/2505.21550',
			source: 'arXiv:2505.21550',
			desc: 'Proposes "Web of Agents," a minimal architectural foundation to ensure interoperability and prevent ecosystem fragmentation.'
		},
		{
			title: 'The Iceberg Index: Measuring Skills-centered Exposure in the AI Economy',
			url: 'https://arxiv.org/abs/2510.25137',
			source: 'arXiv:2510.25137',
			desc: 'Introduces the Iceberg Index using Large Population Models to measure skills-centered exposure to AI across the economy.'
		}
	];

	const ietfDrafts = [
		{
			name: 'agent-sd-jwt',
			id: 'draft-nandakumar-agent-sd-jwt-01',
			date: 'Oct 2025',
			desc: 'Selective Disclosure JWT for agent credentials — allows agents to reveal only the claims needed for a given interaction while keeping the rest private.'
		},
		{
			name: 'a2a-moqt-transport',
			id: 'draft-nandakumar-a2a-moqt-transport-00',
			date: 'Oct 2025',
			desc: 'Agent-to-Agent communication over Media over QUIC Transport (MOQT) — low-latency, multiplexed agent messaging built on the QUIC protocol.'
		}
	];

	const media = [
		{
			title: "They're Making TCP/IP For AI, And It's Called NANDA",
			src: 'Forbes · John Werner · Apr 2025'
		},
		{
			title: 'Make A Decentralized Internet With AI: NANDA Is Coming',
			src: 'Forbes · John Werner · May 2025'
		},
		{
			title: 'Line Up and Identify Yourselves — AI Agents Get Organized with NANDA',
			src: 'Forbes · John Werner · Jul 2025'
		},
		{
			title: "How MIT's Project NANDA Aims To Decentralize AI Agents",
			src: 'The New Stack · Oct 2025'
		},
		{ title: 'AI Codecon: Coding for the Agentic World', src: "O'Reilly Media · Ramesh Raskar" },
		{
			title: 'AI Agent Orchestration — 2026 Technology Predictions',
			src: 'Deloitte Insights · Nov 2025'
		}
	];
</script>

<svelte:head>
	<title>Research — Homeport</title>
	<meta
		name="description"
		content="NANDA protocol research papers, IETF drafts, and media coverage — the academic and standards foundation for decentralized AI agent infrastructure."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/research.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/research.png" />
</svelte:head>

<div class="mx-auto max-w-[1100px] px-4">
	<!-- Header -->
	<div
		class="py-12 pb-8 border-b border-nanda-border/40"
		style="background:linear-gradient(to bottom,rgba(105,66,230,0.04),transparent)"
	>
		<h1 class="text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mb-3 gradient-text">
			Research &amp; Standards
		</h1>
		<p class="text-nanda-text-muted max-w-[640px]">
			NANDA is grounded in peer-reviewed research from MIT Media Lab and active IETF standards work.
			These papers and drafts define the technical foundations for decentralized AI agent
			infrastructure.
		</p>
	</div>

	<!-- Cross-links -->
	<div class="flex flex-wrap gap-3 mt-8">
		<span class="text-xs text-nanda-text-dim self-center">Related content:</span>
		<a
			href="/blog"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<Newspaper class="h-3 w-3" />
			Blog
		</a>
		<a
			href="/series/agentic-web"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<BookOpen class="h-3 w-3" />
			The Agentic Web Series
		</a>
		<a
			href="/case-studies"
			class="inline-flex items-center gap-1.5 rounded-full border border-nanda-border/50 bg-nanda-bg-elevated px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-accent hover:border-nanda-accent/40 transition-colors"
		>
			<FolderKanban class="h-3 w-3" />
			Case Studies
		</a>
	</div>

	<!-- Papers -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">Core Research Papers</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px] max-w-[700px]">
			Five foundational papers define the NANDA architecture, covering agent discovery, trust,
			enterprise deployment, and comparative analysis of registry approaches.
		</p>
		<div class="grid gap-4">
			{#each papers as p}
				<a
					href={p.url}
					target="_blank"
					rel="noopener"
					class="nanda-card block group no-underline text-nanda-text"
				>
					<h3 class="font-semibold mb-1 group-hover:text-nanda-accent transition-colors">
						{p.title}
					</h3>
					<p class="text-xs text-nanda-primary mb-2">{p.source}</p>
					<p class="text-sm text-nanda-text-muted">{p.desc}</p>
				</a>
			{/each}
		</div>
	</section>

	<!-- Interoperability & Specialized Research -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">Interoperability &amp; Specialized Research</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px] max-w-[700px]">
			Research on agent sandboxing, cross-ecosystem interoperability, and workforce impact analysis.
		</p>
		<div class="grid gap-4">
			{#each interopPapers as p}
				<a
					href={p.url}
					target="_blank"
					rel="noopener"
					class="nanda-card block group no-underline text-nanda-text"
				>
					<h3 class="font-semibold mb-1 group-hover:text-nanda-accent transition-colors">
						{p.title}
					</h3>
					<p class="text-xs text-nanda-primary mb-2">{p.source}</p>
					<p class="text-sm text-nanda-text-muted">{p.desc}</p>
				</a>
			{/each}
		</div>
	</section>

	<!-- IETF -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">IETF Standards Drafts</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px] max-w-[700px]">
			NANDA contributors are actively working with the IETF to formalize agent identity and
			transport standards.
		</p>
		<div class="grid md:grid-cols-2 gap-4">
			{#each ietfDrafts as d}
				<div class="nanda-card">
					<h3 class="font-semibold mb-1">{d.name}</h3>
					<p class="text-xs text-nanda-primary mb-2">{d.id} · {d.date}</p>
					<p class="text-sm text-nanda-text-muted">{d.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Media -->
	<section class="py-14">
		<h2 class="text-2xl font-bold mb-2">Media &amp; Press</h2>
		<p class="text-nanda-text-muted mb-8 text-[15px] max-w-[700px]">
			NANDA has been featured across major tech publications and industry reports.
		</p>
		<div class="grid md:grid-cols-2 gap-4">
			{#each media as m}
				<div class="nanda-card">
					<h4 class="font-semibold text-sm mb-1">{m.title}</h4>
					<p class="text-xs text-nanda-primary">{m.src}</p>
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
			<h2 class="text-2xl font-bold mb-3">Explore the Protocol</h2>
			<p class="text-nanda-text-muted mb-6 text-[15px] max-w-[600px] mx-auto">
				Learn how NANDA provides DNS-like naming, trust, and discovery for AI agents.
			</p>
			<div class="flex gap-3 justify-center flex-wrap">
				<a href="/docs/nanda" class="nanda-btn-primary">What is NANDA →</a>
				<a
					href="https://projectnanda.org"
					target="_blank"
					rel="noopener"
					class="nanda-btn-secondary">Project NANDA ↗</a
				>
			</div>
		</div>
	</section>
</div>
