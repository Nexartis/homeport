<script lang="ts">
	import { page } from '$app/state';
	import {
		Scale,
		Calendar,
		Clock,
		Users,
		Globe,
		Shield,
		FileCheck,
		BookOpen,
		Layers,
		Building2
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>Governance at Scale | The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="How multistakeholder governance, transparent policy enforcement, and immutable audit trails enable responsible deployment of autonomous AI agents at population scale."
	/>
	<meta property="og:title" content="Part 6: Governance at Scale — Homeport" />
	<meta
		property="og:description"
		content="Multistakeholder governance for the Internet of AI Agents."
	/>
	<meta
		property="og:url"
		content="{page.data.registryUrl}/series/agentic-web/governance-at-scale"
	/>
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/series-agentic-web-governance-at-scale.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/series-agentic-web-governance-at-scale.png"
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
				><Clock class="h-4 w-4" />11 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">Governance at Scale</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			Building the Internet of AI Agents isn't just a technical challenge — it's a governance
			challenge. When trillions of autonomous agents operate across jurisdictions, industries, and
			trust boundaries, who writes the rules? Who enforces them? And how do you audit compliance at
			machine speed?
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><BookOpen class="h-3 w-3" /> Series: The Agentic Web</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Layers class="h-3 w-3" /> Part 6 of 6</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Scale class="h-5 w-5 text-nanda-accent" />The Governance Gap
			</h2>
			<p>
				The internet's original governance model — technical standards through the IETF, domain
				policy through ICANN, routing through regional registries — evolved over decades for a
				network of documents served to humans. It was never designed for a network of autonomous
				agents making consequential decisions at machine speed.
			</p>
			<p>
				Today's AI governance frameworks (the <a
					href="https://artificialintelligenceact.eu/"
					target="_blank"
					rel="noopener noreferrer">EU AI Act</a
				>,
				<a
					href="https://www.nist.gov/itl/ai-risk-management-framework"
					target="_blank"
					rel="noopener noreferrer">NIST AI RMF</a
				>,
				<a href="https://www.iso.org/standard/81230.html" target="_blank" rel="noopener noreferrer"
					>ISO 42001</a
				>) focus on <em>models</em> — training data, bias, fairness. They have almost nothing to say
				about <em>agents</em>: discovery, delegation chains, cross-jurisdictional capability
				negotiation, or real-time accountability. The
				<a href="https://arxiv.org/abs/2508.03095" target="_blank" rel="noopener noreferrer"
					>Registry Solutions survey</a
				> found that most agent registry architectures treat governance as an afterthought — a compliance
				checkbox, not an architectural layer.
			</p>
			<p>
				NANDA takes the opposite approach: governance is embedded in the protocol, not bolted on
				after deployment.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Users class="h-5 w-5 text-nanda-primary" />Multistakeholder Architecture
			</h2>
			<p>
				No single entity — not a government, not a corporation, not a standards body — should
				control the rules for agent interaction. NANDA's <a
					href="/series/agentic-web/trust-without-borders">Quilt architecture</a
				>
				embeds this principle structurally through its six
				<a href="/blog/quilt-architecture">registration patterns</a>:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Globe class="h-4 w-4 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Distributed Rule-Making</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Each registry in the Quilt sets its own policies — registration requirements, quality
						standards, compliance rules. Government registries (<code>@US:shop</code>) enforce
						jurisdiction-specific regulations. Enterprise registries (<code>@company</code>) enforce
						corporate policy. No single registry's rules apply globally.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Shield class="h-4 w-4 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">Bilateral Trust</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Registries choose which peers to federate with — <a
							href="/series/agentic-web/trust-without-borders"
							class="text-nanda-accent hover:underline">gossip-based federation</a
						> means trust is always bilateral and revocable. A healthcare registry can refuse to sync
						with a registry that doesn't meet HIPAA standards.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<FileCheck class="h-4 w-4 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Transparent Enforcement</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Policy enforcement produces cryptographic evidence — every registration decision, trust
						evaluation, and compliance check generates signed audit records that can be
						independently verified.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Building2 class="h-4 w-4 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">Jurisdictional Sovereignty</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Government-run registries maintain regulatory authority over agents in their
						jurisdiction while still participating in the global Quilt. EU data protection, US
						financial compliance, and Singapore AI governance rules coexist without conflict.
					</p>
				</div>
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<FileCheck class="h-5 w-5 text-nanda-accent" />Accountability at Machine Speed
			</h2>
			<p>
				Human governance operates on human timescales — quarterly audits, annual compliance reviews,
				multi-year enforcement actions. Agent governance must operate at machine speed. NANDA
				achieves this through three mechanisms:
			</p>
			<ol>
				<li>
					<strong>Immutable audit trails.</strong> Every agent interaction generates a signed
					receipt. Trust authorities like
					<a href="https://knowyourmodel.ai" target="_blank" rel="noopener noreferrer"
						>KnowYourModel</a
					>
					aggregate these into cryptographic
					<a href="/case-studies/kym-nanda-integration">usage receipts</a> stored on immutable infrastructure
					(IPFS). Auditors can verify the complete history of any agent's behaviour without relying on
					the agent's operator.
				</li>
				<li>
					<strong>Continuous credential evaluation.</strong> W3C Verifiable Credentials issued to agents
					include short-lived TTLs — AgentFacts credentials expire after 24 hours, TrustScore credentials
					after 5 minutes. This forces continuous re-evaluation, ensuring that a compromised or degraded
					agent loses its trusted status almost immediately.
				</li>
				<li>
					<strong>Real-time revocation.</strong>
					<a
						href="https://www.w3.org/TR/vc-bitstring-status-list/"
						target="_blank"
						rel="noopener noreferrer">Bitstring Status List</a
					> enables millisecond credential revocation that cascades through delegation chains. When a
					trust authority revokes an agent's credential, every downstream delegation is automatically
					invalidated.
				</li>
			</ol>
			<div class="callout callout-tip">
				<strong>Governance as infrastructure.</strong> Traditional compliance checks if rules were
				followed <em>after the fact</em>. NANDA's architecture makes non-compliance structurally
				difficult — an agent without valid credentials can't participate in the network, just as a
				packet without a valid TCP header can't traverse the internet.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />The Road to a Society of Agents
			</h2>
			<p>
				<a href="https://nanda.mit.edu/" target="_blank" rel="noopener noreferrer"
					>Project NANDA's three-phase roadmap</a
				> treats governance as an evolving capability that deepens with each stage:
			</p>
			<ul>
				<li>
					<strong>Phase 1 — Foundations:</strong> The NANDA Index, AgentFacts, and Quilt architecture
					establish the infrastructure for identity, discovery, and federated policy. This is where we
					are today.
				</li>
				<li>
					<strong>Phase 2 — Agentic Commerce:</strong> Knowledge pricing, edge AI markets, and economic
					protocols require governance mechanisms for fair exchange, dispute resolution, and market integrity.
				</li>
				<li>
					<strong>Phase 3 — Society of Agents:</strong> Large Population Models (LPMs), cross-silo collaborative
					learning, and privacy-preserving multi-agent coordination demand governance at civilisational
					scale — rules for billions of agents learning and transacting autonomously.
				</li>
			</ul>
			<p>
				The governance tools built in Phase 1 — cryptographic accountability, federated policy,
				bilateral trust — are the foundation that Phases 2 and 3 build upon. MIT's <a
					href="https://www.eecs.mit.edu/academics/iap-offerings/iap-2026/"
					target="_blank"
					rel="noopener noreferrer">IAP course 6.S192</a
				> ("Agentic Web: Networked AI Agents and Decentralized AI") is training the next generation of
				researchers and engineers in these governance frameworks.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Series Conclusion
			</h2>
			<p>
				Across six articles, we've traced the architecture of the agentic web from <a
					href="/series/agentic-web/new-architecture">first principles</a
				> to governance at scale:
			</p>
			<ul>
				<li>
					<strong>A new architecture</strong> — why the web needs a new infrastructure layer for autonomous
					agents
				</li>
				<li>
					<strong>Agent identity</strong> —
					<a href="/series/agentic-web/agent-identity"
						>AgentFacts, DIDs, and Verifiable Credentials</a
					> as the identity layer
				</li>
				<li>
					<strong>Trust without borders</strong> — the
					<a href="/series/agentic-web/trust-without-borders">Quilt architecture</a> for federated, decentralised
					trust
				</li>
				<li>
					<strong>Agent privacy</strong> —
					<a href="/series/agentic-web/agent-privacy">dual-path resolution</a> and privacy by design
				</li>
				<li>
					<strong>The security blueprint</strong> —
					<a href="/series/agentic-web/security-blueprint">ZTAA and AVC</a> for enterprise-grade protection
				</li>
				<li>
					<strong>Governance at scale</strong> — multistakeholder frameworks for responsible deployment
				</li>
			</ul>
			<p>
				The Internet of AI Agents isn't a distant future — it's being built now, in open-source
				code, research papers, and production deployments. NANDA provides the infrastructure to
				build it responsibly: discoverable, verifiable, private, secure, and governed by the many
				rather than the few.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Explore More
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/series/agentic-web" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						← Full Series Index
					</h4>
					<p class="text-xs text-nanda-text-dim">All six parts of The Agentic Web series.</p>
				</a>
				<a href="/blog/paradigm-shift" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						From Web Pages to AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The paradigm shift from document-centric to agent-native web.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
