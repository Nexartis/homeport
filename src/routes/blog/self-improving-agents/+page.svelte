<script lang="ts">
	import { page } from '$app/state';
	import {
		Calendar,
		Clock,
		Cpu,
		Network,
		Shield,
		Zap,
		BrainCircuit,
		TrendingUp,
		DollarSign,
		BookOpen,
		RefreshCcw
	} from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import BanditSelector from '$lib/components/BanditSelector.svelte';
	import LifecycleFlow from '$lib/components/LifecycleFlow.svelte';
</script>

<svelte:head>
	<title
		>The Self-Improving Agent Stack: How Cubicube's Agents Get Better Without Human Intervention |
		Blog — Homeport</title
	>
	<meta
		name="description"
		content="How Cubicube's 10 specialized agents are automatically discovered, certified, selected, and optimized using KYM trust registries, NANDA infrastructure, and multi-armed bandit algorithms — with no human in the loop."
	/>
	<meta property="og:title" content="The Self-Improving Agent Stack — Homeport" />
	<meta
		property="og:description"
		content="The complete lifecycle of a self-improving agentic web development stack — from agent registration to autonomous optimization."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/self-improving-agents" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-self-improving-agents.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-self-improving-agents.png" />
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
				><Clock class="h-4 w-4" />14 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			The Self-Improving Agent Stack
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			How Cubicube's 10 specialized agents are automatically discovered, certified, selected, and
			optimized — with no human in the loop. A complete walkthrough of the first self-improving
			agentic web development stack.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Cpu class="h-3 w-3" /> Technical</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Network class="h-3 w-3" /> Ecosystem</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<!-- Section 1: The Problem -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BrainCircuit class="h-5 w-5 text-nanda-primary" />The Problem: You Have 10 Agents. Are They
				the Best?
			</h2>
			<p>
				<a href="https://cubicube.com" target="_blank" rel="noopener noreferrer">Cubicube</a> is a
				modular web development platform powered by <strong>Pegasus</strong> — an orchestrator that coordinates
				10 specialized AI agents. There's a layout agent, a design-system agent, an accessibility agent,
				a performance agent, and six others. Each agent handles a specific slice of the web development
				workflow, and Pegasus routes tasks to the right agent at the right time.
			</p>
			<p>
				But here's the question nobody had a good answer for: <strong
					>how do you know these are the best agents for the job?</strong
				>
			</p>
			<p>
				Before our stack existed, the answer was: you don't. You pick agents based on benchmarks,
				vibes, and whatever the latest Hacker News thread recommends. You hard-code them into your
				orchestrator. When a better agent appears, someone has to notice, evaluate it manually, and
				swap it in. That's not engineering — it's hope.
			</p>
			<p>
				We built something different. A five-layer system where agents are automatically discovered,
				cryptographically certified, intelligently selected using multi-armed bandit algorithms,
				economically incentivized, and — crucially — <strong>optimized by another agent</strong> that
				watches the entire system and makes it better.
			</p>
			<p>This is the complete lifecycle. No human touches any of it after initial deployment.</p>
		</section>

		<!-- Section 2: Discovery & Registration -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />Layer 1: Discovery & Registration
			</h2>
			<p>
				Every agent in the system starts life with an identity. When Cubicube's layout agent is
				deployed, it registers with two systems simultaneously:
			</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Shield class="h-5 w-5 text-nanda-primary" />
						<h4 class="font-semibold text-nanda-text text-sm">KnowYourModel Trust Registry</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						The agent gets a registry entry in <a
							href="https://knowyourmodel.ai"
							class="text-nanda-accent hover:underline">KYM</a
						> — a trust credential authority that tracks capabilities, performance history, and trust
						scores. KYM manages over 20,800 entities across models, agents, and datasets.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<Network class="h-5 w-5 text-nanda-accent" />
						<h4 class="font-semibold text-nanda-text text-sm">NANDA Index</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						The agent publishes an <a
							href="/blog/agentfacts"
							class="text-nanda-accent hover:underline">AgentFact</a
						> — a W3C Verifiable Credential containing its capabilities, endpoint URL, supported protocols,
						and Ed25519 cryptographic identity. Any NANDA node can now discover it.
					</p>
				</div>
			</div>
			<p>
				KYM handles <strong>trust and selection</strong>. NANDA handles
				<strong>discovery and verification</strong>. Together, they give the agent a globally
				discoverable, cryptographically verifiable identity that any orchestrator in the world can
				find and validate.
			</p>
			<p>
				When Pegasus needs a layout agent, it doesn't have one hard-coded. It queries the KYM
				registry for agents with the <code>web-layout</code> capability, and KYM returns a ranked list
				— scored, certified, and ready to use.
			</p>
		</section>

		<!-- Section 3: Certification & Trust -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-nanda-primary" />Layer 2: Certification & Trust
			</h2>
			<p>Registration gets you a listing. Certification proves you deserve it.</p>
			<p>
				NANDA's <strong>Capability Certifier</strong> runs automated test suites against every
				registered agent. For a layout agent, that means generating test layouts across viewport
				sizes, validating semantic HTML output, checking responsive breakpoints, and measuring
				render performance. Results are scored using <strong>Wilson confidence intervals</strong> — the
				same statistical method used for grading products on e-commerce platforms — producing grades from
				A+ to F.
			</p>
			<p>
				Each grade is issued as a <strong>W3C Verifiable Credential v2</strong> signed with Ed25519. This
				isn't a number in a database — it's a cryptographic attestation that any participant in the NANDA
				network can independently verify without trusting our infrastructure. The credential includes:
			</p>
			<ul>
				<li>The specific capabilities tested and their individual scores</li>
				<li>The test suite version and methodology</li>
				<li>A <code>Bitstring Status List</code> revocation index for real-time invalidation</li>
				<li>
					Evidence stored in R2 (Cloudflare's object storage) — the actual test inputs and outputs
				</li>
			</ul>
			<p>
				Meanwhile, NANDA's <strong>Observer Evaluator</strong> runs hourly liveness probes. It's not enough
				to pass certification once — agents must prove they're consistently available. The observer computes
				a reputation score using a weighted formula:
			</p>
			<div class="not-prose my-6">
				<div class="nanda-card font-mono text-xs text-nanda-text-muted">
					reputation = availability × 0.4 + probe_success × 0.4 + cert_score × 0.2 − fraud_rate ×
					0.1
				</div>
			</div>
			<p>
				All of this happens without any human involvement. Agents are tested, scored, credentialed,
				and monitored on a continuous automated cycle.
			</p>
		</section>

		<!-- Section 4: Intelligent Selection -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<TrendingUp class="h-5 w-5 text-nanda-accent" />Layer 3: Intelligent Selection
			</h2>
			<p>
				This is where it gets interesting. KYM doesn't just rank agents by a static score — it uses <strong
					>multi-armed bandit algorithms</strong
				> to learn which agent performs best in practice, balancing exploitation of known good agents
				with exploration of new ones.
			</p>
			<p>Registry owners choose from four selection strategies:</p>
			<BanditSelector />
			<p>
				Here's the key insight: <strong
					>every time Pegasus uses an agent, the outcome feeds back into the bandit</strong
				>. If the layout agent produces clean, accessible HTML, that's a success signal. If it fails
				validation or times out, that's a failure. Over hundreds of invocations, Thompson Sampling
				converges on the genuinely best agent — not the one with the best marketing, but the one
				that actually performs.
			</p>
			<p>
				The feedback mechanism is cryptographic. Orchestrators submit <strong
					>Ed25519-signed usage receipts</strong
				> that attest to the outcome of each invocation. These receipts are tamper-proof — you can't inflate
				an agent's success rate without a valid orchestrator signature. KYM verifies each receipt before
				updating the bandit's posterior distribution.
			</p>
			<div class="callout callout-info">
				<strong>Why bandits, not leaderboards?</strong>
				Static leaderboards optimize for a single moment in time. Bandits continuously adapt. When a new
				agent enters the registry, Thompson Sampling automatically explores it without degrading the experience
				for existing users. When an agent's quality degrades, the bandit's posterior shifts and selection
				probability drops — no human intervention required.
			</div>
		</section>

		<!-- Section 5: The Economic Layer -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<DollarSign class="h-5 w-5 text-nanda-primary" />Layer 4: The Economic Layer
			</h2>
			<p>
				Trust and selection need an economic substrate. Agents aren't free — they consume compute,
				API calls, and inference tokens. The stack uses the <strong>x402 protocol</strong> to gate access
				with real payments, creating genuine economic incentives for quality.
			</p>
			<p>
				x402 revives the HTTP <code>402 Payment Required</code> status code with a three-step pattern:
			</p>
			<ol>
				<li>
					<strong>Challenge</strong> — the agent endpoint returns <code>402</code> with payment requirements
					(amount, accepted currencies, payment address)
				</li>
				<li><strong>Pay</strong> — the orchestrator completes payment and receives a receipt</li>
				<li>
					<strong>Prove</strong> — the orchestrator re-sends the request with the payment proof in
					an <code>X-PAYMENT</code> header
				</li>
			</ol>
			<p>The system supports <strong>dual payment rails</strong>:</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-2">
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<h4 class="font-semibold text-nanda-text text-sm">USDC (On-Chain)</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Stablecoin payments on Base L2 with ~24-second settlement. Fully decentralized, no
						intermediary. Best for high-value transactions and cross-organization payments where
						neither party trusts the other.
					</p>
				</div>
				<div class="nanda-card">
					<div class="flex items-center gap-2 mb-2">
						<h4 class="font-semibold text-nanda-text text-sm">Nanda Points (Off-Chain)</h4>
					</div>
					<p class="text-xs text-nanda-text-muted">
						Internal ledger with HMAC-SHA256 signed transactions and instant settlement. Zero gas
						fees, sub-millisecond verification. Pegged at <strong>1,000 NP = $1 USD</strong> — making
						a registry listing cost 1,000 NP and a registry creation cost 5,000 NP. Every new agent is
						seeded with 1,000 NP (worth $1), enough for one free listing. NP verification is delegated
						to the NANDA Node's Points Auditor, keeping the auditor as the single source of truth for
						balances.
					</p>
				</div>
			</div>
			<p>
				When an agent calls a KYM endpoint, the <code>402 Payment Required</code> response
				advertises <strong>both payment options</strong> — the USDC challenge and the NP alternative with
				exact header instructions. The agent (or its orchestrator) picks whichever rail it has funds on.
				KYM verifies USDC on-chain directly; for NP, it delegates verification to the NANDA Node, which
				checks the HMAC signature and settles the transaction on its internal ledger.
			</p>
			<p>
				The economic layer creates a critical feedback loop: <strong
					>agents that perform well get selected more often, earn more revenue, and can invest in
					their own optimization</strong
				>. Agents that underperform lose selection probability, earn less, and eventually get
				displaced. It's natural selection with a financial substrate.
			</p>
		</section>

		<!-- Section 6: The Optimization Agent -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Zap class="h-5 w-5 text-amber-400" />Layer 5: The Optimization Agent
			</h2>
			<p>
				Here's the part that makes this architecture genuinely novel: <strong
					>a NANDA agent whose sole purpose is making other agents better</strong
				>.
			</p>
			<p>
				The Optimization Agent is itself registered in the NANDA Index and certified through KYM —
				it's an agent like any other, subject to the same trust infrastructure. But its capability
				is unique: it watches the entire system and acts on what it sees.
			</p>
			<p>It has read access to:</p>
			<ul>
				<li>
					<strong>KYM bandit posteriors</strong> — the full Beta distribution parameters for every agent
					in every registry, showing which agents are converging toward success and which are declining
				</li>
				<li>
					<strong>NANDA observer telemetry</strong> — availability windows, probe success rates, latency
					distributions, and health trends over 24-hour sliding windows
				</li>
				<li>
					<strong>Certification evidence</strong> — the actual test inputs, outputs, and Wilson interval
					calculations stored in R2
				</li>
				<li>
					<strong>Usage receipt streams</strong> — the Ed25519-signed outcome data from every orchestrator
					invocation
				</li>
				<li>
					<strong>Payment transaction history</strong> — settlement patterns, revenue flow, and economic
					activity across both USDC and NP rails
				</li>
			</ul>
			<p>With this data, the Optimization Agent can take concrete actions:</p>
			<div class="not-prose grid gap-3 my-6">
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-2">Trigger Re-Certification</h4>
					<p class="text-xs text-nanda-text-muted">
						When an agent's observer data shows degradation but its certification grade is stale,
						the Optimization Agent queues a re-certification run. If the agent fails, the credential
						is revoked via Bitstring Status List and the bandit prior is reset — immediately
						removing it from selection.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-2">Scout New Agents</h4>
					<p class="text-xs text-nanda-text-muted">
						The Optimization Agent queries the NANDA Index for agents with matching capabilities
						that aren't yet in the KYM registry. When it finds promising candidates, it registers
						them — giving the bandit new arms to explore. It uses certification grades and observer
						data from other NANDA nodes to pre-filter before registration.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-2">Tune Selection Parameters</h4>
					<p class="text-xs text-nanda-text-muted">
						If a registry's Thompson Sampling posterior shows all agents clustering near the same
						score (the bandit has converged but exploration is still burning budget), the
						Optimization Agent can recommend switching to Static selection. If a new batch of agents
						arrives, it can switch back to Thompson Sampling to explore them.
					</p>
				</div>
				<div class="nanda-card">
					<h4 class="font-semibold text-nanda-text text-sm mb-2">Report & Recommend</h4>
					<p class="text-xs text-nanda-text-muted">
						The Optimization Agent generates periodic reports: which agents improved, which
						degraded, what the expected regret is for the current selection strategy, and whether
						different algorithm parameters would reduce it. These reports feed into dashboards
						visible in both KYM and NANDA admin panels.
					</p>
				</div>
			</div>
			<p>
				The critical point: <strong
					>the Optimization Agent itself is subject to the same trust infrastructure</strong
				>. It has a certification grade, observer reputation, and bandit selection probability. If
				it makes bad recommendations, its trust score drops. If a better optimization agent appears,
				it gets displaced. The system optimizes its own optimizer.
			</p>
		</section>

		<!-- Section 7: The Complete Loop -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 700 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<RefreshCcw class="h-5 w-5 text-nanda-primary" />The Complete Loop
			</h2>
			<p>Let's trace one full cycle through the system to see how all five layers work together:</p>
			<LifecycleFlow />
			<p>
				This isn't a theoretical architecture — it's a running system. Every component described in
				this post is built on <strong>Cloudflare Workers</strong> (V8 isolates at the edge), with
				<strong>D1</strong>
				for operational state, <strong>R2</strong> for certification evidence, <strong>KV</strong>
				for hot caches, and <strong>cron-triggered inline processing</strong> for background tasks. The
				entire stack runs serverless with zero cold-start infrastructure management.
			</p>
			<div class="callout callout-tip">
				<strong>The deeper implication.</strong>
				This architecture doesn't just optimize agent selection — it creates evolutionary pressure across
				the entire agentic ecosystem. Agent developers who want their agents selected by Cubicube (and
				the revenue that comes with it) must build agents that pass certification, maintain availability,
				and actually perform well on real tasks. The system doesn't just pick winners — it makes the whole
				ecosystem better.
			</div>
		</section>

		<!-- Section 8: Further Reading -->
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 800 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<BookOpen class="h-5 w-5 text-nanda-accent" />Further Reading
			</h2>
			<p>
				This work sits at the intersection of several active research areas. The following papers
				and resources explore the foundational ideas behind each layer of the stack:
			</p>

			<h3>Self-Improving Agent Systems</h3>
			<ul>
				<li>
					<a href="https://arxiv.org/abs/2602.05848" target="_blank" rel="noopener"
						>DARWIN: Dynamic Agentically Rewriting Self-Improving Network</a
					> (Jiang, Feb 2026) — LLM agents that autonomously rewrite their own network architecture through
					evolutionary optimization.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2502.00757" target="_blank" rel="noopener"
						>AgentBreeder: Mitigating AI Safety Risks of Multi-Agent Scaffolds via Self-Improvement</a
					> (Rosser et al., NeurIPS 2025 Spotlight) — Multi-objective evolutionary search over agent scaffolds,
					demonstrating that self-improving systems can be aligned with safety constraints.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2408.08435" target="_blank" rel="noopener"
						>ADAS: Automated Design of Agentic Systems</a
					> (Hu et al., 2025) — A meta-agent that programs new agents in code, searching over the space
					of possible agent designs.
				</li>
				<li>
					<a href="https://aclanthology.org/2025.realm-1.4/" target="_blank" rel="noopener"
						>A Multi-AI Agent System for Autonomous Optimization of Agentic AI Solutions</a
					> (Yuksel et al., REALM @ ACL 2025) — Autonomous refinement of agent roles and workflows through
					LLM-driven feedback loops.
				</li>
				<li>
					<a
						href="https://aixplain.com/blog/evolver-meta-agent-self-improving-ai/"
						target="_blank"
						rel="noopener">Evolver: aiXplain's Meta-Agent for Self-Improving AI</a
					> (Oct 2025) — Industry implementation of a meta-agent that treats agent optimization as an
					evolutionary search problem.
				</li>
				<li>
					<a href="https://cs329a.stanford.edu/" target="_blank" rel="noopener"
						>Stanford CS329A: Self-Improving AI Agents</a
					> (Mirhoseini & Chowdhery, Fall 2025) — Graduate seminar covering the latest techniques in agents
					that continuously improve through experience.
				</li>
			</ul>

			<h3>Multi-Armed Bandits for Agent Selection</h3>
			<ul>
				<li>
					<a href="https://arxiv.org/abs/2601.11658" target="_blank" rel="noopener"
						>A Pragmatic Approach Towards Self Evolving Agent</a
					> (Jan 2026) — Directly models LLM agent selection as a multi-armed bandit problem, enabling
					dynamic selection among competing agents.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2502.07350" target="_blank" rel="noopener"
						>KABB: Knowledge-Aware Bayesian Bandits for Dynamic Expert Coordination</a
					> (Zhang et al., ICML 2025) — Thompson Sampling strategy for dynamically routing tasks to the
					right expert in multi-agent systems.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2505.13355" target="_blank" rel="noopener"
						>Multi-Armed Bandits Meet Large Language Models</a
					> (May 2025) — Surveys the intersection of MAB algorithms and LLM-based systems, including agent
					selection and model routing.
				</li>
			</ul>

			<h3>Agent Discovery & Trust Infrastructure</h3>
			<ul>
				<li>
					<a href="https://arxiv.org/abs/2507.14263" target="_blank" rel="noopener"
						>Beyond DNS: Unlocking the Internet of AI Agents via the NANDA Index</a
					> (Jul 2025) — The foundational NANDA paper describing the AgentFacts schema and decentralized
					peer-to-peer agent index.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2510.03495" target="_blank" rel="noopener"
						>AgentHub: A Registry for Discoverable, Verifiable, and Reproducible AI Agents</a
					> (Jiang et al., Oct 2025) — Vision for an agent registry supporting production and consumption
					of software agents.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2511.19113" target="_blank" rel="noopener"
						>Agent Discovery in Internet of Agents: Challenges and Solutions</a
					> (Guo et al., Nov 2025) — Survey of agent discovery challenges including capability matching
					and decentralized resolution.
				</li>
				<li>
					<a href="https://arxiv.org/abs/2511.03434" target="_blank" rel="noopener"
						>Inter-Agent Trust Models: A Comparative Study</a
					> (Nov 2025) — Comparative analysis of trust mechanisms across A2A, NANDA, and blockchain-based
					agent protocols.
				</li>
				<li>
					<a href="https://www.w3.org/TR/vc-data-model-2.0/" target="_blank" rel="noopener"
						>W3C Verifiable Credentials Data Model v2.0</a
					> (May 2025) — The standard underlying our certification grades and AgentFacts.
				</li>
			</ul>

			<h3>Agent Payments & Economic Incentives</h3>
			<ul>
				<li>
					<a href="https://www.x402.org/" target="_blank" rel="noopener"
						>x402: Internet-Native Payments Standard</a
					> — The open protocol for payment-gated agent access, reviving HTTP 402 with zero protocol fees.
				</li>
				<li>
					<a
						href="https://cloudsecurityalliance.org/blog/2025/10/06/secure-use-of-the-agent-payments-protocol-ap2-a-framework-for-trustworthy-ai-driven-transactions"
						target="_blank"
						rel="noopener">Secure Use of the Agent Payments Protocol (AP2)</a
					> (CSA, Oct 2025) — Cloud Security Alliance framework for trustworthy AI-driven payment transactions.
				</li>
			</ul>

			<h3>Trust Governance & Standards</h3>
			<ul>
				<li>
					<a
						href="https://www.lfdecentralizedtrust.org/blog/toip-and-dif-announce-three-new-working-groups-for-trust-in-the-age-of-ai"
						target="_blank"
						rel="noopener">ToIP & DIF: Trust in the Age of AI Working Groups</a
					> (Sep 2025) — Three working groups addressing decentralized trust graphs, human trust in AI,
					and trusted AI agents under the Linux Foundation.
				</li>
				<li>
					<a
						href="https://singularitynet.io/singularitynet-privado-id-partnership/"
						target="_blank"
						rel="noopener"
						>SingularityNET + Privado ID: First Decentralized AI Agent Trust Registry</a
					> (Mar 2025) — Partnership launching the first decentralized trust registry in the ASI ecosystem.
				</li>
			</ul>
		</section>

		<!-- Continue Reading -->
		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/cross-platform-trust" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						Cross-Platform Trust Signals
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How reputation data flows between KYM and NANDA.
					</p>
				</a>
				<a href="/blog/agentfacts" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						AgentFacts: Verifiable Credentials
					</h4>
					<p class="text-xs text-nanda-text-dim">
						The W3C VC-based identity layer behind agent registration.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
