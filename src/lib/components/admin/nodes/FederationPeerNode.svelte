<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Globe } from 'lucide-svelte';

	interface PeerNodeData {
		peer_url: string;
		sync_status?: 'synced' | 'syncing' | 'error' | 'unknown';
	}

	const { data }: { data: PeerNodeData } = $props();

	const statusClass = $derived(
		data.sync_status === 'synced'
			? 'bg-nanda-success'
			: data.sync_status === 'syncing'
				? 'bg-nanda-accent'
				: data.sync_status === 'error'
					? 'bg-nanda-danger'
					: 'bg-nanda-text-dim'
	);

	const displayUrl = $derived(() => {
		try {
			return new URL(data.peer_url).hostname;
		} catch {
			return data.peer_url;
		}
	});
</script>

<div
	class="rounded-lg border border-nanda-accent-500/40 bg-nanda-bg-surface px-3 py-2 min-w-[150px] shadow-lg"
>
	<div class="flex items-center gap-2">
		<Globe class="h-4 w-4 text-nanda-accent-400 flex-shrink-0" />
		<span class="text-xs font-medium text-nanda-text truncate max-w-[110px]">{displayUrl()}</span>
		<span
			class="h-2 w-2 rounded-full {statusClass} flex-shrink-0"
			title={data.sync_status ?? 'unknown'}
		></span>
	</div>
	<Handle
		type="target"
		position={Position.Left}
		class="!bg-nanda-accent-400 !w-2 !h-2 !border-nanda-bg-surface"
	/>
	<Handle
		type="source"
		position={Position.Right}
		class="!bg-nanda-accent-400 !w-2 !h-2 !border-nanda-bg-surface"
	/>
</div>
