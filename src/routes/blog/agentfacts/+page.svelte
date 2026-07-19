<script lang="ts">
	import { page } from '$app/state';
	import {
		FileCheck,
		Calendar,
		Clock,
		Shield,
		Code,
		Layers,
		Key,
		ChartBar,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import AgentFactsExplorer from '$lib/components/AgentFactsExplorer.svelte';
</script>

<svelte:head>
	<title>AgentFacts: Verifiable Credentials for AI Agents | Blog — Homeport</title>
	<meta
		name="description"
		content="AgentFacts are cryptographically signed metadata documents — W3C Verifiable Credentials that serve as resumes for AI agents."
	/>
	<meta property="og:title" content="AgentFacts: Verifiable Credentials for AI Agents — Homeport" />
	<meta
		property="og:description"
		content="AgentFacts are W3C Verifiable Credentials that serve as resumes for AI agents — capabilities, trust scores, and compliance attestations."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/agentfacts" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-agentfacts.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-agentfacts.png" />
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
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			AgentFacts: Verifiable Credentials for AI Agents
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			Cryptographically signed metadata documents that serve as resumes for AI agents —
			capabilities, trust scores, compliance attestations, and performance metrics in a single
			verifiable package.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><FileCheck class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Shield class="h-3 w-3" /> Trust</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary" />The Trust Problem
			</h2>
			<p>
				When you hire a contractor, you check their resume, references, certifications, and track
				record. When an AI agent delegates a task to another agent, it needs the same kind of
				information — but verified cryptographically and available instantly.
			</p>
			<p>
				Today's agent metadata is fragmented: A2A has <a
					href="https://a2a-protocol.org/"
					target="_blank"
					rel="noopener">Agent Cards</a
				>
				at <code>/.well-known/agent.json</code>, MCP has server manifests, and custom platforms have
				their own formats. None of these are cryptographically signed, none carry trust
				attestations, and none support privacy-preserving lookups.
			</p>
			<p>
				<strong>AgentFacts</strong> solve this by encoding agent metadata as
				<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
					>W3C Verifiable Credentials</a
				>
				— the same standard used for digital identities, academic credentials, and supply chain attestations.
				The result: agent metadata that is
				<strong>machine-readable, cryptographically verifiable, and interoperable</strong> across protocols.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Layers class="h-5 w-5 text-nanda-accent" />Anatomy of an AgentFact
			</h2>
			<p>
				The AgentFacts schema organizes agent metadata into eight layers, each serving a distinct
				purpose in agent discovery and trust verification:
			</p>
			<div class="not-prose grid gap-3 my-6">
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">1. Identity & Naming</h4>
					<p class="text-xs text-nanda-text-muted">
						Unique machine ID, URN-based agent name, human-readable label, description, version. <span
							class="font-mono text-nanda-accent">id</span
						>, <span class="font-mono text-nanda-accent">agent_name</span>,
						<span class="font-mono text-nanda-accent">label</span>
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">2. Provider & DID Verification</h4>
					<p class="text-xs text-nanda-text-muted">
						Organization name, website, and optional <a
							href="https://www.w3.org/TR/did-1.0/"
							target="_blank"
							rel="noopener"
							class="text-nanda-accent hover:underline">Decentralized Identifier (DID)</a
						> for cryptographic provider verification.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">3. Network Endpoints</h4>
					<p class="text-xs text-nanda-text-muted">
						Static API URLs plus adaptive resolver configuration with geographic, load-balancing,
						and threat-shielding routing policies.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">4. Technical Capabilities</h4>
					<p class="text-xs text-nanda-text-muted">
						Supported modalities (text, audio, video, image), streaming/batch support,
						authentication methods, and required OAuth scopes.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">5. Functional Skills</h4>
					<p class="text-xs text-nanda-text-muted">
						Detailed skill definitions with input/output modes, language support, latency budgets,
						and token limits. This is what agents query when searching for capabilities.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">6. Quality Evaluations</h4>
					<p class="text-xs text-nanda-text-muted">
						Performance scores, 90-day availability, audit timestamps, immutable audit trails (e.g.,
						IPFS-pinned evidence), and auditor identification.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">7. Telemetry & Observability</h4>
					<p class="text-xs text-nanda-text-muted">
						Real-time metrics: p95 latency, throughput (RPS), error rate, availability. Sampling
						rates and retention policies for transparency.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-1">8. Certification & Trust</h4>
					<p class="text-xs text-nanda-text-muted">
						Certification level, issuing authority, issuance and expiration dates. Enables automated
						trust decisions based on third-party attestations.
					</p>
				</div>
			</div>
			<AgentFactsExplorer />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Code class="h-5 w-5 text-nanda-primary-400" />AgentFacts vs. Agent Cards
			</h2>
			<p>
				A2A's Agent Cards and NANDA's AgentFacts share common DNA — both describe agent capabilities
				in machine-readable JSON. In fact, the AgentFacts schema maintains direct compatibility with
				Agent Card fields:
			</p>
			<div class="overflow-x-auto my-6 not-prose">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-nanda-border">
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">Agent Card Field</th>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold"
								>AgentFacts Equivalent</th
							>
							<th class="text-left py-3 px-4 text-nanda-text font-semibold">Extended?</th>
						</tr>
					</thead>
					<tbody class="text-nanda-text-muted">
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-mono text-sm">name</td><td
								class="py-2.5 px-4 font-mono text-sm">label</td
							><td class="py-2.5 px-4"><span class="text-nanda-success">✓ Compatible</span></td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-mono text-sm">description</td><td
								class="py-2.5 px-4 font-mono text-sm">description</td
							><td class="py-2.5 px-4"><span class="text-nanda-success">✓ Compatible</span></td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-mono text-sm">url</td><td
								class="py-2.5 px-4 font-mono text-sm">endpoints.static</td
							><td class="py-2.5 px-4"
								><span class="text-nanda-accent">+ Adaptive resolver</span></td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-mono text-sm">skills</td><td
								class="py-2.5 px-4 font-mono text-sm">skills</td
							><td class="py-2.5 px-4"><span class="text-nanda-accent">+ Latency, tokens</span></td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 font-mono text-sm">securitySchemes</td><td
								class="py-2.5 px-4 font-mono text-sm">capabilities.authentication</td
							><td class="py-2.5 px-4"><span class="text-nanda-success">✓ Compatible</span></td></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 italic">Not available</td><td
								class="py-2.5 px-4 font-mono text-sm">evaluations</td
							><td class="py-2.5 px-4"><span class="text-nanda-primary-400">★ NANDA only</span></td
							></tr
						>
						<tr class="border-b border-nanda-border/30"
							><td class="py-2.5 px-4 italic">Not available</td><td
								class="py-2.5 px-4 font-mono text-sm">certification</td
							><td class="py-2.5 px-4"><span class="text-nanda-primary-400">★ NANDA only</span></td
							></tr
						>
						<tr
							><td class="py-2.5 px-4 italic">Not available</td><td
								class="py-2.5 px-4 font-mono text-sm">telemetry</td
							><td class="py-2.5 px-4"><span class="text-nanda-primary-400">★ NANDA only</span></td
							></tr
						>
					</tbody>
				</table>
			</div>
			<p>
				The key difference: AgentFacts go beyond technical metadata to include <strong
					>trust infrastructure</strong
				> — performance evaluations, certification status, audit trails, and real-time telemetry. These
				fields enable automated trust decisions that Agent Cards alone cannot support.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Key class="h-5 w-5 text-amber-400" />Cryptographic Verification
			</h2>
			<p>
				Every AgentFact is signed using <strong
					><a href="https://datatracker.ietf.org/doc/html/rfc8032" target="_blank" rel="noopener"
						>Ed25519</a
					> keys</strong
				> with versioned key rotation, following the W3C Verifiable Credentials data model. This means:
			</p>
			<ul>
				<li>
					<strong>Tamper evidence</strong> — any modification to the document invalidates the signature
				</li>
				<li><strong>Non-repudiation</strong> — the agent's operator provably issued the claims</li>
				<li>
					<strong>Selective disclosure</strong> — agents can reveal only the fields relevant to a specific
					interaction, keeping sensitive metadata private
				</li>
				<li>
					<strong>Third-party attestations</strong> — auditors, certification bodies, and other agents
					can add their own signed claims to an AgentFact
				</li>
			</ul>
			<p>
				This is fundamentally different from A2A's Agent Cards, which are served as plain JSON from
				a well-known URL. There's no way to verify that an Agent Card hasn't been modified in
				transit or that the claims within it are backed by the stated authority.
			</p>
			<div class="callout callout-info">
				<strong>DID integration.</strong>
				AgentFacts support optional
				<a href="https://www.w3.org/TR/did-1.0/" target="_blank" rel="noopener"
					>W3C Decentralized Identifiers (DIDs)</a
				> in the provider field, enabling cryptographic verification of the agent's organizational provenance
				without relying on centralized certificate authorities.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<ChartBar class="h-5 w-5 text-nanda-accent" />Real-World Trust Decisions
			</h2>
			<p>
				Consider a scenario: your enterprise orchestrator needs to delegate a sensitive document
				analysis task. With AgentFacts, it can programmatically verify:
			</p>
			<ol>
				<li>
					<strong>Capability match</strong> — does the agent's <code>skills</code> array include document
					analysis with text and image input modes?
				</li>
				<li>
					<strong>Performance SLA</strong> — is p95 latency under 200ms? Is 90-day availability above
					99.9%?
				</li>
				<li>
					<strong>Certification</strong> — has the agent been audited by a recognized authority? When
					does the certification expire?
				</li>
				<li>
					<strong>Jurisdiction</strong> — is the agent compliant with GDPR/HIPAA requirements for the
					data being processed?
				</li>
				<li>
					<strong>Provider trust</strong> — does the DID resolve to a known, verified organization?
				</li>
			</ol>
			<p>
				All of this happens automatically, in milliseconds, without human intervention. The
				AgentFact document provides everything needed for an informed, auditable trust decision.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-primary" />Getting Started with AgentFacts
			</h2>
			<p>The AgentFacts format is an open standard. To create an AgentFact for your agent:</p>
			<ol>
				<li>
					Start with the <a href="/docs/agentfacts">AgentFacts specification</a> and populate the required
					fields
				</li>
				<li>
					Register your agent in the <a href="/blog/quilt-architecture">NANDA Index</a> to obtain an AgentAddr
				</li>
				<li>Sign the document with your Ed25519 key pair</li>
				<li>
					Host the signed AgentFact at a publicly accessible URL (referenced by your AgentAddr)
				</li>
			</ol>
			<div class="callout callout-tip">
				<strong>A2A compatibility.</strong>
				If you already have an A2A Agent Card, your existing fields map directly to AgentFacts equivalents.
				You can extend your agent's metadata incrementally by adding trust, evaluation, and telemetry
				sections.
			</div>
		</section>

		<section class="mb-12 not-prose">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				References
			</h3>
			<ul class="space-y-2 text-sm text-nanda-text-muted">
				<li>
					<a
						href="https://www.w3.org/TR/vc-data-model-2.0/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">W3C Verifiable Credentials Data Model v2.0</a
					>
				</li>
				<li>
					<a
						href="https://www.w3.org/TR/did-1.0/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">W3C Decentralized Identifiers (DIDs) v1.0</a
					>
				</li>
				<li>
					<a
						href="https://datatracker.ietf.org/doc/html/rfc8032"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline"
						>RFC 8032 — Edwards-Curve Digital Signature Algorithm (Ed25519)</a
					>
				</li>
				<li>
					<a
						href="https://a2a-protocol.org/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">A2A Protocol — Agent-to-Agent Communication</a
					>
				</li>
			</ul>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/nanda-a2a-mcp" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						NANDA, A2A, and MCP
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How the three protocols fit together as complementary layers.
					</p>
				</a>
				<a href="/blog/building-agent-dns" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Building DNS for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The NANDA Lean Index — AgentAddr records, Ed25519 signing, and KV-cached resolution.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
