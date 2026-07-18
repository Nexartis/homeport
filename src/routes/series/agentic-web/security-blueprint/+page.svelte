<script lang="ts">
	import { page } from '$app/state';
	import {
		ShieldCheck,
		Calendar,
		Clock,
		Lock,
		Eye,
		Network,
		TriangleAlert,
		BookOpen,
		Layers,
		ChartBar
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import ZTAAFlow from '$lib/components/ZTAAFlow.svelte';
</script>

<svelte:head>
	<title>The Security Blueprint | The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="Zero Trust Agentic Access (ZTAA) and Agent Visibility and Control (AVC) — the enterprise security framework for a world of autonomous AI agents."
	/>
	<meta property="og:title" content="Part 5: The Security Blueprint — Homeport" />
	<meta
		property="og:description"
		content="Enterprise security for autonomous AI agents — ZTAA, AVC, and the agent threat model."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/series/agentic-web/security-blueprint" />
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/series-agentic-web-security-blueprint.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/series-agentic-web-security-blueprint.png"
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
				><Clock class="h-4 w-4" />12 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">The Security Blueprint</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			Traditional Zero Trust assumes human operators, bounded sessions, and predictable access
			patterns. Autonomous AI agents break every one of those assumptions. ZTAA — Zero Trust Agentic
			Access — is the security framework designed from scratch for the agentic web.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><BookOpen class="h-3 w-3" /> Series: The Agentic Web</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Layers class="h-3 w-3" /> Part 5 of 6</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<TriangleAlert class="h-5 w-5 text-amber-400" />The Agent Threat Model
			</h2>
			<p>
				The <a href="https://arxiv.org/abs/2508.03101" target="_blank" rel="noopener noreferrer"
					>NANDA Enterprise paper</a
				> identifies five categories of threats unique to autonomous agent systems — threats that no existing
				security framework adequately addresses:
			</p>
			<ol>
				<li>
					<strong>Capability spoofing</strong> — agents falsely claiming skills they don't possess, causing
					task failures, data corruption, or financial loss at machine speed
				</li>
				<li>
					<strong>Impersonation attacks</strong> — malicious agents masquerading as trusted ones to infiltrate
					delegation chains and access sensitive resources
				</li>
				<li>
					<strong>Data exfiltration via multi-hop chains</strong> — sensitive information routed through
					sequences of agents that bypass traditional Data Loss Prevention controls
				</li>
				<li>
					<strong>Shadow agent proliferation</strong> — unauthorised agents operating within enterprise
					perimeters without visibility or governance
				</li>
				<li>
					<strong>Trust exploitation</strong> — compromised agents leveraging established reputation to
					propagate laterally through agent networks
				</li>
			</ol>
			<p>
				Each threat is amplified by autonomy. A human attacker operates on human timescales; a
				compromised agent can spawn thousands of sub-agents, establish delegation chains, and
				exfiltrate data in seconds — faster than any human analyst can detect.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<ShieldCheck class="h-5 w-5 text-nanda-primary" />ZTAA: Zero Trust for Agents
			</h2>
			<p>
				Just as ZTNA (Zero Trust Network Access) extended perimeter security for cloud applications, <strong
					>ZTAA extends ZTNA for agent-native architectures</strong
				>. The principle — <em>never trust, always verify</em> — remains (see
				<a
					href="https://csrc.nist.gov/pubs/sp/800/207/final"
					target="_blank"
					rel="noopener noreferrer">NIST SP 800-207</a
				>), but the verification mechanisms are fundamentally different.
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Lock class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">Cryptographic Identity</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Every agent carries an Ed25519-signed identity anchored in its <a
							href="/blog/agentfacts"
							class="text-nanda-accent hover:underline">AgentFacts</a
						> document. No claim is accepted without cryptographic proof. Versioned key rotation prevents
						compromised keys from persisting.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<ShieldCheck class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Capability Verification</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Capabilities are verified against signed attestations — not self-reported metadata.
						Third-party auditors and trust authorities like <a
							href="https://knowyourmodel.ai"
							target="_blank"
							rel="noopener noreferrer"
							class="text-nanda-accent hover:underline">KnowYourModel</a
						> issue W3C Verifiable Credentials that any participant can validate.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Eye class="h-5 w-5 text-nanda-primary-400" />
						<h4 class="font-semibold text-nanda-text text-sm">Agent Visibility & Control</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						AVC mechanisms provide continuous monitoring: what agents access, who they communicate
						with, and what data they process — while preserving the operational autonomy that makes
						agents valuable.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Network class="h-5 w-5 text-amber-400" />
						<h4 class="font-semibold text-nanda-text text-sm">Instant Revocation</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						When an agent is compromised, its credentials and all downstream delegations are revoked
						in milliseconds via <a
							href="https://www.w3.org/TR/vc-bitstring-status-list/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-nanda-accent hover:underline">Bitstring Status List</a
						> — not the hours required by traditional CRL/OCSP.
					</p>
				</div>
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />The Delegation Chain Problem
			</h2>
			<p>
				Perhaps the most dangerous gap in multi-agent security is <strong
					>uncontrolled delegation</strong
				>. Agent A delegates financial analysis to Agent B, which sub-delegates data collection to
				Agent C. If C is compromised, it exfiltrates the data — and traditional security has no
				visibility into this chain.
			</p>
			<p>ZTAA addresses delegation through four mechanisms:</p>
			<ul>
				<li>
					<strong>Depth limits</strong> — enterprises set maximum delegation depth (e.g., 3 hops) enforced
					cryptographically at each step
				</li>
				<li>
					<strong>Scope narrowing</strong> — each delegation can only narrow permissions, never widen
					them. B cannot grant C more access than B itself has.
				</li>
				<li>
					<strong>Chain auditing</strong> — every delegation event is logged with cryptographic proofs,
					creating an immutable compliance trail
				</li>
				<li>
					<strong>Cascade revocation</strong> — revoking B's credentials automatically invalidates all
					downstream delegations to C, D, E, and beyond
				</li>
			</ul>
			<div class="callout callout-info">
				<strong>ZTNA → ZTAA.</strong>
				The shift from ZTNA to ZTAA mirrors the shift from human-operated to agent-operated systems. Both
				apply "never trust, always verify" — but ZTAA verifies at machine speed, across dynamic delegation
				chains, with autonomous threat response.
			</div>
			<ZTAAFlow />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Eye class="h-5 w-5 text-nanda-primary" />Agent Visibility and Control
			</h2>
			<p>
				AVC is the governance layer that sits above ZTAA, providing enterprises with the
				observability they need without constraining the autonomy that makes agents useful. The <a
					href="https://arxiv.org/abs/2508.03095"
					target="_blank"
					rel="noopener noreferrer">Registry Solutions survey</a
				> compared five agent registry approaches and found that only NANDA's architecture provides both
				verifiable identity and enterprise governance in a single framework.
			</p>
			<p>AVC answers the questions every CISO asks about agent deployments:</p>
			<ul>
				<li>
					<strong>What agents are running?</strong> — real-time inventory through NANDA Index registration,
					eliminating shadow agents
				</li>
				<li>
					<strong>What can they access?</strong> — capability-scoped permissions defined in AgentFacts,
					enforced at every interaction
				</li>
				<li>
					<strong>Who are they talking to?</strong> — communication graphs built from signed interaction
					receipts
				</li>
				<li>
					<strong>Are they compliant?</strong> — continuous policy evaluation against regulatory frameworks,
					with audit trails stored on immutable infrastructure
				</li>
			</ul>
			<p>
				AVC integrates with existing enterprise identity providers — extending SSO and RBAC to agent
				identities — so organisations don't need to replace their security infrastructure; they
				extend it.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<ChartBar class="h-5 w-5 text-nanda-accent" />From Blueprint to Production
			</h2>
			<p>
				The security blueprint isn't theoretical — it maps directly to deployment steps for
				enterprises adopting agent infrastructure today:
			</p>
			<ol>
				<li>
					<strong>Register every agent</strong> in the NANDA Index with a cryptographic identity via AgentFacts
				</li>
				<li>
					<strong>Define delegation policies</strong> — depth limits, scope constraints, and approved
					agent pools per use case
				</li>
				<li>
					<strong>Deploy AVC monitoring</strong> — instrument communication channels for continuous visibility
					and compliance
				</li>
				<li>
					<strong>Integrate with existing IdP</strong> — extend your enterprise identity provider to cover
					agent identities
				</li>
			</ol>
			<p>
				The full ZTAA specification is detailed in the <a
					href="https://arxiv.org/abs/2508.03101"
					target="_blank"
					rel="noopener noreferrer"><em>NANDA Enterprise paper</em></a
				>. In <a href="/series/agentic-web/governance-at-scale">Part 6</a>, we conclude the series
				by examining how governance frameworks, policy enforcement, and multistakeholder
				coordination enable responsible agent deployment at population scale.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/series/agentic-web/governance-at-scale" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Part 6: Governance at Scale →
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Multistakeholder governance for billions of autonomous agents.
					</p>
				</a>
				<a href="/blog/zero-trust-agents" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Zero Trust for AI Agents
					</h4>
					<p class="text-xs text-nanda-text-dim">Technical deep dive into ZTAA's four pillars.</p>
				</a>
			</div>
		</section>
	</div>
</article>
