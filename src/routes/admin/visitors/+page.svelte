<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import { Users, UserCheck, RotateCw, CalendarPlus } from 'lucide-svelte';
	import { relativeTime } from '$lib/utils/date';
	import type { VisitorItem, VisitorStats } from '$lib/types/admin';

	const { data } = $props();

	const stats = $derived(data.stats as VisitorStats | null);

	const tableColumns = [
		{ key: 'name', label: 'Name' },
		{ key: 'email', label: 'Email', class: 'font-mono text-xs' },
		{ key: 'status', label: 'Status' },
		{ key: 'source', label: 'Source' },
		{ key: 'visit_count', label: 'Visits' },
		{ key: '_first_visit', label: 'First Visit' },
		{ key: '_last_visit', label: 'Last Visit' }
	];

	const tableRows = $derived(
		((data.visitors ?? []) as VisitorItem[]).map((v) => ({
			...v,
			_first_visit: relativeTime(v.created_at),
			_last_visit: relativeTime(v.last_visited_at)
		}))
	);
</script>

<svelte:head>
	<title>Site Visitors — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- Header -->
	<div>
		<h2 class="text-lg font-bold text-nanda-text">Site Visitors</h2>
		<p class="text-xs text-nanda-text-muted">People who entered through the vault gate</p>
	</div>

	<!-- KPI Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<StatWidget label="Total Visitors" value={stats?.total ?? 0} icon={Users} />
		<StatWidget label="Active" value={stats?.active ?? 0} icon={UserCheck} />
		<StatWidget label="Repeat Visitors" value={stats?.repeat_visitors ?? 0} icon={RotateCw} />
		<StatWidget label="Today" value={stats?.today ?? 0} icon={CalendarPlus} />
	</div>

	<!-- Visitors Table -->
	<BaseWidget title="Vault Gate Visitors">
		<TableWidget columns={tableColumns} rows={tableRows} searchable pageSize={25} />
	</BaseWidget>
</div>
