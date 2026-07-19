<script lang="ts">
	import { page } from '$app/state';
	import {
		Calendar,
		Clock,
		Network,
		Globe,
		Lock,
		Building2,
		BookOpen,
		Layers,
		Users
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import QuiltTopology from '$lib/components/QuiltTopology.svelte';
</script>

<svelte:head>
	<title>Trust Without Borders | The Agentic Web Series — Homeport</title>
	<meta
		name="description"
		content="The Quilt architecture and federated registries — how trust scales across a decentralized network of autonomous agents without a central authority."
	/>
	<meta property="og:title" content="Part 3: Trust Without Borders — Homeport" />
	<meta
		property="og:description"
		content="How trust scales across a decentralized network of autonomous agents."
	/>
	<meta
		property="og:url"
		content="{page.data.registryUrl}/series/agentic-web/trust-without-borders"
	/>
	<meta
		property="og:image"
		content="{page.data.registryUrl}/og/series-agentic-web-trust-without-borders.png"
	/>
	<meta
		name="twitter:image"
		content="{page.data.registryUrl}/og/series-agentic-web-trust-without-borders.png"
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
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">Trust Without Borders</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			A centralised agent registry is a single point of failure, a censorship chokepoint, and a
			rent-seeking opportunity. The Quilt architecture solves all three — enabling trust to scale
			across organisational boundaries without anyone holding the keys to the entire system.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><BookOpen class="h-3 w-3" /> Series: The Agentic Web</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Layers class="h-3 w-3" /> Part 3 of 6</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />Why Federation Matters
			</h2>
			<p>
				Consider a hospital network in Germany, a fintech startup in Singapore, and a logistics
				orchestrator in Brazil. Each operates agents that need to discover and collaborate with
				agents from the other two — but none will accept a registry controlled by the others.
				Enterprise adoption of agent infrastructure hinges on one question: <em
					>can I participate without surrendering control?</em
				>
			</p>
			<p>
				DNS solved a version of this problem in the 1980s with hierarchical delegation: ICANN at the
				top, registrars below, individual zones at the bottom. But DNS concentrates power at the top
				of the tree. The NANDA <a href="/blog/quilt-architecture">Quilt architecture</a> takes a
				fundamentally different approach:
				<strong>no tree, no root, no single point of authority</strong>. Instead, independent
				registries operate autonomously and synchronise through gossip-based federation — like
				patches in a quilt that form a coherent whole without any patch being in charge.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Globe class="h-5 w-5 text-nanda-primary" />The Quilt: Six Registration Patterns
			</h2>
			<p>
				The Quilt doesn't impose a single registration model. Instead, it accommodates six patterns
				— each reflecting a different governance relationship between the agent, its organisation,
				and the broader network:
			</p>
			<div class="not-prose overflow-x-auto my-6">
				<table class="w-full text-sm border border-nanda-border/40">
					<thead>
						<tr class="bg-nanda-bg-alt/50">
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Pattern</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Example</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Visibility</th
							>
							<th
								class="px-3 py-2 text-left text-nanda-text-dim font-semibold border-b border-nanda-border/30"
								>Control</th
							>
						</tr>
					</thead>
					<tbody class="text-nanda-text-muted">
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">NANDA Native</td><td
								class="px-3 py-2"><code>@agentx</code></td
							><td class="px-3 py-2">Global</td><td class="px-3 py-2">Agent/Provider</td></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Government</td><td
								class="px-3 py-2"><code>@US:shop</code></td
							><td class="px-3 py-2">Jurisdiction-scoped</td><td class="px-3 py-2"
								>Regulatory body</td
							></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Enterprise (Routed)</td><td
								class="px-3 py-2"><code>@company</code></td
							><td class="px-3 py-2">Via company registry only</td><td class="px-3 py-2"
								>Enterprise IT</td
							></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Enterprise (Direct)</td><td
								class="px-3 py-2"><code>@company:shop</code></td
							><td class="px-3 py-2">Global, company-administered</td><td class="px-3 py-2"
								>Enterprise IT</td
							></tr
						>
						<tr class="border-b border-nanda-border/20"
							><td class="px-3 py-2 font-medium text-nanda-text">Web3 (Routed)</td><td
								class="px-3 py-2"><code>@DID:company</code></td
							><td class="px-3 py-2">Via Web3 marketplace</td><td class="px-3 py-2">DID holder</td
							></tr
						>
						<tr
							><td class="px-3 py-2 font-medium text-nanda-text">Web3 (Direct)</td><td
								class="px-3 py-2"><code>@DID:company:agent</code></td
							><td class="px-3 py-2">Global, DID-authenticated</td><td class="px-3 py-2"
								>DID holder</td
							></tr
						>
					</tbody>
				</table>
			</div>
			<p>
				This flexibility is critical. A German hospital can run a routed enterprise registry (<code
					>@charite</code
				>) that keeps internal agents invisible to the outside world while still exposing selected
				agents (<code>@charite:radiology-assist</code>) for cross-institutional collaboration. A
				Web3 marketplace can register agents under DID-authenticated namespaces. A government
				regulator can create jurisdiction-scoped zones. All coexist in the same fabric.
			</p>
			<QuiltTopology />
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Lock class="h-5 w-5 text-nanda-accent" />Pull-Based Federation
			</h2>
			<p>
				Traditional federation models (email, ActivityPub, DNS) rely on push-based or hierarchical
				propagation. NANDA uses <strong>gossip-based synchronisation</strong>: each registry decides
				which peer registries to sync with, how often, and which agent categories to replicate. This
				design has three structural advantages:
			</p>
			<ul>
				<li>
					<strong>No mandatory trust</strong> — A registry never has to accept data from a peer it doesn't
					trust. Trust relationships are bilateral and revocable.
				</li>
				<li>
					<strong>No single point of failure</strong> — If any registry goes offline, the rest of the
					quilt continues operating. Agents already replicated to other registries remain discoverable.
				</li>
				<li>
					<strong>No bottleneck writes</strong> — Because each registry owns its local agents and pulls
					from peers, write pressure is distributed. The Index's lean records (≤120 bytes) make sync bandwidth
					negligible even at million-record scale.
				</li>
			</ul>
			<div class="callout callout-info">
				<strong>The N×N → 2N reduction.</strong>
				Without a shared discovery layer, every agent needs direct connections to all others — an N×N
				connectivity problem. The Quilt transforms this into 2N: each agent registers once in its local
				registry, and the federation fabric makes it discoverable everywhere else.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Building2 class="h-5 w-5 text-nanda-primary" />Trust Composition in Practice
			</h2>
			<p>
				Federation creates the <em>network</em>, but trust requires more. In the NANDA ecosystem,
				trust composes through three mechanisms:
			</p>
			<ol>
				<li>
					<strong>Cryptographic identity</strong> — Every AgentAddr in the Index includes an
					<a
						href="https://datatracker.ietf.org/doc/html/rfc8032"
						target="_blank"
						rel="noopener noreferrer">Ed25519</a
					> signature. You can verify an agent's identity without trusting any registry — only the agent's
					own key pair.
				</li>
				<li>
					<strong>Verifiable credentials</strong> — Trust authorities like
					<a href="https://knowyourmodel.ai" target="_blank" rel="noopener noreferrer"
						>KnowYourModel</a
					>
					issue W3C VCs attesting to agent capabilities, trust scores, and compliance status. These credentials
					are <a href="/series/agentic-web/agent-identity">portable</a> — they travel with the agent,
					not the registry.
				</li>
				<li>
					<strong>Usage-backed reputation</strong> — Trust scores are earned through cryptographic
					<a href="/case-studies/kym-nanda-integration">usage receipts</a>, not self-reported
					claims. Each receipt is Ed25519-signed by a registered orchestrator, creating a
					proof-of-use mechanism that resists Sybil attacks.
				</li>
			</ol>
			<p>
				Together, these layers mean you don't need to trust the <em>registry</em> that returned an agent's
				record. You verify the agent's identity against its own key, validate its credentials against
				the issuer's public key, and check its trust score against signed usage evidence. The registry
				is just a discovery conduit — it can be adversarial, and the trust model still holds.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Users class="h-5 w-5 text-nanda-accent" />What This Enables
			</h2>
			<p>The Quilt architecture makes several previously impossible scenarios routine:</p>
			<ul>
				<li>
					<strong>Cross-border agent collaboration</strong> — Agents from different jurisdictions discover
					and verify each other through federated registries, each respecting local compliance requirements
				</li>
				<li>
					<strong>Enterprise-grade privacy</strong> — Companies run private registries for internal agents
					while selectively exposing others to the public Quilt
				</li>
				<li>
					<strong>Resilient discovery</strong> — No single outage, regulatory action, or adversarial attack
					can disable agent discovery globally
				</li>
				<li>
					<strong>Competitive neutrality</strong> — No platform, cloud provider, or government controls
					the agent namespace
				</li>
			</ul>
			<p>
				Trust without borders doesn't mean trust without verification. It means the verification is <em
					>mathematical</em
				>, not <em>institutional</em>. In <a href="/series/agentic-web/agent-privacy">Part 4</a>, we
				explore the privacy side: how agents discover each other without revealing sensitive
				metadata to the network.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/series/agentic-web/agent-privacy" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Part 4: Agent Privacy →
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Dual-path resolution and privacy-preserving discovery.
					</p>
				</a>
				<a href="/blog/quilt-architecture" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						The Quilt Architecture
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Technical deep dive into gossip-based federation and sync.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
