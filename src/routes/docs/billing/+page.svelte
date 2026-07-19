<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Billing &amp; Payments — Homeport</title>
	<meta
		name="description"
		content="Subscriptions, invoices, revenue sharing, multi-currency support, and Universal Checkout Protocol (UCP)."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-billing.png" />
</svelte:head>

<div class="prose">
	<h1>Billing &amp; Payments</h1>
	<p>
		The NANDA node includes a complete <strong>billing infrastructure</strong> for monetizing agent
		services — subscriptions, usage metering, invoicing, revenue sharing, and the Universal Checkout
		Protocol (UCP). All monetary values use <strong>Nexartis Points (NP)</strong> as the internal unit
		of account.
	</p>

	<div class="callout callout-info">
		<strong>NP (Nexartis Points):</strong> The platform's internal currency. All billing, subscriptions,
		and revenue sharing are denominated in NP. Exchange rates to fiat currencies (USD, EUR, GBP, JPY)
		are configurable via the multi-currency system.
	</div>

	<h2>Subscriptions</h2>
	<p>
		Plan-based subscriptions with 30-day billing cycles. The subscription fee is debited from the
		developer's NP wallet at creation time. Plan changes are prorated.
	</p>
	<pre><code class="language-bash"
			>{@html `curl -X POST https://your-node.example.com/api/subscriptions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer nanda_YOUR_KEY" \\
  -d '{
    "keyId": "key_abc123",
    "plan": "pro"
  }'`}</code
		></pre>

	<h3>Subscription Lifecycle</h3>
	<ul>
		<li>
			<strong>Create</strong> — Validates plan, checks NP balance, debits wallet, creates subscription
		</li>
		<li>
			<strong>Change plan</strong> — Computes prorated credit/charge for remaining period; upgrades debit
			the difference, downgrades credit back
		</li>
		<li><strong>Cancel</strong> — Sets status to <code>cancelled</code>, disables auto-renew</li>
		<li>
			<strong>Auto-renew</strong> — Cron sweeps expired subscriptions and renews those with
			<code>autoRenew = true</code> and sufficient balance
		</li>
	</ul>

	<h2>Billing Periods &amp; Metering</h2>
	<p>
		API usage is tracked per billing period. Each period has included calls based on the
		subscription tier, with overage charges for excess usage:
	</p>
	<div class="grid gap-3 my-4 not-prose">
		<div class="nanda-card !py-3">
			<h4 class="font-semibold mb-1">Period Lifecycle</h4>
			<p class="text-xs text-nanda-text-muted">
				Periods are <code>open</code> → <code>closed</code>. When a period closes, line items are
				generated automatically (overage or base usage). Cron sweeps expired open periods.
			</p>
		</div>
		<div class="nanda-card !py-3">
			<h4 class="font-semibold mb-1">Line Items</h4>
			<p class="text-xs text-nanda-text-muted">
				Categories: <code>base</code> (within-limit, zero cost) or <code>overage</code>
				(excess calls × overage rate in NP). Each line item includes quantity, unit price, and total.
			</p>
		</div>
	</div>

	<h2>Invoicing</h2>
	<p>
		Invoices are generated with <strong>sequential invoice numbers</strong> per tenant. Each invoice references
		a billing period and its line items:
	</p>
	<pre><code class="language-bash"
			># List invoices for a key
curl "https://your-node.example.com/api/invoices?keyId=key_abc123" \
  -H "Authorization: Bearer nanda_YOUR_KEY"</code
		></pre>

	<h2>Revenue Sharing</h2>
	<p>
		Revenue from agent API calls is split between agent developers and the platform. Splits are
		configurable per agent. Track developer earnings via the developer portal:
	</p>
	<pre><code class="language-bash"
			>curl "https://your-node.example.com/api/developer/earnings" \
  -H "Authorization: Bearer nanda_YOUR_KEY"</code
		></pre>

	<h2>Multi-Currency &amp; Wallets</h2>
	<p>
		Built-in currency table with configurable exchange rates. Multi-currency wallets track balances
		per agent. Use MCP tools for currency operations:
	</p>
	<ul>
		<li><code>nanda_get_exchange_rates</code> — Query current rates</li>
		<li><code>nanda_get_wallet_balance</code> — Check multi-currency balances</li>
		<li><code>nanda_convert_currency</code> — Convert between currencies</li>
	</ul>

	<h2>Universal Checkout Protocol (UCP)</h2>
	<p>
		The UCP provides a standardized checkout flow for agent-to-agent payments. Create checkout
		sessions via <code>POST /api/ucp/checkout-sessions</code> that can be settled across currencies
		and payment methods. Sessions are stored in the <code>ucp_checkout_sessions</code> table.
	</p>

	<h2>API Endpoints</h2>
	<table>
		<thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
		<tbody>
			<tr><td>POST</td><td><code>/api/subscriptions</code></td><td>Create subscription</td></tr>
			<tr
				><td>GET</td><td><code>/api/subscriptions?keyId=</code></td><td>Get active subscription</td
				></tr
			>
			<tr
				><td>DELETE</td><td><code>/api/subscriptions/:id</code></td><td>Cancel subscription</td></tr
			>
			<tr
				><td>PATCH</td><td><code>/api/subscriptions/:id/change</code></td><td
					>Change plan (prorated)</td
				></tr
			>
			<tr><td>POST</td><td><code>/api/invoices</code></td><td>Generate invoice</td></tr>
			<tr><td>GET</td><td><code>/api/invoices?keyId=</code></td><td>List invoices</td></tr>
			<tr
				><td>POST</td><td><code>/api/admin/billing/close-period</code></td><td
					>Close a billing period</td
				></tr
			>
			<tr><td>GET</td><td><code>/api/developer/earnings</code></td><td>Developer earnings</td></tr>
			<tr
				><td>POST</td><td><code>/api/ucp/checkout-sessions</code></td><td
					>Create UCP checkout session</td
				></tr
			>
			<tr><td>GET</td><td><code>/api/payments</code></td><td>Currency &amp; exchange rates</td></tr>
		</tbody>
	</table>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/mcp">MCP Tools</a> for payment-related tools ·
		<a href="/docs/api">API Reference</a> for all endpoints
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/developer-api-keys">Developer API Keys</a> — key management, tiers, and rate limits
		for billing integration
	</div>
</div>
