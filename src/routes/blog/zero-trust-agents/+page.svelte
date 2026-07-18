<script lang="ts">
	import { page } from '$app/state';
	import {
		ShieldCheck,
		Calendar,
		Clock,
		Lock,
		Shield,
		Network,
		TriangleAlert,
		Eye,
		BookOpen
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import ZTAAFlow from '$lib/components/ZTAAFlow.svelte';
</script>

<svelte:head>
	<title>Zero Trust for AI Agents | Blog — Homeport</title>
	<meta
		name="description"
		content="NANDA's Zero Trust Agentic Access (ZTAA) framework extends traditional Zero Trust to address autonomous agent security — capability spoofing, impersonation, and data leakage."
	/>
	<meta property="og:title" content="Zero Trust for AI Agents — Homeport" />
	<meta
		property="og:description"
		content="ZTAA extends Zero Trust Network Access for the era of autonomous AI agents."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/zero-trust-agents" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-zero-trust-agents.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-zero-trust-agents.png" />
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
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">Zero Trust for AI Agents</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			NANDA's Zero Trust Agentic Access (ZTAA) extends traditional Zero Trust to address the unique
			security challenges of autonomous AI agents — capability spoofing, impersonation attacks, and
			sensitive data leakage.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><ShieldCheck class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Lock class="h-3 w-3" /> Security</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<TriangleAlert class="h-5 w-5 text-amber-400" />Why Traditional Zero Trust Falls Short
			</h2>
			<p>
				Zero Trust Network Access (ZTNA) revolutionized enterprise security by replacing the "castle
				and moat" perimeter model with continuous verification: <em>never trust, always verify</em>.
				But ZTNA was designed for a world where humans operate applications that access resources.
				The actors are identifiable, the sessions are bounded, and the access patterns are
				predictable.
			</p>
			<p>Autonomous AI agents shatter every one of these assumptions:</p>
			<ul>
				<li>
					<strong>Agents act without human supervision</strong> — they discover peers, delegate tasks,
					and make trust decisions autonomously, at machine speed
				</li>
				<li>
					<strong>Agents can impersonate capabilities</strong> — a malicious agent can claim any skill,
					endpoint, or certification without cryptographic proof
				</li>
				<li>
					<strong>Agents amplify blast radius</strong> — a compromised agent with delegation authority
					can spawn chains of compromised sub-agents
				</li>
				<li>
					<strong>Agents create invisible data flows</strong> — sensitive information can be exfiltrated
					through multi-hop agent chains that bypass traditional DLP controls
				</li>
			</ul>
			<p>
				The <a href="https://arxiv.org/abs/2508.03101" target="_blank" rel="noopener"
					>NANDA Enterprise paper</a
				>
				identifies these gaps and introduces <strong>Zero Trust Agentic Access (ZTAA)</strong> — a framework
				purpose-built for the era of autonomous agents.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<ShieldCheck class="h-5 w-5 text-nanda-primary" />ZTAA: Four Pillars
			</h2>
			<p>ZTAA extends traditional Zero Trust with four agent-specific security pillars:</p>
			<div class="not-prose grid gap-4 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Shield class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">Cryptographic Identity</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Every agent has an Ed25519-signed identity anchored in <a
							href="/blog/agentfacts"
							class="text-nanda-accent hover:underline">AgentFacts</a
						>. No claim is accepted without cryptographic proof. Versioned key rotation prevents
						compromised keys from persisting.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Lock class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">Capability Verification</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Before any interaction, capabilities are verified against signed attestations in the
						AgentFact — not just claimed in an unsigned metadata document. Third-party auditors can
						add their own signed evaluations.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Eye class="h-5 w-5 text-nanda-primary-400" />
						<h4 class="font-semibold text-nanda-text text-sm">Agent Visibility & Control</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Enterprise AVC mechanisms provide continuous monitoring and governance over agent
						behavior — what agents can access, who they can communicate with, and what data they can
						process — while maintaining operational autonomy.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Network class="h-5 w-5 text-amber-400" />
						<h4 class="font-semibold text-nanda-text text-sm">Instant Revocation</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						When an agent is compromised or misbehaves, its credentials and delegation chains are
						revoked in real-time — milliseconds, not the hours required by traditional CRL/OCSP
						mechanisms.
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
				Perhaps the most dangerous security gap in multi-agent systems is <strong
					>uncontrolled delegation</strong
				>. Consider: Agent A delegates a financial analysis task to Agent B, which sub-delegates
				data collection to Agent C. If Agent C is compromised, it can exfiltrate the financial data
				— and traditional security has no visibility into this chain.
			</p>
			<p>ZTAA addresses this through:</p>
			<ul>
				<li>
					<strong>Delegation depth limits</strong> — enterprises can set maximum delegation depth (e.g.,
					no more than 3 hops) enforced cryptographically
				</li>
				<li>
					<strong>Scope narrowing</strong> — each delegation step can only narrow permissions, never widen
					them. Agent B cannot grant Agent C more access than Agent B itself has.
				</li>
				<li>
					<strong>Chain auditing</strong> — every delegation event is logged with cryptographic proofs,
					creating an immutable audit trail for compliance
				</li>
				<li>
					<strong>Cascade revocation</strong> — revoking Agent B's credentials automatically invalidates
					all downstream delegations to Agents C, D, E, etc.
				</li>
			</ul>
			<div class="callout callout-info">
				<strong>ZTNA → ZTAA.</strong>
				Just as ZTNA extended traditional network security for cloud-native applications, ZTAA extends
				ZTNA for agent-native architectures. The principle is the same — never trust, always verify —
				but the threat model and verification mechanisms are fundamentally different.
			</div>
			<ZTAAFlow />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary-400" />Enterprise Threat Model
			</h2>
			<p>
				The NANDA Enterprise paper identifies five categories of agent-specific threats that ZTAA is
				designed to counter:
			</p>
			<ol>
				<li>
					<strong>Capability spoofing</strong> — agents falsely claiming capabilities they don't possess,
					potentially leading to task failures or data corruption at scale
				</li>
				<li>
					<strong>Impersonation attacks</strong> — malicious agents masquerading as trusted agents to
					gain access to sensitive resources or delegation chains
				</li>
				<li>
					<strong>Sensitive data leakage</strong> — agents inadvertently or intentionally exfiltrating
					data through multi-hop communication chains that bypass traditional data loss prevention
				</li>
				<li>
					<strong>Shadow agent proliferation</strong> — unauthorized agents operating within enterprise
					environments without visibility or governance
				</li>
				<li>
					<strong>Trust exploitation</strong> — compromised agents leveraging established trust relationships
					to propagate laterally through agent networks
				</li>
			</ol>
			<p>
				Each threat is addressed by specific ZTAA mechanisms: cryptographic identity prevents
				impersonation, signed capability attestations prevent spoofing, AVC provides visibility into
				shadow agents, and instant revocation with cascade propagation limits blast radius from
				trust exploitation.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Implementing ZTAA
			</h2>
			<p>
				For enterprises deploying AI agents today, ZTAA provides a practical security framework that
				builds on existing Zero Trust investments:
			</p>
			<ol>
				<li>
					<strong>Register agents in the NANDA Index</strong> — give every agent a cryptographic
					identity via <a href="/blog/agentfacts">AgentFacts</a>
				</li>
				<li>
					<strong>Define delegation policies</strong> — set depth limits, scope constraints, and approved
					agent pools for each use case
				</li>
				<li>
					<strong>Deploy AVC monitoring</strong> — instrument agent communication channels for continuous
					visibility and compliance auditing
				</li>
				<li>
					<strong>Integrate with existing IdP</strong> — ZTAA works alongside enterprise identity providers,
					extending existing SSO and RBAC to agent identities
				</li>
			</ol>
			<div class="callout callout-tip">
				<strong>Further reading.</strong>
				The full ZTAA specification is detailed in
				<a href="https://arxiv.org/abs/2508.03101" target="_blank" rel="noopener"
					><em>Using the NANDA Index Architecture in Practice</em></a
				>
				(Section 6). For a broader view of NANDA's security architecture, see the
				<a href="/series/agentic-web/security-blueprint">Security Blueprint</a> installment of our Agentic
				Web series.
			</div>
		</section>

		<section class="mb-12 not-prose">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				References
			</h3>
			<ul class="space-y-2 text-sm text-nanda-text-muted">
				<li>
					<a
						href="https://csrc.nist.gov/pubs/sp/800/207/final"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">NIST SP 800-207 — Zero Trust Architecture</a
					>
				</li>
				<li>
					<a
						href="https://arxiv.org/abs/2508.03101"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline"
						>Using the NANDA Index Architecture in Practice</a
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
						href="https://www.w3.org/TR/vc-data-model-2.0/"
						target="_blank"
						rel="noopener"
						class="text-nanda-accent hover:underline">W3C Verifiable Credentials Data Model v2.0</a
					>
				</li>
			</ul>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/privacy-dual-path" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Privacy-Preserving Discovery
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Dual-path resolution for anonymous agent lookups.
					</p>
				</a>
				<a href="/series/agentic-web/security-blueprint" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						The Security Blueprint
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Part 5 of The Agentic Web — federated registry security.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
