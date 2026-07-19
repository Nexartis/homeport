<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import AdminTabBar from '$lib/components/admin/AdminTabBar.svelte';
	import { ShieldCheck, Clock, Play, Award, Ban } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type { JobItem, CertItem, RevocItem, CertifierStats } from '$lib/types/admin';

	const { data } = $props();

	const activeTab = $derived(data.tab || 'jobs');

	const stats = $derived(data.stats as CertifierStats | null);

	// Jobs table
	const jobColumns = [
		{ key: 'job_id', label: 'Job ID', class: 'font-mono text-xs' },
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'capability', label: 'Capability' },
		{ key: '_status', label: 'Status' },
		{ key: '_progress', label: 'Progress' },
		{ key: '_score', label: 'Score' },
		{ key: 'grade', label: 'Grade' },
		{ key: '_created', label: 'Created' }
	];

	const jobRows = $derived(
		((data.jobs ?? []) as JobItem[]).map((j) => ({
			...j,
			grade: j.grade ?? '—',
			_status: j.status,
			_progress: `${j.completed_trials}/${j.num_trials}`,
			_score: j.score != null ? j.score.toFixed(2) : '—',
			_created: formatDate(j.created_at)
		}))
	);

	// Certificates table
	const certColumns = [
		{ key: 'cert_id', label: 'Cert ID', class: 'font-mono text-xs' },
		{ key: 'agent_id', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'capability', label: 'Capability' },
		{ key: '_score', label: 'Score' },
		{ key: 'grade', label: 'Grade' },
		{ key: '_ci', label: 'CI 95%' },
		{ key: '_issued', label: 'Issued' },
		{ key: '_expires', label: 'Expires' },
		{ key: '_revoked', label: 'Revoked' }
	];

	const certRows = $derived(
		((data.certificates ?? []) as CertItem[]).map((c) => ({
			...c,
			_score: c.score.toFixed(2),
			_ci:
				c.ci95_lo != null && c.ci95_hi != null
					? `[${c.ci95_lo.toFixed(2)}, ${c.ci95_hi.toFixed(2)}]`
					: '—',
			_issued: formatDate(c.issued_at),
			_expires: c.expires_at ? formatDate(c.expires_at) : 'Never',
			_revoked: c.revoked_at ? '⛔ ' + (c.revocation_reason ?? 'Yes') : '—'
		}))
	);

	// Revocations table
	const revocColumns = [
		{ key: 'cert_id', label: 'Cert ID', class: 'font-mono text-xs' },
		{ key: 'reason', label: 'Reason' },
		{ key: 'status_list_index', label: 'Status Index' },
		{ key: '_revoked_at', label: 'Revoked At' }
	];

	const revocRows = $derived(
		((data.revocations ?? []) as RevocItem[]).map((r) => ({
			...r,
			status_list_index: r.status_list_index ?? '—',
			_revoked_at: formatDate(r.revoked_at)
		}))
	);

	const tabs = [
		{ id: 'jobs', label: 'Cert Jobs' },
		{ id: 'certificates', label: 'Certificates' },
		{ id: 'revocations', label: 'Revocations' }
	];
</script>

<svelte:head>
	<title>Certifier — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		<StatWidget label="Total Jobs" value={stats?.total_jobs ?? 0} icon={ShieldCheck} />
		<StatWidget label="Pending" value={stats?.pending ?? 0} icon={Clock} />
		<StatWidget label="Running" value={stats?.running ?? 0} icon={Play} />
		<StatWidget label="Active Certs" value={stats?.active_certs ?? 0} icon={Award} />
		<StatWidget label="Revoked" value={stats?.revoked ?? 0} icon={Ban} />
	</div>

	<!-- Tabs -->
	<AdminTabBar {tabs} {activeTab} />

	{#if activeTab === 'jobs'}
		<BaseWidget title="Certification Jobs">
			<TableWidget columns={jobColumns} rows={jobRows} searchable pageSize={25} />
		</BaseWidget>
	{:else if activeTab === 'certificates'}
		<BaseWidget title="Issued Certificates">
			<TableWidget columns={certColumns} rows={certRows} searchable pageSize={25} />
		</BaseWidget>
	{:else}
		<BaseWidget title="Certificate Revocations">
			<TableWidget columns={revocColumns} rows={revocRows} searchable pageSize={25} />
		</BaseWidget>
	{/if}
</div>
