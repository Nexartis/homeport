<script lang="ts">
	import { Workflow, ExternalLink } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Orchestration — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<div class="nanda-card flex flex-col items-center text-center py-12 px-6 gap-4">
		<div class="h-14 w-14 rounded-2xl bg-nanda-primary-500/10 flex items-center justify-center">
			<Workflow class="h-7 w-7 text-nanda-primary-400" />
		</div>
		<div>
			<h1 class="text-lg font-semibold text-nanda-text mb-1">Orchestration</h1>
			<span
				class="inline-block text-[10px] uppercase tracking-wider font-semibold bg-nanda-primary-500/20 text-nanda-primary-400 px-2 py-0.5 rounded-full mb-3"
				>Coming Soon</span
			>
			<p class="text-sm text-nanda-text-muted max-w-md">
				Design workflows, manage DAG pipelines, and orchestrate multi-agent operations.
			</p>
		</div>
		<a
			href="/docs/orchestration"
			class="inline-flex items-center gap-1.5 text-sm text-nanda-primary-400 hover:text-nanda-primary-300 transition-colors mt-2"
		>
			Read the Orchestration docs
			<ExternalLink class="h-3.5 w-3.5" />
		</a>
	</div>
</div>
