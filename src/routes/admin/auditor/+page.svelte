<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import AdminTabBar from '$lib/components/admin/AdminTabBar.svelte';
	import { Coins, DollarSign, ArrowLeftRight, Wallet, OctagonAlert } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import type {
		IntentItem,
		SettlementItem,
		ReconItem,
		WalletItem,
		AuditorStats
	} from '$lib/types/admin';

	const { data } = $props();

	const activeTab = $derived(data.tab || 'intents');

	const stats = $derived(data.stats as AuditorStats | null);

	function formatNP(amount: number): string {
		return amount.toLocaleString() + ' NP';
	}

	// Intents table
	const intentColumns = [
		{ key: 'intent_id', label: 'Intent ID', class: 'font-mono text-xs' },
		{ key: '_agents', label: 'Payer → Payee' },
		{ key: '_amount', label: 'Amount' },
		{ key: 'status', label: 'Status' },
		{ key: '_memo', label: 'Memo' },
		{ key: '_created', label: 'Created' },
		{ key: '_expires', label: 'Expires' }
	];

	const intentRows = $derived(
		((data.intents ?? []) as IntentItem[]).map((i) => ({
			...i,
			_agents: `${i.payer} → ${i.payee}`,
			_amount: formatNP(i.amount),
			_memo: i.memo ?? '—',
			_created: formatDate(i.created_at),
			_expires: formatDate(i.expires_at)
		}))
	);

	// Settlements table
	const settlementColumns = [
		{ key: 'settlement_id', label: 'Settlement ID', class: 'font-mono text-xs' },
		{ key: '_tx_hash', label: 'TX Hash', class: 'font-mono text-xs' },
		{ key: '_agents', label: 'From → To' },
		{ key: '_amount', label: 'Amount' },
		{ key: '_verified', label: 'Verified' },
		{ key: '_created', label: 'Created' }
	];

	const settlementRows = $derived(
		((data.settlements ?? []) as SettlementItem[]).map((s) => ({
			...s,
			_tx_hash: s.tx_hash.length > 16 ? s.tx_hash.slice(0, 16) + '…' : s.tx_hash,
			_agents: `${s.frm} → ${s.to_agent}`,
			_amount: formatNP(s.amount),
			_verified: s.verified ? '✓' : '✗',
			_created: formatDate(s.created_at)
		}))
	);

	// Reconciliations table
	const reconColumns = [
		{ key: 'recon_id', label: 'Recon ID', class: 'font-mono text-xs' },
		{ key: 'intent_id', label: 'Intent ID', class: 'font-mono text-xs' },
		{ key: 'verdict', label: 'Verdict' },
		{ key: '_delta', label: 'Delta' },
		{ key: '_latency', label: 'Latency' },
		{ key: '_created', label: 'Created' }
	];

	const reconRows = $derived(
		((data.reconciliations ?? []) as ReconItem[]).map((r) => ({
			...r,
			intent_id: r.intent_id ?? '—',
			_delta: r.delta != null ? formatNP(r.delta) : '—',
			_latency: r.latency_ms != null ? `${r.latency_ms}ms` : '—',
			_created: formatDate(r.created_at)
		}))
	);

	// Wallets table
	const walletColumns = [
		{ key: 'agent_name', label: 'Agent', class: 'font-mono text-xs' },
		{ key: '_balance', label: 'Balance' },
		{ key: 'currency', label: 'Currency' },
		{ key: '_updated', label: 'Last Updated' }
	];

	const walletRows = $derived(
		((data.wallets ?? []) as WalletItem[]).map((w) => ({
			...w,
			_balance: formatNP(w.balance_minor),
			_updated: formatDate(w.updated_at)
		}))
	);

	const tabs = [
		{ id: 'intents', label: 'Intents' },
		{ id: 'settlements', label: 'Settlements' },
		{ id: 'reconciliations', label: 'Reconciliations' },
		{ id: 'wallets', label: 'Wallets' }
	];
</script>

<svelte:head>
	<title>Auditor — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		<StatWidget label="Intents" value={stats?.total_intents ?? 0} icon={Coins} />
		<StatWidget label="Open" value={stats?.open_intents ?? 0} icon={DollarSign} />
		<StatWidget label="Settlements" value={stats?.total_settlements ?? 0} icon={ArrowLeftRight} />
		<StatWidget
			label="Total Balance"
			value={stats?.total_balance != null ? formatNP(stats.total_balance) : '—'}
			icon={Wallet}
		/>
		<StatWidget label="Mismatches" value={stats?.mismatches ?? 0} icon={OctagonAlert} />
	</div>

	<AdminTabBar {tabs} {activeTab} />

	{#if activeTab === 'intents'}
		<BaseWidget title="Audit Intents">
			<TableWidget columns={intentColumns} rows={intentRows} searchable pageSize={25} />
		</BaseWidget>
	{:else if activeTab === 'settlements'}
		<BaseWidget title="Audit Settlements">
			<TableWidget columns={settlementColumns} rows={settlementRows} searchable pageSize={25} />
		</BaseWidget>
	{:else if activeTab === 'reconciliations'}
		<BaseWidget title="Audit Reconciliations">
			<TableWidget columns={reconColumns} rows={reconRows} searchable pageSize={25} />
		</BaseWidget>
	{:else}
		<BaseWidget title="Agent Wallets">
			<TableWidget columns={walletColumns} rows={walletRows} searchable pageSize={25} />
		</BaseWidget>
	{/if}
</div>
