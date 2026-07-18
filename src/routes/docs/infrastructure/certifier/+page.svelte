<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Capability Certifier — Homeport</title>
	<meta
		name="description"
		content="Capability Certifier — Wilson confidence interval scoring with W3C Verifiable Credentials for cryptographic proof of AI agent capabilities."
	/>
	<meta property="og:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
	<meta name="twitter:image" content={`${page.data.registryUrl}/og/docs-infrastructure.png`} />
</svelte:head>

<div class="prose">
	<div class="flex items-center gap-3 mb-2 not-prose">
		<span class="text-3xl text-nanda-accent">⬡</span>
		<h1 class="text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold !mb-0">Capability Certifier</h1>
		<span class="status-badge status-operational text-[11px]">operational</span>
	</div>
	<p>
		The <strong>Capability Certifier</strong> tests and certifies AI agent capabilities using
		statistically rigorous multi-trial evaluation. It issues
		<strong>W3C Verifiable Credentials</strong> backed by Ed25519 signatures, providing cryptographic
		proof that an agent meets claimed capability standards.
	</p>

	<h2>How It Works</h2>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">Step 1</span>
				<h4 class="font-semibold">Certification Job Created</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				A certification request is submitted for a specific agent and capability. The system creates
				a job with a configurable number of test trials (default: multi-trial).
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">Step 2</span>
				<h4 class="font-semibold">Multi-Trial Testing</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Jobs are processed inline via cron-triggered scheduling and the <code
					>/api/queue/cert-trial</code
				> endpoint. Each trial evaluates the agent's capability independently, building a statistical
				sample.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">Step 3</span>
				<h4 class="font-semibold">Wilson CI Scoring</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Results are aggregated using the <strong>Wilson confidence interval</strong> method — computing
				a 95% CI lower bound that accounts for sample size, giving a conservative but fair assessment.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-nanda-primary-500">
			<div class="flex items-center gap-2 mb-2">
				<span class="text-sm font-bold text-nanda-primary-400">Step 4</span>
				<h4 class="font-semibold">Credential Issuance</h4>
			</div>
			<p class="text-sm text-nanda-text-muted">
				Passing agents receive a W3C Verifiable Credential signed with Ed25519, including the score,
				grade, confidence interval, and a Bitstring Status List revocation reference.
			</p>
		</div>
	</div>

	<h2>Key Features</h2>
	<div class="grid md:grid-cols-2 gap-4 my-6 not-prose">
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Wilson Confidence Interval</h4>
			<p class="text-sm text-nanda-text-muted">
				Statistical scoring that accounts for sample size — small trial counts get wider confidence
				intervals, preventing inflated scores from limited data.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Grading System</h4>
			<p class="text-sm text-nanda-text-muted">
				Agents receive letter grades based on their CI lower bound score, making capability levels
				immediately interpretable by consuming agents.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">Ed25519 Signatures</h4>
			<p class="text-sm text-nanda-text-muted">
				Every certificate is signed using versioned Ed25519 keys with HMAC envelope protection —
				independently verifiable by any third party.
			</p>
		</div>
		<div class="nanda-card">
			<h4 class="font-semibold mb-1">⛔ Revocation Support</h4>
			<p class="text-sm text-nanda-text-muted">
				Certificates include a Bitstring Status List reference. Compromised or stale credentials can
				be revoked instantly via the A2A <code>certificate.revoke</code> action.
			</p>
		</div>
	</div>

	<h2>A2A Protocol Actions</h2>
	<p>The Certifier is accessible via the A2A JSON-RPC protocol at <code>/a2a</code>:</p>
	<div class="grid gap-2 my-6 not-prose">
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">start</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Submit a certification request for an agent's capability — creates a job with multi-trial
				testing
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">status</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Check the status and progress of a certification job by job ID
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">certificate</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Retrieve a completed certificate by cert ID — includes score, grade, and W3C VC
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">certificate.revoke</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Revoke a previously issued certificate with an optional reason
			</p>
		</div>
		<div class="nanda-card !py-3">
			<code class="text-sm font-bold">certificate.check</code>
			<p class="text-xs text-nanda-text-muted mt-1">
				Verify a certificate's revocation status via Bitstring Status List
			</p>
		</div>
	</div>

	<h2>Evidence Storage</h2>
	<p>
		Test artifacts, trial results, and certification evidence are stored in the <code
			>KYM_NANDA_EVIDENCE</code
		> R2 bucket — providing a durable audit trail for every certification decision.
	</p>

	<h2>Integration with Other Services</h2>
	<ul>
		<li>
			<strong><a href="/docs/infrastructure/registry">Agent Registry</a></strong> — agents must be registered
			before certification
		</li>
		<li>
			<strong><a href="/docs/infrastructure/compliance">Compliance Enforcer</a></strong> — compliance
			attestations may reference certification grades
		</li>
		<li>
			<strong><a href="/docs/infrastructure/observer">Observer Evaluator</a></strong> — reputation scores
			factor in certification level
		</li>
		<li>
			<strong><a href="/docs/trust">Trust & Security</a></strong> — Ed25519 signing and Bitstring Status
			List revocation infrastructure
		</li>
	</ul>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/trust">Trust & Security</a> for Ed25519 and W3C VCs ·
		<a href="/docs/a2a">A2A Protocol</a>
		for certification actions · <a href="/docs/infrastructure">Infrastructure Overview</a>
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/zero-trust-agents">Zero-Trust for Agents</a> — the security model behind agent
		certification ·
		<a href="/series/agentic-web/security-blueprint">Security Blueprint</a> — ZTAA and agent verification
		in the Agentic Web series
	</div>
</div>
