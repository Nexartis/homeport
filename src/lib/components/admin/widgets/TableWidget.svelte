<script lang="ts">
	import { Search, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Column {
		key: string;
		label: string;
		class?: string;
	}

	const {
		columns,
		rows,
		searchable = false,
		pageSize = 10,
		onRowClick,
		class: className = ''
	}: {
		columns: Column[];
		rows: Record<string, unknown>[];
		searchable?: boolean;
		pageSize?: number;
		onRowClick?: (row: Record<string, unknown>) => void;
		class?: string;
	} = $props();

	let searchQuery = $state('');
	let currentPage = $state(0);

	const filteredRows = $derived(
		searchQuery.trim() === ''
			? rows
			: rows.filter((row) =>
					columns.some((col) =>
						String(row[col.key] ?? '')
							.toLowerCase()
							.includes(searchQuery.toLowerCase())
					)
				)
	);

	const totalPages = $derived(Math.max(1, Math.ceil(filteredRows.length / pageSize)));
	const paginatedRows = $derived(
		filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
	);

	function goToPage(p: number) {
		currentPage = Math.max(0, Math.min(p, totalPages - 1));
	}
</script>

<div class={className}>
	{#if searchable}
		<div
			class="flex items-center gap-2 mb-3 border border-nanda-border rounded-lg bg-nanda-bg-elevated px-3 py-1.5"
		>
			<Search class="h-3.5 w-3.5 text-nanda-text-dim" />
			<input
				type="text"
				placeholder="Search…"
				bind:value={searchQuery}
				oninput={() => (currentPage = 0)}
				class="flex-1 bg-transparent text-sm text-nanda-text placeholder:text-nanda-text-dim outline-none"
			/>
		</div>
	{/if}

	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-nanda-border">
					{#each columns as col (col.key)}
						<th
							class="text-left px-3 py-2 text-xs font-medium text-nanda-text-dim uppercase tracking-wider {col.class ??
								''}">{col.label}</th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each paginatedRows as row, i (i)}
					<tr
						class="border-b border-nanda-border/40 hover:bg-nanda-bg-elevated transition-colors {onRowClick
							? 'cursor-pointer'
							: ''}"
						onclick={() => onRowClick?.(row)}
					>
						{#each columns as col (col.key)}
							<td class="px-3 py-2 text-nanda-text-muted {col.class ?? ''}"
								>{row[col.key] ?? '—'}</td
							>
						{/each}
					</tr>
				{/each}
				{#if paginatedRows.length === 0}
					<tr>
						<td colspan={columns.length} class="px-3 py-6 text-center text-nanda-text-dim text-sm">
							No data
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	{#if totalPages > 1}
		<div class="flex items-center justify-between mt-3 text-xs text-nanda-text-dim">
			<span>{filteredRows.length} rows · Page {currentPage + 1} of {totalPages}</span>
			<div class="flex items-center gap-1">
				<button
					class="p-1 rounded hover:bg-nanda-bg-elevated disabled:opacity-30 transition-colors"
					disabled={currentPage === 0}
					onclick={() => goToPage(currentPage - 1)}
					aria-label="Previous page"
				>
					<ChevronLeft class="h-4 w-4" />
				</button>
				<button
					class="p-1 rounded hover:bg-nanda-bg-elevated disabled:opacity-30 transition-colors"
					disabled={currentPage >= totalPages - 1}
					onclick={() => goToPage(currentPage + 1)}
					aria-label="Next page"
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}
</div>
