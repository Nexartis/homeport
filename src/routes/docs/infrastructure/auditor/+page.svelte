<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Points Auditor — Homeport</title>
	<meta
		name="description"
		content="Points Auditor — x402-NP payment intent reconciliation, settlement verification, wallet management, and audit trails for the NANDA economic layer."
	/>
	<meta property="og:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
	<meta name="twitter:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
</svelte:head>

<div class="prose">
	<div class="flex items-center gap-3 mb-2 not-prose">
		<span class="text-3xl text-nanda-accent">⬡</span>
		<h1 class="text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold !mb-0">Points Auditor</h1>
		<span class="status-badge status-operational text-[11px]">operational</span>
	</div>
	<p>
		The <strong>Points Auditor</strong> is the economic layer of the NANDA network — managing x402-NP
		payment intents, settlement verification, wallet balances, and reconciliation for agent-to-agent value
		transfers. It provides a complete audit trail for every economic interaction in the ecosystem.
	</p>

	<h2>Core Capabilities</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Payment Intents</h4>
			<p class="text-sm text-nanda-text-muted">
				x402-NP payment intents define value transfers between agents — payer, payee, amount in
				NANDA Points (NP), memo, nonce, and expiry window. Intents are tracked from creation through
				settlement.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Settlement Verification</h4>
			<p class="text-sm text-nanda-text-muted">
				Settlements record completed value transfers with transaction hashes and HMAC-SHA256
				signatures (using <code>KYM_NANDA_RADIUS_SECRET</code>). Each settlement is verified for
				authenticity before crediting.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">👛 Wallet Management</h4>
			<p class="text-sm text-nanda-text-muted">
				Per-agent wallets track balances in NANDA Points (NP) with currency and scale metadata.
				Balances are updated atomically as settlements are processed.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Reconciliation</h4>
			<p class="text-sm text-nanda-text-muted">
				Automated reconciliation matches payment intents to settlements, computing deltas and
				flagging mismatches. Verdicts are recorded with latency metrics for audit.
			</p>
		</div>
	</div>

	<h2>Payment Intent Lifecycle</h2>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">1. Create</span>
				<h4 class="font-semibold">Intent Created</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				A payer agent creates an intent specifying the payee, amount (NP), optional memo, and a time
				window for settlement. A unique nonce prevents replay attacks.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">2. Open</span>
				<h4 class="font-semibold">Awaiting Settlement</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				The intent remains <code>open</code> until the payee submits a settlement or the expiry window
				elapses. Open intents are monitored for timeout.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">3. Settle</span>
				<h4 class="font-semibold">Settlement Submitted</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				The payee submits a settlement with a transaction hash and signature. The system verifies
				the signature and records the settlement with a verified status.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">4. Reconcile</span>
				<h4 class="font-semibold">Reconciliation</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				The reconciliation engine matches the intent to its settlement, computes any delta, measures
				settlement latency, and records a verdict (match, mismatch, or timeout).
			</p>
		</div>
	</div>

	<h2>A2A Protocol Actions</h2>
	<p>The Auditor is accessible via the A2A JSON-RPC protocol at <code>/a2a</code>:</p>
	<div class="grid gap-2 my-6 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">audit.intent</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Declare a payment intent specifying payer, payee, amount, memo, and expiry window
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">audit.tx</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Submit a settlement transaction with HMAC-SHA256 signature for verification and
				reconciliation
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">audit.status</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Query the audit status of a payment intent — settlement, reconciliation verdict, and wallet
				impact
			</p>
		</div>
	</div>

	<h2>Mismatch Detection</h2>
	<p>The reconciliation engine automatically flags mismatches when:</p>
	<ul>
		<li><strong>Amount delta</strong> — settlement amount differs from intent amount</li>
		<li><strong>Signature failure</strong> — settlement signature cannot be verified</li>
		<li><strong>Timeout</strong> — intent expires without a matching settlement</li>
		<li><strong>Duplicate</strong> — multiple settlements reference the same intent</li>
	</ul>

	<h2>Integration with Other Services</h2>
	<ul>
		<li>
			<strong><a href="/docs/infrastructure/registry">Agent Registry</a></strong> — wallet accounts are
			linked to registered agent IDs
		</li>
		<li>
			<strong><a href="/docs/infrastructure/certifier">Capability Certifier</a></strong> — certification
			may require point deposits or escrow
		</li>
		<li>
			<strong><a href="/docs/infrastructure/observer">Observer Evaluator</a></strong> — reputation scores
			influence credit multipliers
		</li>
		<li>
			<strong><a href="/docs/infrastructure/compliance">Compliance Enforcer</a></strong> — payment compliance
			rules and violation tracking
		</li>
	</ul>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/a2a">A2A Protocol</a> for points actions ·
		<a href="/docs/trust">Trust & Security</a>
		for settlement signatures · <a href="/docs/infrastructure">Infrastructure Overview</a>
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/developer-api-keys">Developer API Keys</a> — API tiers and rate limits that feed
		billing ·
		<a href="/series/agentic-web/governance-at-scale">Governance at Scale</a> — accountability in multi-stakeholder
		agent ecosystems
	</div>
</div>
