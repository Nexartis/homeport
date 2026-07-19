<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import AdminTabBar from '$lib/components/admin/AdminTabBar.svelte';
	import { Scale, FileCheck, ShieldOff, CircleCheck, CircleX } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type { PolicyItem, DecisionItem, ViolationItem, ComplianceStats } from '$lib/types/admin';

	const { data } = $props();

	const activeTab = $derived(data.tab || 'decisions');

	const stats = $derived(data.stats as ComplianceStats | null);

	// Policies table
	const policyColumns = [
		{ key: 'policy_id', label: 'Policy ID', class: 'font-mono text-xs' },
		{ key: 'version', label: 'Version' },
		{ key: '_created', label: 'Created' },
		{ key: '_updated', label: 'Updated' }
	];

	const policyRows = $derived(
		((data.policies ?? []) as PolicyItem[]).map((p) => ({
			...p,
			_created: formatDate(p.created_at),
			_updated: formatDate(p.updated_at)
		}))
	);

	// Decisions table
	const decisionColumns = [
		{ key: 'decision_id', label: 'Decision ID', class: 'font-mono text-xs' },
		{ key: '_agents', label: 'From → To' },
		{ key: 'capability', label: 'Capability' },
		{ key: 'decision', label: 'Decision' },
		{ key: '_created', label: 'Created' }
	];

	const decisionRows = $derived(
		((data.decisions ?? []) as DecisionItem[]).map((d) => ({
			...d,
			_agents: `${d.from_agent ?? '?'} → ${d.to_agent ?? '?'}`,
			capability: d.capability ?? '—',
			_created: formatDate(d.created_at)
		}))
	);

	// Violations table
	const violationColumns = [
		{ key: 'violation_id', label: 'Violation ID', class: 'font-mono text-xs' },
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'reason', label: 'Reason' },
		{ key: '_created', label: 'Created' }
	];

	const violationRows = $derived(
		((data.violations ?? []) as ViolationItem[]).map((v) => ({
			...v,
			_created: formatDate(v.created_at)
		}))
	);

	const tabs = [
		{ id: 'decisions', label: 'Decisions' },
		{ id: 'policies', label: 'Policies' },
		{ id: 'violations', label: 'Violations' }
	];
</script>

<svelte:head>
	<title>Compliance — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		<StatWidget label="Policies" value={stats?.total_policies ?? 0} icon={Scale} />
		<StatWidget label="Decisions" value={stats?.total_decisions ?? 0} icon={FileCheck} />
		<StatWidget label="Allowed" value={stats?.allowed ?? 0} icon={CircleCheck} />
		<StatWidget label="Denied" value={stats?.denied ?? 0} icon={CircleX} />
		<StatWidget label="Violations" value={stats?.total_violations ?? 0} icon={ShieldOff} />
	</div>

	<AdminTabBar {tabs} {activeTab} />

	{#if activeTab === 'decisions'}
		<BaseWidget title="Compliance Decisions">
			<TableWidget columns={decisionColumns} rows={decisionRows} searchable pageSize={25} />
		</BaseWidget>
	{:else if activeTab === 'policies'}
		<BaseWidget title="Compliance Policies">
			<TableWidget columns={policyColumns} rows={policyRows} searchable pageSize={25} />
		</BaseWidget>
	{:else}
		<BaseWidget title="Compliance Violations">
			<TableWidget columns={violationColumns} rows={violationRows} searchable pageSize={25} />
		</BaseWidget>
	{/if}
</div>
