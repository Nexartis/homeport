<script lang="ts">
	import { ShieldCheck, Scale, Eye, CircleCheck } from 'lucide-svelte';
	import { relativeTime } from '$lib/utils/date';

	interface ActivityItem {
		service: string;
		type: string | null;
		createdAt: number | null;
	}

	const {
		items = [],
		class: className = ''
	}: {
		items: ActivityItem[];
		class?: string;
	} = $props();

	const serviceIcons: Record<string, typeof ShieldCheck> = {
		certifier: ShieldCheck,
		compliance: Scale,
		observer: Eye
	};

	const typeColors: Record<string, string> = {
		ALLOW: 'text-nanda-success',
		DENY: 'text-nanda-danger',
		ESCALATE: 'text-nanda-warning',
		complete: 'text-nanda-success',
		failed: 'text-nanda-danger',
		pending: 'text-nanda-text-dim',
		running: 'text-nanda-accent',
		success: 'text-nanda-success',
		error: 'text-nanda-danger'
	};
</script>

<div class="space-y-1 max-h-80 overflow-y-auto {className}">
	{#if items.length === 0}
		<p class="text-sm text-nanda-text-dim py-4 text-center">No recent activity</p>
	{:else}
		{#each items as item, i (i)}
			{@const Icon = serviceIcons[item.service] ?? CircleCheck}
			<div
				class="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-nanda-bg-elevated transition-colors"
			>
				<Icon class="h-3.5 w-3.5 text-nanda-text-dim flex-shrink-0" />
				<div class="flex-1 min-w-0">
					<p class="text-xs text-nanda-text truncate">
						<span class="font-medium capitalize">{item.service}</span>
						<span class="mx-1 text-nanda-text-dim">·</span>
						<span class={typeColors[item.type ?? ''] ?? 'text-nanda-text-muted'}
							>{item.type ?? '—'}</span
						>
					</p>
				</div>
				<span class="text-[10px] text-nanda-text-dim font-mono flex-shrink-0">
					{relativeTime(item.createdAt)}
				</span>
			</div>
		{/each}
	{/if}
</div>
