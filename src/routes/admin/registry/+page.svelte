<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import { Bot, Globe, Users, Radio } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type { AgentItem, RegistryStats } from '$lib/types/admin';

	const { data } = $props();

	const stats = $derived(data.stats as RegistryStats | null);

	const tableColumns = [
		{ key: 'agent_id', label: 'Agent ID', class: 'font-mono text-xs' },
		{ key: 'agent_name', label: 'Name' },
		{ key: 'agent_url', label: 'URL', class: 'text-xs' },
		{ key: '_status', label: 'Status' },
		{ key: '_capabilities', label: 'Capabilities' },
		{ key: 'jurisdiction', label: 'Jurisdiction' },
		{ key: '_registered', label: 'Registered' }
	];

	const tableRows = $derived(
		((data.items ?? []) as AgentItem[]).map((item) => {
			let caps: string[] = [];
			try {
				caps = item.capabilities ? JSON.parse(item.capabilities) : [];
			} catch {
				/* ignore */
			}
			return {
				...item,
				agent_name: item.agent_name ?? '—',
				jurisdiction: item.jurisdiction ?? '—',
				_status: item.status,
				_capabilities: caps.length > 0 ? caps.join(', ') : '—',
				_registered: formatDate(item.registered_at)
			};
		})
	);

	let selectedAgent = $state<AgentItem | null>(null);

	function handleRowClick(row: Record<string, unknown>) {
		selectedAgent = (data.items as AgentItem[]).find((a) => a.agent_id === row.agent_id) ?? null;
	}
</script>

<svelte:head>
	<title>Registry — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- KPI Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<StatWidget label="Total Agents" value={stats?.total ?? 0} icon={Bot} />
		<StatWidget label="Alive" value={stats?.alive ?? 0} subtitle="responding" icon={Radio} />
		<StatWidget label="Federated" value={stats?.federated ?? 0} icon={Globe} />
		<StatWidget label="Clients" value={data.clients ?? 0} icon={Users} />
	</div>

	<!-- Agent Table -->
	<BaseWidget title="Registered Agents">
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
		<BaseWidget title="Agent Detail — {selectedAgent.agent_id}">
			<div class="space-y-3 text-sm">
				<div class="grid grid-cols-2 gap-x-6 gap-y-2">
					<div>
						<span class="text-nanda-text-dim text-xs">Agent URL</span>
						<p class="text-nanda-text font-mono text-xs break-all">{selectedAgent.agent_url}</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">API URL</span>
						<p class="text-nanda-text font-mono text-xs break-all">
							{selectedAgent.api_url ?? '—'}
						</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Source</span>
						<p class="text-nanda-text">{selectedAgent.source}</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Status</span>
						<p>
							<span class="env-badge {selectedAgent.status === 'alive' ? 'env-dev' : 'env-prod'}"
								>{selectedAgent.status}</span
							>
						</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Provider DID</span>
						<p class="text-nanda-text font-mono text-xs break-all">
							{selectedAgent.provider_did ?? '—'}
						</p>
					</div>
					<div>
						<span class="text-nanda-text-dim text-xs">Cert Level</span>
						<p class="text-nanda-text">{selectedAgent.cert_level ?? '—'}</p>
					</div>
				</div>
				{#if selectedAgent.capabilities}
					<div>
						<span class="text-nanda-text-dim text-xs">Capabilities</span>
						<div class="flex flex-wrap gap-1.5 mt-1">
							{#each (() => {
								try {
									return JSON.parse(selectedAgent?.capabilities ?? '[]');
								} catch {
									return [];
								}
							})() as cap}
								<span class="feat-tag">{cap}</span>
							{/each}
						</div>
					</div>
				{/if}
				{#if selectedAgent.tags}
					<div>
						<span class="text-nanda-text-dim text-xs">Tags</span>
						<div class="flex flex-wrap gap-1.5 mt-1">
							{#each (() => {
								try {
									return JSON.parse(selectedAgent?.tags ?? '[]');
								} catch {
									return [];
								}
							})() as tag}
								<span class="agent-tag">{tag}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</BaseWidget>
	{/if}
</div>
