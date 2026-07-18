<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Bot } from 'lucide-svelte';

	interface AgentNodeData {
		agent_id: string;
		status: string;
		capabilities?: string | null;
	}

	const { data }: { data: AgentNodeData } = $props();

	const statusClass = $derived(
		data.status === 'alive'
			? 'bg-nanda-success'
			: data.status === 'dead'
				? 'bg-nanda-danger'
				: 'bg-nanda-warning'
	);

	const capList = $derived(() => {
		try {
			return data.capabilities ? JSON.parse(data.capabilities) : [];
		} catch {
			return [];
		}
	});
</script>

<div
	class="rounded-lg border border-nanda-border bg-nanda-bg-surface px-3 py-2 min-w-[160px] shadow-lg hover:border-nanda-border-hover transition-colors"
>
	<div class="flex items-center gap-2 mb-1">
		<Bot class="h-4 w-4 text-nanda-primary-400 flex-shrink-0" />
		<span class="text-xs font-medium text-nanda-text truncate max-w-[120px]">{data.agent_id}</span>
		<span class="h-2 w-2 rounded-full {statusClass} flex-shrink-0" title={data.status}></span>
	</div>
	{#if capList().length > 0}
		<div class="flex flex-wrap gap-1 mt-1">
			{#each capList().slice(0, 3) as cap}
				<span
					class="text-[9px] px-1.5 py-0.5 rounded bg-nanda-primary-500/10 text-nanda-primary-300 border border-nanda-primary-500/20"
					>{cap}</span
				>
			{/each}
			{#if capList().length > 3}
				<span class="text-[9px] text-nanda-text-dim">+{capList().length - 3}</span>
			{/if}
		</div>
	{/if}
	<Handle
		type="target"
		position={Position.Top}
		class="!bg-nanda-primary-400 !w-2 !h-2 !border-nanda-bg-surface"
	/>
	<Handle
		type="source"
		position={Position.Bottom}
		class="!bg-nanda-accent-400 !w-2 !h-2 !border-nanda-bg-surface"
	/>
</div>
