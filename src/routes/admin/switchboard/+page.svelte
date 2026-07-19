<script lang="ts">
	import type { PageData } from './$types';
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import { Radar, Search, LoaderCircle } from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { relativeTime } from '$lib/utils/date';

	const { data }: { data: PageData } = $props();
	let discoverUrl = $state('');
	let discovering = $state(false);
	let discoverResult = $state<Record<string, unknown> | null>(null);
	let discoverError = $state('');

	async function handleDiscover() {
		if (!discoverUrl.trim()) return;
		discovering = true;
		discoverError = '';
		discoverResult = null;

		try {
			const res = await fetch('/api/switchboard/discover', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: discoverUrl })
			});
			const result = (await res.json()) as Record<string, unknown>;
			if (!res.ok) {
				discoverError = (result.error as string) ?? 'Discovery failed';
			} else {
				discoverResult = result;
				await invalidateAll();
			}
		} catch (e) {
			discoverError = e instanceof Error ? e.message : 'Network error';
		} finally {
			discovering = false;
		}
	}

	const adapterColumns = [
		{ key: 'agentId', label: 'Agent ID', class: 'font-mono text-xs' },
		{ key: '_protocol', label: 'Protocol' },
		{ key: '_detected', label: 'Detected' },
		{ key: '_synced', label: 'Last Synced' }
	];

	const adapterRows = $derived(
		data.adapters.map((a) => ({
			...a,
			_protocol: a.protocol,
			_detected: relativeTime(a.detectedAt),
			_synced: relativeTime(a.lastSyncedAt)
		}))
	);

	const protocolSummary = $derived(
		data.protocolCounts
			.map((p: { protocol: string; count: number }) => `${p.protocol} (${p.count})`)
			.join(', ') || 'None'
	);
</script>

<svelte:head>
	<title>Switchboard — Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- Stats -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<StatWidget label="Total Adapters" value={data.stats?.totalAdapters ?? 0} />
		<StatWidget label="Unique Agents" value={data.stats?.uniqueAgents ?? 0} />
		<StatWidget label="Protocols" value={protocolSummary} />
	</div>

	<!-- Discover Form -->
	<BaseWidget title="Discover Agent" collapsible={false}>
		<p class="text-xs text-nanda-text-muted mb-3">
			Probe a URL for supported protocols (A2A, MCP, NLWeb, NANDA) and auto-register adapters.
		</p>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleDiscover();
			}}
			class="flex gap-3"
		>
			<div
				class="flex flex-1 items-center gap-2 border border-nanda-border rounded-lg bg-nanda-bg-elevated px-3 py-1.5"
			>
				<Search class="h-3.5 w-3.5 text-nanda-text-dim flex-shrink-0" />
				<input
					type="url"
					bind:value={discoverUrl}
					placeholder="https://agent.example.com"
					required
					class="flex-1 bg-transparent text-sm text-nanda-text placeholder:text-nanda-text-dim outline-none"
				/>
			</div>
			<button
				type="submit"
				disabled={discovering}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-nanda-primary-500 hover:bg-nanda-primary-600 text-white transition-colors disabled:opacity-50"
			>
				{#if discovering}
					<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
					Probing…
				{:else}
					<Radar class="h-3.5 w-3.5" />
					Discover
				{/if}
			</button>
		</form>

		{#if discoverError}
			<div class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
				{discoverError}
			</div>
		{/if}

		{#if discoverResult}
			<div class="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 overflow-x-auto">
				<pre class="text-xs text-green-400 font-mono">{JSON.stringify(
						discoverResult,
						null,
						2
					)}</pre>
			</div>
		{/if}
	</BaseWidget>

	<!-- Adapters Table -->
	<BaseWidget title="Registered Adapters">
		<TableWidget columns={adapterColumns} rows={adapterRows} searchable pageSize={15} />
	</BaseWidget>
</div>
