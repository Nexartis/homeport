<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import AdminTabBar from '$lib/components/admin/AdminTabBar.svelte';
	import { Eye, TriangleAlert, Activity, Radar, Star } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type { TelItem, ProbeItem, RepItem, ObserverStats } from '$lib/types/admin';

	const { data } = $props();

	const activeTab = $derived(data.tab || 'telemetry');

	const stats = $derived(data.stats as ObserverStats | null);

	// Telemetry table
	const telColumns = [
		{ key: 'id', label: 'ID', class: 'font-mono text-xs' },
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: '_latency', label: 'Latency' },
		{ key: '_success', label: 'Success' },
		{ key: 'status_code', label: 'Status' },
		{ key: '_fraud', label: 'Fraud' },
		{ key: '_created', label: 'Created' }
	];

	const telRows = $derived(
		((data.telemetry ?? []) as TelItem[]).map((t) => ({
			...t,
			_latency: t.latency_ms != null ? `${t.latency_ms}ms` : '—',
			_success: t.success ? '✓' : '✗',
			status_code: t.status_code ?? '—',
			_fraud: t.fraud_flag ? '⚠️' : '—',
			_created: formatDate(t.created_at)
		}))
	);

	// Probes table
	const probeColumns = [
		{ key: 'id', label: 'ID', class: 'font-mono text-xs' },
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'endpoint', label: 'Endpoint' },
		{ key: 'capability', label: 'Capability' },
		{ key: '_sent', label: 'Sent' },
		{ key: '_success', label: 'Success' },
		{ key: '_p95', label: 'P95 Latency' },
		{ key: '_created', label: 'Created' }
	];

	const probeRows = $derived(
		((data.probes ?? []) as ProbeItem[]).map((p) => ({
			...p,
			endpoint: p.endpoint ?? '—',
			capability: p.capability ?? '—',
			_sent: p.probes_sent ?? '—',
			_success: p.success_count ?? '—',
			_p95: p.p95_latency_ms != null ? `${p.p95_latency_ms}ms` : '—',
			_created: formatDate(p.created_at)
		}))
	);

	// Reputation table
	const repColumns = [
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: '_availability', label: 'Availability' },
		{ key: '_error_rate', label: 'Error Rate' },
		{ key: '_fraud_rate', label: 'Fraud Rate' },
		{ key: '_p95', label: 'P95 Latency' },
		{ key: '_reputation', label: 'Reputation' }
	];

	const repRows = $derived(
		((data.reputation ?? []) as RepItem[]).map((r) => ({
			...r,
			_availability: r.availability != null ? `${(r.availability * 100).toFixed(1)}%` : '—',
			_error_rate: r.error_rate != null ? `${(r.error_rate * 100).toFixed(1)}%` : '—',
			_fraud_rate: r.fraud_rate != null ? `${(r.fraud_rate * 100).toFixed(1)}%` : '—',
			_p95: r.p95_latency_ms != null ? `${r.p95_latency_ms}ms` : '—',
			_reputation: r.reputation != null ? r.reputation.toFixed(3) : '—'
		}))
	);

	const tabs = [
		{ id: 'telemetry', label: 'Telemetry' },
		{ id: 'probes', label: 'Probes' },
		{ id: 'reputation', label: 'Reputation' }
	];
</script>

<svelte:head>
	<title>Observer — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		<StatWidget label="Total Events" value={stats?.total_events ?? 0} icon={Eye} />
		<StatWidget label="Errors" value={stats?.errors ?? 0} icon={TriangleAlert} />
		<StatWidget label="Fraud Flags" value={stats?.fraud ?? 0} icon={Activity} />
		<StatWidget label="Probes" value={stats?.total_probes ?? 0} icon={Radar} />
		<StatWidget
			label="Avg Reputation"
			value={stats?.avg_reputation != null ? stats.avg_reputation.toFixed(3) : '—'}
			icon={Star}
		/>
	</div>

	<AdminTabBar {tabs} {activeTab} />

	{#if activeTab === 'telemetry'}
		<BaseWidget title="Telemetry Events">
			<TableWidget columns={telColumns} rows={telRows} searchable pageSize={25} />
		</BaseWidget>
	{:else if activeTab === 'probes'}
		<BaseWidget title="Probe Runs">
			<TableWidget columns={probeColumns} rows={probeRows} searchable pageSize={25} />
		</BaseWidget>
	{:else}
		<BaseWidget title="Agent Reputation (Latest Snapshot)">
			<TableWidget columns={repColumns} rows={repRows} searchable pageSize={25} />
		</BaseWidget>
	{/if}
</div>
