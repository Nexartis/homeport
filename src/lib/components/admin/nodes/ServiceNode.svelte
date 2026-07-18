<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Database, ShieldCheck, Scale, Eye, Coins } from 'lucide-svelte';
	interface ServiceNodeData {
		label: string;
		service: string;
		count?: number;
	}

	const { data }: { data: ServiceNodeData } = $props();

	// lucide-svelte exports class-style components; use typeof for the icon map
	const serviceIcons: Record<string, typeof Database> = {
		registry: Database,
		certifier: ShieldCheck as unknown as typeof Database,
		compliance: Scale as unknown as typeof Database,
		observer: Eye as unknown as typeof Database,
		auditor: Coins as unknown as typeof Database
	};

	const Icon = $derived(serviceIcons[data.service] ?? Database);
</script>

<div
	class="rounded-xl border-2 border-nanda-primary-500/40 bg-nanda-bg-elevated px-4 py-3 min-w-[140px] shadow-xl"
>
	<div class="flex items-center gap-2.5">
		<div class="flex items-center justify-center h-8 w-8 rounded-lg bg-nanda-primary-500/20">
			<Icon class="h-4 w-4 text-nanda-primary-400" />
		</div>
		<div>
			<p class="text-sm font-semibold text-nanda-text">{data.label}</p>
			{#if data.count !== undefined}
				<p class="text-[10px] text-nanda-text-dim font-mono">{data.count} items</p>
			{/if}
		</div>
	</div>
	<Handle
		type="target"
		position={Position.Top}
		class="!bg-nanda-primary-400 !w-2.5 !h-2.5 !border-nanda-bg-elevated"
	/>
	<Handle
		type="source"
		position={Position.Bottom}
		class="!bg-nanda-accent-400 !w-2.5 !h-2.5 !border-nanda-bg-elevated"
	/>
</div>
