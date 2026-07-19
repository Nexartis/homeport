<script lang="ts">
	import { page } from '$app/state';
	import { X } from 'lucide-svelte';

	const {
		mobile = false,
		onclose
	}: {
		mobile?: boolean;
		onclose?: () => void;
	} = $props();

	const DOC_TOPICS = [
		{ href: '/docs', label: 'Overview' },
		{ href: '/docs/nanda', label: 'What is NANDA' },
		{ href: '/docs/quickstart', label: 'Quickstart' },
		{ href: '/docs/a2a', label: 'A2A Protocol' },
		{ href: '/docs/mcp', label: 'MCP Server' },
		{ href: '/docs/api', label: 'API Reference' },
		{ href: '/docs/sdk', label: 'SDK & Libraries' },
		{ href: '/docs/developers', label: 'Developer API Keys' },
		{ href: '/docs/federation', label: 'Federation' },
		{ href: '/docs/orchestration', label: 'Orchestration' },
		{ href: '/docs/webhooks', label: 'Webhooks' },
		{ href: '/docs/trust', label: 'Trust & Security' },
		{ href: '/docs/trust/toip', label: 'ToIP Alignment', sub: true },
		{ href: '/docs/agentfacts', label: 'AgentFacts' },
		{ href: '/docs/resolver', label: 'Resolution & Discovery' },
		{ href: '/docs/data-model', label: 'Data Model' },
		{ href: '/docs/billing', label: 'Billing & Payments' }
	];

	const INFRA_TOPICS = [
		{ href: '/docs/infrastructure/registry', label: 'Agent Registry' },
		{ href: '/docs/infrastructure/certifier', label: 'Capability Certifier' },
		{ href: '/docs/infrastructure/compliance', label: 'Compliance Enforcer' },
		{ href: '/docs/infrastructure/observer', label: 'Observer Evaluator' },
		{ href: '/docs/infrastructure/auditor', label: 'Points Auditor' }
	];

	/** Docs sidebar uses exact match since topics share prefixes (e.g. /docs/trust vs /docs/trust/toip) */
	function isActive(href: string) {
		return page.url.pathname === href;
	}

	const isInfraSection = $derived(page.url.pathname.startsWith('/docs/infrastructure'));

	function handleLinkClick() {
		if (mobile && onclose) onclose();
	}
</script>

{#snippet navContent()}
	<p class="text-xs font-semibold uppercase tracking-wider text-nanda-text-dim mb-3 px-3">
		Documentation
	</p>
	<nav class="flex flex-col gap-0.5" aria-label="Documentation">
		{#each DOC_TOPICS as topic}
			<a
				href={topic.href}
				onclick={handleLinkClick}
				class="{topic.sub ? 'pl-6' : 'px-3'} py-1.5 text-sm rounded-lg transition-colors {isActive(
					topic.href
				)
					? 'text-white bg-nanda-primary-500/15 font-medium'
					: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'} {topic.sub
					? 'pr-3'
					: ''}">{topic.label}</a
			>
		{/each}

		<!-- Infrastructure section with expandable sub-links -->
		<a
			href="/docs/infrastructure"
			onclick={handleLinkClick}
			class="px-3 py-1.5 text-sm rounded-lg transition-colors {isInfraSection
				? 'text-white bg-nanda-primary-500/15 font-medium'
				: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}">Infrastructure</a
		>
		{#if isInfraSection}
			<div class="flex flex-col gap-0.5 ml-3 border-l border-nanda-border/40 pl-2">
				{#each INFRA_TOPICS as sub}
					<a
						href={sub.href}
						onclick={handleLinkClick}
						class="px-2 py-1 text-[13px] rounded-md transition-colors {isActive(sub.href)
							? 'text-nanda-primary-400 font-medium'
							: 'text-nanda-text-dim hover:text-nanda-text-muted'}">{sub.label}</a
					>
				{/each}
			</div>
		{/if}
	</nav>
{/snippet}

<!-- Desktop sidebar -->
{#if !mobile}
	<aside class="w-56 shrink-0 hidden lg:block">
		<div class="sticky top-20">
			{@render navContent()}
		</div>
	</aside>
{:else}
	<!-- Mobile slide-out overlay -->
	<div
		class="fixed inset-0 z-50 lg:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Documentation navigation"
	>
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={onclose}
			aria-label="Close navigation"
		></button>
		<!-- Drawer -->
		<div
			class="absolute left-0 top-0 bottom-0 w-72 bg-nanda-bg-surface border-r border-nanda-border p-4 overflow-y-auto"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-sm font-semibold text-nanda-text">Docs Navigation</span>
				<button
					onclick={onclose}
					class="p-1 rounded-lg text-nanda-text-dim hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
					aria-label="Close navigation"
				>
					<X size={18} />
				</button>
			</div>
			{@render navContent()}
		</div>
	</div>
{/if}
