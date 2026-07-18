<script lang="ts">
	import type { PageData } from './$types';
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import { relativeTime } from '$lib/utils/date';

	const { data }: { data: PageData } = $props();

	const currencyColumns = [
		{ key: 'symbol', label: 'Symbol', class: 'font-mono font-semibold' },
		{ key: 'name', label: 'Name' },
		{ key: '_chain', label: 'Network' },
		{ key: 'decimals', label: 'Decimals' }
	];
	const currencyRows = $derived(data.currencies.map((c) => ({ ...c, _chain: c.chain ?? '—' })));

	const walletColumns = [
		{ key: 'agentId', label: 'Agent', class: 'font-mono text-xs' },
		{ key: 'currency', label: 'Currency', class: 'font-mono' },
		{ key: '_balance', label: 'Balance', class: 'text-right font-mono' }
	];
	const walletRows = $derived(
		data.topWallets.map((w) => ({ ...w, _balance: (w.balance ?? 0).toLocaleString() }))
	);

	const txColumns = [
		{ key: 'fromAgent', label: 'From', class: 'font-mono text-xs' },
		{ key: 'toAgent', label: 'To', class: 'font-mono text-xs' },
		{ key: 'amount', label: 'Amount', class: 'text-right font-mono' },
		{ key: '_date', label: 'Date' }
	];
	const txRows = $derived(
		data.recentTransactions.map((tx) => ({ ...tx, _date: relativeTime(tx.createdAt) }))
	);
</script>

<svelte:head>
	<title>Payments — Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- Stats -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<StatWidget label="Supported Currencies" value={data.currencies.length} />
		<StatWidget label="NP → USD Rate" value={data.config.npToUsdRate} />
		<StatWidget label="EUR → USD Rate" value={data.config.eurToUsdRate} />
	</div>

	<!-- Currencies -->
	<BaseWidget title="Supported Currencies">
		<TableWidget columns={currencyColumns} rows={currencyRows} pageSize={10} />
	</BaseWidget>

	<!-- Exchange Rates Matrix -->
	<BaseWidget title="Exchange Rates">
		<div class="overflow-x-auto">
			<table class="w-full text-center text-sm">
				<thead>
					<tr>
						<th class="px-3 py-2"></th>
						{#each Object.keys(data.rates) as code}
							<th class="px-3 py-2 font-mono text-xs text-nanda-text-muted">{code}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each Object.entries(data.rates) as [from, toRates]}
						<tr class="border-b border-nanda-border/30">
							<td class="px-3 py-2 font-mono text-xs font-semibold text-nanda-text">{from}</td>
							{#each Object.values(toRates as Record<string, number>) as rate}
								<td class="px-3 py-2 font-mono text-xs text-nanda-text-muted">
									{rate === 1 ? '—' : (rate as number).toFixed(6)}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</BaseWidget>

	<!-- Wallets -->
	<BaseWidget title="Top Wallet Balances">
		<TableWidget columns={walletColumns} rows={walletRows} searchable pageSize={15} />
	</BaseWidget>

	<!-- Transactions -->
	<BaseWidget title="Recent Transactions">
		<TableWidget columns={txColumns} rows={txRows} searchable pageSize={15} />
	</BaseWidget>
</div>
