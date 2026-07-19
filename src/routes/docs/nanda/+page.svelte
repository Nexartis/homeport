<script lang="ts">
	import { page } from '$app/state';
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
			title: 'The Iceberg Index: Measuring Workforce Exposure Across the AI Economy',
			url: 'https://arxiv.org/abs/2510.25137',
			source: 'arXiv:2510.25137',
			desc: 'Introduces the Iceberg Index using Large Population Models to measure workforce exposure to AI based on underlying skills.'
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
	<title>Project NANDA — The DNS for AI Agents</title>
	<meta
		name="description"
		content="Networked AI Agents in Decentralized Architecture — the open protocol providing DNS-like naming, trust, and discovery for the agentic web."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-nanda.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/docs-nanda.png" />
</svelte:head>

<div class="prose">
	<h1>Project NANDA</h1>
	<p>
		<strong>Networked AI Agents in Decentralized Architecture</strong> — the open protocol providing DNS-like
		naming, trust, and discovery for the agentic web.
	</p>

	<h2>What is Project NANDA?</h2>
	<p>
		NANDA is an open agent discovery protocol that originated at <strong>MIT Media Lab</strong>.
		Think of it as <strong>DNS for AI agents</strong> — a decentralized infrastructure where agents can
		be named, discovered, verified, and connected across the entire internet.
	</p>
	<p>NANDA addresses four critical choke points for AI agents on the open web:</p>

	<div class="grid md:grid-cols-3 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<div class="text-3xl mb-3 text-nanda-accent">⬡</div>
			<h3 class="font-semibold mb-2">DNS — Naming &amp; Discovery</h3>
			<p class="text-sm text-nanda-text-muted">
				Human-readable agent names that resolve to machine-readable endpoints, just as DNS resolves
				domain names to IP addresses.
			</p>
		</div>
		<div class="nanda-card">
			<div class="text-3xl mb-3 text-nanda-accent">⬡</div>
			<h3 class="font-semibold mb-2">CA — Trust &amp; Certificates</h3>
			<p class="text-sm text-nanda-text-muted">
				Cryptographic trust infrastructure using W3C Verifiable Credentials and DID-based identity
				for agent authentication.
			</p>
		</div>
		<div class="nanda-card">
			<div class="text-3xl mb-3">🤖</div>
			<h3 class="font-semibold mb-2">Orchestration</h3>
			<p class="text-sm text-nanda-text-muted">
				Coordination protocols for multi-agent task delegation, skill matching, and workflow
				composition across heterogeneous systems.
			</p>
		</div>
	</div>
	<div class="grid max-w-[400px] gap-4 my-6 not-prose">
		<div class="nanda-card">
			<div class="text-3xl mb-3">✅</div>
			<h3 class="font-semibold mb-2">Attestation</h3>
			<p class="text-sm text-nanda-text-muted">
				Verifiable claims about agent capabilities, behavior history, and compliance —
				cryptographically signed and independently verifiable.
			</p>
		</div>
	</div>

	<p>
		The project operates with a three-pronged approach: <strong>(1) Technology</strong> — open
		standards and reference implementations, <strong>(2) Social Mission</strong> — building an open
		Agentic Web accessible to everyone, and <strong>(3) Venture Ecosystem</strong> — a coalition of founders
		and investors building on the protocol.
	</p>

	<div class="callout callout-info">
		<strong>KYM's Role</strong>
		<a href="https://knowyourmodel.ai">KnowYourModel</a> integrates with NANDA as a trust layer. Agents
		registered in KYM receive DID-based identity and W3C Verifiable Credentials that travel with them
		across the NANDA network — verified anywhere, trusted everywhere.
	</div>

	<h2>NANDA by the Numbers</h2>
	<p class="text-xs text-nanda-text-muted">
		Ecosystem stats reflect Project NANDA figures published at
		<a href="https://projectnanda.org" target="_blank" rel="noopener">projectnanda.org</a> (July 2026).
	</p>
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 my-6 not-prose">
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">6,000+</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Community</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">61</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Collaborations</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">15+</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Papers</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">100+</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Speakers</div>
		</div>
	</div>
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 my-6 not-prose">
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">50+</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Webinars</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">12</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Hackathons</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">75+</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Projects</div>
		</div>
		<div class="nanda-card text-center">
			<div class="text-2xl font-bold gradient-text">18</div>
			<div class="text-xs text-nanda-text-muted mt-1 uppercase tracking-wider">Locations</div>
		</div>
	</div>

	<h2>Technical Architecture</h2>
	<p>
		NANDA's architecture is built around a set of interlocking components that together provide
		naming, discovery, trust, and interoperability for AI agents:
	</p>

	<h3>NANDA Index</h3>
	<p>
		The decentralized agent registry — the core discovery layer. Agents register with the index and
		become discoverable by any system on the internet. Analogous to DNS zone files for the agentic
		web.
	</p>

	<h3>AgentAddr (~120 bytes)</h3>
	<p>
		Lean index records that provide the minimum information needed to locate and connect to an agent
		— identifier, endpoint URL, protocol type, and capability summary. Designed for efficient
		global-scale indexing.
	</p>

	<h3>AgentFacts (W3C Verifiable Credentials)</h3>
	<p>
		Rich agent metadata encoded as JSON-LD documents and signed with Ed25519 keys. Include skills,
		capabilities, trust scores, input/output modes, and compliance attestations — independently
		verifiable by any party.
	</p>

	<h3>NANDA Adaptive Resolver</h3>
	<p>
		A dynamic microservice architecture for agent name resolution in distributed environments.
		Routes agent discovery queries to the appropriate index nodes, handling federation, caching, and
		failover.
	</p>

	<h3>Protocol Bridges</h3>
	<p>
		Cross-platform interoperability layer bridging <strong>A2A</strong> (Agent-to-Agent),
		<strong>MCP</strong>
		(Model Context Protocol), and <strong>HTTPS</strong> agent endpoints. Agents built on any protocol
		can discover and communicate with agents on any other.
	</p>

	<h3>Zero Trust Agentic Access (ZTAA)</h3>
	<p>
		Enterprise governance framework explored in the NANDA enterprise paper. Applies zero-trust
		principles — verify explicitly, least privilege, assume breach — to inter-agent communication
		and delegation.
	</p>

	<!-- Research Foundation -->
	<h2>Research Foundation</h2>
	<p>
		NANDA is grounded in peer-reviewed research. Eight key papers define the technical foundations,
		interoperability vision, and societal impact:
	</p>

	<h3>Foundational Architecture</h3>
	<div class="grid gap-4 my-6 not-prose">
		{#each papers as p}
			<div class="nanda-card">
				<h4 class="font-semibold mb-1">
					<a
						href={p.url}
						target="_blank"
						rel="noopener"
						class="text-nanda-text hover:text-nanda-accent transition-colors">{p.title}</a
					>
				</h4>
				<p class="text-xs text-nanda-primary mb-1.5">{p.source}</p>
				<p class="text-sm text-nanda-text-muted">{p.desc}</p>
			</div>
		{/each}
	</div>

	<h3>Interoperability &amp; Specialized Research</h3>
	<div class="grid gap-4 my-6 not-prose">
		{#each interopPapers as p}
			<div class="nanda-card">
				<h4 class="font-semibold mb-1">
					<a
						href={p.url}
						target="_blank"
						rel="noopener"
						class="text-nanda-text hover:text-nanda-accent transition-colors">{p.title}</a
					>
				</h4>
				<p class="text-xs text-nanda-primary mb-1.5">{p.source}</p>
				<p class="text-sm text-nanda-text-muted">{p.desc}</p>
			</div>
		{/each}
	</div>

	<h3>IETF Standards Work</h3>
	<p>
		NANDA contributors are actively working with the IETF to formalize agent identity and transport
		standards:
	</p>
	<div class="grid md:grid-cols-2 gap-4 my-4 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">agent-sd-jwt</h4>
			<p class="text-xs text-nanda-primary mb-1.5">draft-nandakumar-agent-sd-jwt-01 · Oct 2025</p>
			<p class="text-sm text-nanda-text-muted">
				Selective Disclosure JWT for agent credentials — allows agents to reveal only the claims
				needed for a given interaction while keeping the rest private.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">a2a-moqt-transport</h4>
			<p class="text-xs text-nanda-primary mb-1.5">
				draft-nandakumar-a2a-moqt-transport-00 · Oct 2025
			</p>
			<p class="text-sm text-nanda-text-muted">
				Agent-to-Agent communication over Media over QUIC Transport (MOQT) — low-latency,
				multiplexed agent messaging built on the QUIC protocol.
			</p>
		</div>
	</div>

	<!-- Development Roadmap -->
	<h2>Development Roadmap</h2>
	<p>
		NANDA's development is organized in three phases, progressively expanding from foundational
		infrastructure to a full agentic economy:
	</p>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-green-500">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-green-500 mb-2">
				⬤ Current
			</p>
			<h3 class="font-semibold mb-1">Phase 1 — Foundations</h3>
			<p class="text-sm text-nanda-text-muted mb-2">
				<strong class="text-nanda-text">Onboarding, Indexing, &amp; Discovery</strong>
			</p>
			<ul class="text-sm text-nanda-text-muted pl-5 list-disc space-y-1">
				<li>NANDA Index — decentralized agent registry</li>
				<li>Cross-Platform Bridge for A2A, MCP, and HTTPS endpoints</li>
				<li>Agent Onboarding SDKs and developer tooling</li>
				<li>NEST Sandbox &amp; Testbed for experimentation</li>
			</ul>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-amber-500">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-2">
				◯ Upcoming
			</p>
			<h3 class="font-semibold mb-1">Phase 2 — Agentic Commerce</h3>
			<p class="text-sm text-nanda-text-muted mb-2">
				<strong class="text-nanda-text">Knowledge Pricing, Edge AI, Economic Protocols</strong>
			</p>
			<ul class="text-sm text-nanda-text-muted pl-5 list-disc space-y-1">
				<li>Economic protocols for agent-to-agent value exchange</li>
				<li>Knowledge pricing and edge AI inference markets</li>
				<li>Trust-weighted routing and reputation economics</li>
			</ul>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary">
			<p class="text-[11px] font-semibold uppercase tracking-widest text-nanda-primary mb-2">
				◯ Future
			</p>
			<h3 class="font-semibold mb-1">Phase 3 — Society of Agents</h3>
			<p class="text-sm text-nanda-text-muted mb-2">
				<strong class="text-nanda-text"
					>LPMs, Collaborative Learning, Cross-Silo Coordination</strong
				>
			</p>
			<ul class="text-sm text-nanda-text-muted pl-5 list-disc space-y-1">
				<li>Large Population Models (LPMs) for agent coordination at scale</li>
				<li>Collaborative learning across agent networks</li>
				<li>Cross-silo coordination and federated governance</li>
			</ul>
		</div>
	</div>

	<!-- Media & Press -->
	<h2>Media &amp; Press</h2>
	<p>NANDA has been featured across major tech publications and industry reports:</p>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		{#each media as m}
			<div class="nanda-card">
				<h4 class="font-semibold mb-1 text-sm">{m.title}</h4>
				<p class="text-xs text-nanda-primary">{m.src}</p>
			</div>
		{/each}
	</div>

	<h3>NEST — NANDA Sandbox &amp; Testbed</h3>
	<p>
		<strong>NEST</strong> (NANDA Sandbox and Testbed) is the Python-based framework for building and experimenting
		with NANDA agents. It provides a local development environment where developers can build, test, and
		register agents before publishing to the live NANDA network.
	</p>
	<div class="callout callout-tip">
		<strong>Try it</strong>
		Visit
		<a href="https://nest.projectnanda.org" target="_blank" rel="noopener">nest.projectnanda.org</a> to
		get started with the NEST framework and build your first NANDA-compatible agent.
	</div>

	<!-- Get Involved -->
	<h2>Get Involved</h2>
	<p>NANDA is an open community with multiple ways to participate:</p>

	<h3>Community Channels</h3>
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 not-prose">
		<div class="nanda-card text-center">
			<div class="text-3xl mb-2 text-nanda-accent">⬡</div>
			<h4 class="font-semibold text-sm mb-1">Discord</h4>
			<p class="text-xs text-nanda-text-muted">Community discussions &amp; support</p>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl mb-2 text-nanda-accent">⬡</div>
			<h4 class="font-semibold text-sm mb-1">Lu.ma Events</h4>
			<p class="text-xs text-nanda-text-muted">Meetups, talks &amp; workshops</p>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl mb-2 text-nanda-accent">⬡</div>
			<h4 class="font-semibold text-sm mb-1">YouTube</h4>
			<p class="text-xs text-nanda-text-muted">Talks, demos &amp; tutorials</p>
		</div>
		<div class="nanda-card text-center">
			<div class="text-3xl mb-2 text-nanda-accent">⬡</div>
			<h4 class="font-semibold text-sm mb-1">GitHub</h4>
			<p class="text-xs text-nanda-text-muted">Open source repos &amp; specs</p>
		</div>
	</div>

	<h3>Fellowships &amp; Education</h3>
	<div class="grid md:grid-cols-2 gap-4 my-4 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold text-sm mb-1">FAN Fellowship</h4>
			<p class="text-sm text-nanda-text-muted">
				Fellowship program for NANDA ecosystem builders and researchers
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold text-sm mb-1">Tresata Fellowship</h4>
			<p class="text-sm text-nanda-text-muted">
				Data-focused fellowship at the intersection of AI agents and data governance
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold text-sm mb-1">Radius Fellowship</h4>
			<p class="text-sm text-nanda-text-muted">
				Applied research fellowship for decentralized agent infrastructure
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold text-sm mb-1">MIT IAP 6.S192</h4>
			<p class="text-sm text-nanda-text-muted">
				MIT Independent Activities Period course on building for the agentic web (January 2026)
			</p>
		</div>
	</div>

	<h3>Learn More</h3>
	<ul>
		<li>
			<a href="https://projectnanda.org" target="_blank" rel="noopener"
				><strong>Project NANDA</strong></a
			> — Official project site
		</li>
		<li>
			<a href="https://www.linkedin.com/company/projectnanda/" target="_blank" rel="noopener"
				><strong>NANDA on LinkedIn</strong></a
			> — Follow for updates, events, and research announcements
		</li>
		<li>
			<a href="https://a2a-protocol.org/" target="_blank" rel="noopener"
				><strong>A2A Protocol Documentation</strong></a
			> — Agent-to-agent communication standard used alongside NANDA
		</li>
	</ul>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/paradigm-shift">The Paradigm Shift</a> — why the agent economy needs a new
		infrastructure layer ·
		<a href="/blog/why-dns-fails">Why DNS Fails for Agents</a> — the limitations of traditional
		discovery ·
		<a href="/series/agentic-web">The Agentic Web</a> — a six-part series exploring the future of agent
		infrastructure
	</div>
</div>
