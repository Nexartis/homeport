<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import AdminTabBar from '$lib/components/admin/AdminTabBar.svelte';
	import { Activity, ChartBar, ShieldCheck, TrendingUp, Users } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type { MetricItem, ScanItem, AnalyticsStats } from '$lib/types/admin';

	const { data } = $props();

	const activeTab = $derived(data.tab || 'metrics');

	const stats = $derived(data.stats as AnalyticsStats | null);

	// Metrics table
	const metricsColumns = [
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'period_type', label: 'Period' },
		{ key: '_uptime', label: 'Uptime' },
		{ key: '_success_rate', label: 'Success Rate' },
		{ key: '_avg_latency', label: 'Avg Latency' },
		{ key: '_reputation', label: 'Reputation' },
		{ key: 'badge_tier', label: 'Badge' },
		{ key: '_computed', label: 'Computed' }
	];

	const metricsRows = $derived(
		((data.metrics ?? []) as MetricItem[]).map((m) => ({
			...m,
			_uptime: m.uptime_pct != null ? `${(m.uptime_pct * 100).toFixed(1)}%` : '—',
			_success_rate: m.success_rate != null ? `${(m.success_rate * 100).toFixed(1)}%` : '—',
			_avg_latency: m.avg_response_ms != null ? `${m.avg_response_ms.toFixed(0)}ms` : '—',
			_reputation: m.reputation_score != null ? m.reputation_score.toFixed(3) : '—',
			badge_tier: m.badge_tier ?? '—',
			_computed: formatDate(m.computed_at)
		}))
	);

	// Scans table
	const scansColumns = [
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'policy_id', label: 'Policy', class: 'font-mono text-xs' },
		{ key: 'decision', label: 'Decision' },
		{ key: 'scan_type', label: 'Type' },
		{ key: '_created', label: 'Created' }
	];

	const scansRows = $derived(
		((data.scans ?? []) as ScanItem[]).map((s) => ({
			...s,
			_created: formatDate(s.created_at)
		}))
	);

	const tabs = [
		{ id: 'metrics', label: 'Behavior Metrics' },
		{ id: 'scans', label: 'Compliance Scans' }
	];
</script>

<svelte:head>
	<title>Analytics — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		<StatWidget label="Total Metrics" value={stats?.total_metrics ?? 0} icon={ChartBar} />
		<StatWidget label="Total Scans" value={stats?.total_scans ?? 0} icon={ShieldCheck} />
		<StatWidget label="Agents Tracked" value={stats?.agents_tracked ?? 0} icon={Users} />
		<StatWidget
			label="Avg Uptime"
			value={stats?.avg_uptime != null ? `${(stats.avg_uptime * 100).toFixed(1)}%` : '—'}
			icon={Activity}
		/>
		<StatWidget
			label="Avg Reputation"
			value={stats?.avg_reputation != null ? stats.avg_reputation.toFixed(3) : '—'}
			icon={TrendingUp}
		/>
	</div>

	<AdminTabBar {tabs} {activeTab} />

	{#if activeTab === 'metrics'}
		<BaseWidget title="Agent Behavior Metrics">
			<TableWidget columns={metricsColumns} rows={metricsRows} searchable pageSize={25} />
		</BaseWidget>
	{:else}
		<BaseWidget title="Compliance Scan Runs">
			<TableWidget columns={scansColumns} rows={scansRows} searchable pageSize={25} />
		</BaseWidget>
	{/if}
</div>
