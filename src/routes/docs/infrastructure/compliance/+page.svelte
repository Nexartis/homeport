<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Compliance Enforcer — Homeport</title>
	<meta
		name="description"
		content="Compliance Enforcer — policy decision engine with PII redaction, regional routing, and governance enforcement for AI agents on the NANDA network."
	/>
	<meta property="og:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
	<meta name="twitter:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
</svelte:head>

<div class="prose">
	<div class="flex items-center gap-3 mb-2 not-prose">
		<span class="text-3xl text-nanda-accent">⬡</span>
		<h1 class="text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold !mb-0">Compliance Enforcer</h1>
		<span class="status-badge status-operational text-[11px]">operational</span>
	</div>
	<p>
		The <strong>Compliance Enforcer</strong> is the governance layer of the NANDA network — a policy decision
		engine that evaluates every agent interaction against configurable rules for PII protection, regional
		routing, capability restrictions, and regulatory compliance.
	</p>

	<h2>Core Capabilities</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Policy Decision Point</h4>
			<p class="text-sm text-nanda-text-muted">
				Versioned policy documents define allow/deny rules. Each incoming agent interaction is
				evaluated against the active policy set, producing an <code>allow</code> or
				<code>deny</code> decision with reasons.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">PII Redaction</h4>
			<p class="text-sm text-nanda-text-muted">
				Automatic detection and redaction of personally identifiable information in agent payloads —
				enforcing data minimization principles before cross-agent communication.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Regional Routing</h4>
			<p class="text-sm text-nanda-text-muted">
				Jurisdiction-aware routing rules ensure data residency compliance. Agents in specific
				jurisdictions are routed to appropriate regional endpoints.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Violation Tracking</h4>
			<p class="text-sm text-nanda-text-muted">
				Every policy violation is recorded with the offending agent, envelope hash, reason, and
				timestamp — providing a complete compliance audit trail.
			</p>
		</div>
	</div>

	<h2>Decision Flow</h2>
	<p>When an agent interaction is submitted for compliance evaluation:</p>
	<ol>
		<li>
			<strong>Envelope received</strong> — the interaction payload (from agent, to agent, capability,
			data) is captured
		</li>
		<li>
			<strong>Policy evaluation</strong> — active policies are applied in version order against the envelope
		</li>
		<li>
			<strong>Decision recorded</strong> — an <code>allow</code> or <code>deny</code> decision is stored
			with the full reasoning chain
		</li>
		<li>
			<strong>Violation flagged</strong> — if denied, a violation record is created for audit and potential
			enforcement action
		</li>
	</ol>

	<h2>Policy Structure</h2>
	<p>Policies are stored as versioned JSON rule sets. Each policy contains:</p>
	<div class="grid gap-3 my-6 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">policy_id</code>
			<p class="text-xs text-nanda-text-muted mt-1">Unique identifier for the policy</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">rules_json</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				JSON-encoded rule set defining conditions, actions, and enforcement levels
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-xs font-bold">version</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Integer version — higher versions take precedence during evaluation
			</p>
		</div>
	</div>

	<h2>A2A Protocol Actions</h2>
	<p>The Compliance Enforcer is accessible via the A2A JSON-RPC protocol at <code>/a2a</code>:</p>
	<div class="grid gap-2 my-6 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">policy.eval</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Evaluate an interaction envelope against the active policy — returns decision, reasons, and
				optional PII-redacted envelope
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">policy.rules.get</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Retrieve the current policy rules, optionally filtered by policy ID
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">policy.violation</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Report a policy violation for an agent with reason and severity
			</p>
		</div>
	</div>

	<h2>Zero Trust Agentic Access (ZTAA)</h2>
	<p>
		The Compliance Enforcer implements the <strong>ZTAA</strong> framework — applying Zero Trust principles
		to AI agent interactions:
	</p>
	<ul>
		<li>
			<strong>Verify Explicitly</strong> — every interaction requires cryptographic verification, never
			implicit trust
		</li>
		<li>
			<strong>Least Privilege</strong> — agents are granted only the minimum capabilities needed per interaction
		</li>
		<li>
			<strong>Assume Breach</strong> — continuous monitoring and revocation ensure compromised agents
			are detected and isolated
		</li>
	</ul>

	<h2>Integration with Other Services</h2>
	<ul>
		<li>
			<strong><a href="/docs/infrastructure/registry">Agent Registry</a></strong> — reads agent jurisdiction
			and capability data for policy evaluation
		</li>
		<li>
			<strong><a href="/docs/infrastructure/certifier">Capability Certifier</a></strong> — compliance
			attestations may reference certification grades
		</li>
		<li>
			<strong><a href="/docs/infrastructure/observer">Observer Evaluator</a></strong> — compliance violations
			feed into reputation scoring
		</li>
		<li>
			<strong><a href="/docs/infrastructure/auditor">Points Auditor</a></strong> — violation tracking
			integrates with the audit trail
		</li>
	</ul>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust">Trust & Security</a> for ZTAA details ·
		<a href="/docs/a2a">A2A Protocol</a>
		for compliance actions · <a href="/docs/infrastructure">Infrastructure Overview</a>
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/series/agentic-web/governance-at-scale">Governance at Scale</a> — multi-stakeholder
		governance frameworks for agent ecosystems ·
		<a href="/blog/cross-platform-trust">Cross-Platform Trust</a> — portable compliance across registries
	</div>
</div>
