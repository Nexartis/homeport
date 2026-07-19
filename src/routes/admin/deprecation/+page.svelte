<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import { TriangleAlert, Clock, Trash2, Skull } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { formatDate, daysUntilSunset } from '$lib/utils/date';
	import type { DeprecationItem, DeprecationStats } from '$lib/types/admin';

	const { data, form } = $props();

	const stats = $derived(data.stats as DeprecationStats | null);

	const tableColumns = [
		{ key: 'agent_id', label: 'Agent ID', class: 'font-mono text-xs' },
		{ key: '_version', label: 'Version' },
		{ key: '_status', label: 'Status' },
		{ key: '_deprecated_at', label: 'Deprecated At' },
		{ key: '_sunset_at', label: 'Sunset At' },
		{ key: '_countdown', label: 'Days Left' }
	];

	const tableRows = $derived(
		((data.items ?? []) as DeprecationItem[]).map((item) => ({
			...item,
			_version: item.version ?? '—',
			_status: item.status,
			_deprecated_at: formatDate(item.deprecated_at),
			_sunset_at: formatDate(item.sunset_at),
			_countdown: item.status === 'tombstoned' ? '☠️' : daysUntilSunset(item.sunset_at)
		}))
	);

	let selectedAgent = $state<DeprecationItem | null>(null);
	let actionLoading = $state(false);
	let actionError = $state<string | null>(null);

	function handleRowClick(row: Record<string, unknown>) {
		selectedAgent =
			(data.items as DeprecationItem[]).find((a) => a.agent_id === row.agent_id) ?? null;
		actionError = null;
	}

	// Reflect form action errors
	$effect(() => {
		if (form && typeof form === 'object' && 'error' in (form as Record<string, unknown>)) {
			actionError = (form as { error: string }).error;
		}
	});
</script>

<svelte:head>
	<title>Deprecation — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- KPI Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
		<StatWidget label="Deprecated" value={stats?.deprecated ?? 0} icon={TriangleAlert} />
		<StatWidget label="Tombstoned" value={stats?.tombstoned ?? 0} icon={Skull} />
		<StatWidget
			label="Expiring ≤ 7d"
			value={stats?.expiring_soon ?? 0}
			subtitle="sunset imminent"
			icon={Clock}
		/>
	</div>

	<!-- Deprecation Table -->
	<BaseWidget title="Deprecated & Tombstoned Agents">
		<TableWidget
			columns={tableColumns}
			rows={tableRows}
			searchable
			pageSize={25}
			onRowClick={handleRowClick}
		/>
	</BaseWidget>

	<!-- Detail Panel -->
	{#if selectedAgent}
		<BaseWidget title="Agent — {selectedAgent.agent_id}">
			<div class="space-y-3 text-sm">
				<div class="grid grid-cols-2 gap-x-6 gap-y-2">
					<div>
						<span class="text-nanda-text-dim text-xs">Agent URL</span>
						<p class="text-nanda-text font-mono text-xs break-all">{selectedAgent.agent_url}</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Version</span>
						<p class="text-nanda-text">{selectedAgent.version ?? '—'}</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Status</span>
						<p>
							<span
								class="env-badge {selectedAgent.status === 'deprecated'
									? 'env-staging'
									: 'env-prod'}">{selectedAgent.status}</span
							>
						</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Deprecated At</span>
						<p class="text-nanda-text">{formatDate(selectedAgent.deprecated_at)}</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Sunset At</span>
						<p class="text-nanda-text">{formatDate(selectedAgent.sunset_at)}</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Countdown</span>
						<p class="text-nanda-text font-mono">
							{selectedAgent.status === 'tombstoned'
								? '☠️ Tombstoned'
								: daysUntilSunset(selectedAgent.sunset_at)}
						</p>
					</div>
				</div>

				{#if selectedAgent.status === 'deprecated'}
					<form
						method="POST"
						action="?/tombstone"
						use:enhance={() => {
							actionLoading = true;
							actionError = null;
							return async ({ update }) => {
								actionLoading = false;
								await update();
							};
						}}
						class="flex gap-2 pt-2 border-t border-nanda-border"
					>
						<input type="hidden" name="agentId" value={selectedAgent.agent_id} />
						<button
							type="submit"
							class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
							disabled={actionLoading}
						>
							<Trash2 class="h-3.5 w-3.5" />
							{actionLoading ? 'Processing…' : 'Tombstone Now'}
						</button>
					</form>
				{/if}

				{#if actionError}
					<p class="text-xs text-red-400 mt-1">{actionError}</p>
				{/if}
			</div>
		</BaseWidget>
	{/if}
</div>
