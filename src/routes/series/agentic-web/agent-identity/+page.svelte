<script lang="ts">
	import { page } from '$app/state';
	import {
		KeyRound,
		Calendar,
		Clock,
		Globe,
		Shield,
		FileCheck,
		BookOpen,
		Layers,
		Database
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import AgentFactsExplorer from '$lib/components/AgentFactsExplorer.svelte';
</script>

<svelte:head>
	<title>Agent Identity — Beyond DNS | The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="How AgentFacts, Decentralized Identifiers, and Verifiable Credentials give AI agents a portable, cryptographically provable identity on the open web."
	/>
	<meta property="og:title" content="Part 2: Agent Identity — Beyond DNS — Homeport" />
	<meta
		property="og:description"
		content="AgentFacts, DIDs, and verifiable credentials for the agentic web."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/series/agentic-web/agent-identity" />
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/series-agentic-web-agent-identity.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/series-agentic-web-agent-identity.png"
	/>
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
				><Clock class="h-4 w-4" />10 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">Agent Identity — Beyond DNS</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			DNS proves you control a domain. It says nothing about what you <em>do</em>, whether you're
			trustworthy, or whether you'll still be at that address tomorrow. For autonomous AI agents,
			that's not enough. AgentFacts, Decentralized Identifiers, and Verifiable Credentials provide
			the identity layer the agentic web demands.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><BookOpen class="h-3 w-3" /> Series: The Agentic Web</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Layers class="h-3 w-3" /> Part 2 of 6</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-accent" />The Identity Problem
			</h2>
			<p>
				When a human visits a website, a TLS certificate is enough. The padlock icon says: "This
				server controls example.com." But when an autonomous agent selects another agent to delegate
				a financial analysis task, it needs answers to fundamentally different questions:
			</p>
			<ul>
				<li>
					<strong>What can you do?</strong> — Capabilities, supported input/output modalities, latency
					budgets
				</li>
				<li>
					<strong>Who vouches for you?</strong> — Certifications, audit trails, trust scores backed by
					usage evidence
				</li>
				<li>
					<strong>How do I verify all of this without trusting any central authority?</strong>
				</li>
			</ul>
			<p>
				DNS answers none of these. <a
					href="https://www.w3.org/TR/did-1.0/"
					target="_blank"
					rel="noopener noreferrer">W3C Decentralized Identifiers (DIDs)</a
				>
				solve the <em>who</em>;
				<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener noreferrer"
					>Verifiable Credentials (VCs)</a
				>
				solve the <em>what</em>. The NANDA ecosystem weaves both into a unified identity layer
				through the <strong>AgentFacts</strong> format.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Database class="h-5 w-5 text-nanda-primary" />The Three-Layer Architecture
			</h2>
			<p>
				The NANDA Index resolves agent identity through three tiers, each designed for a different
				performance profile:
			</p>
			<div class="not-prose grid gap-3 my-6">
				<div class="nanda-card">
					<h4 class="text-xs font-semibold text-nanda-primary uppercase tracking-wider mb-1">
						Layer 1 — Anchor Tier
					</h4>
					<h3 class="text-sm font-bold text-nanda-text mb-1">Index Layer</h3>
					<p class="text-xs text-nanda-text-muted">
						Stores minimal <strong>AgentAddr</strong> records (≤120 bytes): agent ID, metadata URL, and
						routing pointer. Optimised for sub-millisecond lookups at trillion-record scale. Write operations
						are reduced by 10,000× compared to DNS because only static identity lives here.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="text-xs font-semibold text-nanda-accent uppercase tracking-wider mb-1">
						Layer 2 — Metadata Distribution Tier
					</h4>
					<h3 class="text-sm font-bold text-nanda-text mb-1">AgentFacts Layer</h3>
					<p class="text-xs text-nanda-text-muted">
						Rich, verifiable metadata: capabilities, skills, endpoints, performance metrics,
						certifications, and W3C Verifiable Credentials. Hosted by the agent's provider or a
						trusted third party. Cacheable and independently verifiable.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="text-xs font-semibold text-nanda-text-dim uppercase tracking-wider mb-1">
						Layer 3 — Adaptive Routing Tier
					</h4>
					<h3 class="text-sm font-bold text-nanda-text mb-1">Dynamic Resolution</h3>
					<p class="text-xs text-nanda-text-muted">
						Real-time endpoint discovery with geographic, load-based, and threat-aware routing
						policies. Handles agents that move between runtimes or require edge-optimised dispatch.
					</p>
				</div>
			</div>
			<p>
				The resolution flow is: <code
					>AgentName → NANDA Index → AgentAddr → AgentFacts → Agent Endpoint</code
				>. By separating static identity from dynamic metadata and live routing, each layer can
				scale independently — the Index handles billions of lookups per second while AgentFacts
				documents update in real time without touching the core Index.
			</p>
			<AgentFactsExplorer />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<FileCheck class="h-5 w-5 text-nanda-accent" />The AgentFacts Format
			</h2>
			<p>
				AgentFacts is an <a
					href="https://github.com/projnanda/agentfacts-format"
					target="_blank"
					rel="noopener noreferrer">open JSON schema</a
				>
				that extends the basic <a href="/blog/nanda-a2a-mcp">A2A Agent Card</a> concept with the fields
				agents actually need for trust, discovery, and commerce. Every AgentFacts document contains:
			</p>
			<ul>
				<li>
					<strong>Identity</strong> — Unique ID, URN-based agent name, human-readable label, version,
					and jurisdiction
				</li>
				<li>
					<strong>Provider</strong> — Organisation details with optional
					<a href="https://www.w3.org/TR/did-1.0/" target="_blank" rel="noopener noreferrer">DID</a
					>-based verification
				</li>
				<li>
					<strong>Endpoints</strong> — Static API URLs plus adaptive resolver configuration with geo/load/threat-shield
					policies
				</li>
				<li>
					<strong>Capabilities</strong> — Supported modalities (text, audio, video, image), authentication
					methods, streaming and batch support
				</li>
				<li>
					<strong>Skills</strong> — Fine-grained skill definitions with input/output modes, language support,
					token limits, and latency budgets
				</li>
				<li>
					<strong>Evaluations</strong> — Performance scores, availability stats, audit trails stored on
					immutable infrastructure (e.g. IPFS), and third-party auditor IDs
				</li>
				<li>
					<strong>Telemetry</strong> — Real-time metrics: p95 latency, throughput, error rate, with configurable
					retention and sampling
				</li>
				<li>
					<strong>Certification</strong> — Trust level (self-declared, verified, audited), issuer, and
					validity period
				</li>
			</ul>
			<p>
				The format is designed for <strong>progressive disclosure</strong>. A minimal AgentFacts
				document requires only identity, provider, endpoints, capabilities, and skills — the eight
				required fields from the JSON schema. Advanced fields like evaluations, telemetry, and
				certification are optional but become critical as agents participate in higher-stakes
				interactions.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<KeyRound class="h-5 w-5 text-nanda-primary" />DIDs and Verifiable Credentials
			</h2>
			<p>
				AgentFacts provides the <em>what</em> — rich capability metadata. But how do you know the
				metadata is authentic? This is where <strong>Decentralized Identifiers</strong> and
				<strong>Verifiable Credentials</strong> complete the picture.
			</p>
			<p>
				A DID like <code>did:web:knowyourmodel.ai:agents:abc123</code> is a globally resolvable identifier
				that any system on the internet can verify without trusting a central authority. The agent's provider
				controls the DID document, which contains the public keys needed to verify signatures on the agent's
				credentials.
			</p>
			<p>
				Trust authorities like <a
					href="https://knowyourmodel.ai"
					target="_blank"
					rel="noopener noreferrer">KnowYourModel</a
				>
				then issue
				<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener noreferrer"
					>W3C Verifiable Credentials</a
				>
				that attest to specific claims about the agent — its capabilities, its trust score, its compliance
				status. Each VC is signed with the <strong>EdDSA</strong> cryptographic suite (<a
					href="https://www.w3.org/TR/vc-di-eddsa/"
					target="_blank"
					rel="noopener noreferrer">eddsa-rdfc-2022</a
				>) and includes
				<a
					href="https://www.w3.org/TR/vc-bitstring-status-list/"
					target="_blank"
					rel="noopener noreferrer">Bitstring Status List</a
				> revocation, meaning any credential can be invalidated instantly without waiting for a certificate
				to expire.
			</p>
			<div class="callout callout-info">
				<strong>Portable trust.</strong>
				Because trust scores travel as signed VCs served from the agent's <code>/facts</code>
				endpoint, an agent's reputation is not locked into any single registry. A trust score earned through
				KYM is verifiable by <em>any</em> NANDA participant — no API keys, platform accounts, or intermediaries
				required.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-accent" />Why This Matters
			</h2>
			<p>
				The combination of AgentFacts + DIDs + VCs creates an identity system with properties that
				no prior web architecture provides:
			</p>
			<div class="not-prose overflow-x-auto my-6">
				<table class="w-full text-sm border border-nanda-border/40">
					<thead>
						<tr class="bg-nanda-bg-alt/50">
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Property</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Traditional Web</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>NANDA Identity</th
							>
						</tr>
					</thead>
					<tbody class="text-nanda-text-muted">
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Scale</td><td class="px-3 py-2"
								>Millions of static records</td
							><td class="px-3 py-2">Billions of dynamic agents</td></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Update speed</td><td
								class="px-3 py-2">Minutes to hours</td
							><td class="px-3 py-2">Sub-second global resolution</td></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Trust model</td><td
								class="px-3 py-2">Proves domain ownership</td
							><td class="px-3 py-2">Cryptographically signed capabilities</td></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Privacy</td><td class="px-3 py-2"
								>Exposes lookup patterns</td
							><td class="px-3 py-2">Privacy-preserving resolution paths</td></tr
						>
						<tr
							><td class="px-3 py-2 font-medium text-nanda-text">Flexibility</td><td
								class="px-3 py-2">Fixed endpoints</td
							><td class="px-3 py-2">Adaptive, geo-aware routing</td></tr
						>
					</tbody>
				</table>
			</div>
			<p>
				In <a href="/series/agentic-web/trust-without-borders">Part 3</a>, we'll explore how these
				identities compose into trust networks through the
				<a href="/blog/quilt-architecture">Quilt architecture</a> — the federated registry model that
				lets trust scale across organisational boundaries without a central authority.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/series/agentic-web/trust-without-borders" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Part 3: Trust Without Borders →
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The Quilt architecture and federated registries for decentralized trust.
					</p>
				</a>
				<a href="/blog/agentfacts" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						AgentFacts: The Specification
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Deep dive into the credential format powering agent identity.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
