<script lang="ts">
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import { ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { AdminAuditLogRecord } from '$lib/db/schema';

	const { data } = $props();
	const events = $derived<AdminAuditLogRecord[]>(data.events ?? []);
	const total = $derived<number>(data.total ?? 0);
	const limit = $derived<number>(data.limit ?? 50);
	const offset = $derived<number>(data.offset ?? 0);

	// svelte-ignore state_referenced_locally — initial snapshot; filters update via URL nav
	let eventType = $state<string>(data.eventType ?? '');
	// svelte-ignore state_referenced_locally
	let actorEmail = $state<string>(data.actorEmail ?? '');

	function buildUrl(newOffset: number) {
		const params = new URLSearchParams();
		if (eventType) params.set('eventType', eventType);
		if (actorEmail) params.set('actorEmail', actorEmail);
		params.set('limit', String(limit));
		params.set('offset', String(newOffset));
		return `?${params.toString()}`;
	}

	function fmt(ts: number) {
		return new Date(ts * 1000).toLocaleString();
	}

	let expandedId = $state<string | null>(null);
	function toggle(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function parseMeta(m: string | null) {
		if (!m) return null;
		try {
			return JSON.parse(m);
		} catch {
			return m;
		}
	}
</script>

<svelte:head><title>Audit Log — NANDA Admin</title></svelte:head>

<div class="p-4 space-y-4">
	<BaseWidget title="Filter">
		<form method="get" class="grid gap-3 sm:grid-cols-[2fr,2fr,auto]">
			<label class="block text-sm">
				<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Event Type</span>
				<input
					type="text"
					name="eventType"
					bind:value={eventType}
					placeholder="e.g. invitation.revoked"
					class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text font-mono text-xs"
				/>
			</label>
			<label class="block text-sm">
				<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Actor Email</span>
				<input
					type="text"
					name="actorEmail"
					bind:value={actorEmail}
					placeholder="owner@example.com"
					class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text font-mono text-xs"
				/>
			</label>
			<div class="flex items-end">
				<button
					type="submit"
					class="flex items-center gap-2 px-4 py-2 rounded-lg bg-nanda-primary-500 text-white text-sm font-medium hover:bg-nanda-primary-600"
				>
					<Search class="h-4 w-4" /> Filter
				</button>
			</div>
		</form>
	</BaseWidget>

	<BaseWidget title="Events ({total} total, showing {events.length})">
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="text-xs uppercase tracking-wide text-nanda-text-dim">
					<tr class="border-b border-nanda-border">
						<th class="text-left py-2 pr-3">When</th>
						<th class="text-left py-2 pr-3">Event</th>
						<th class="text-left py-2 pr-3">Actor</th>
						<th class="text-left py-2 pr-3">Target</th>
						<th class="text-left py-2">IP</th>
					</tr>
				</thead>
				<tbody>
					{#each events as ev (ev.id)}
						<tr
							onclick={() => toggle(ev.id)}
							class="border-b border-nanda-border/50 hover:bg-nanda-bg-elevated/40 cursor-pointer"
						>
							<td class="py-2 pr-3 text-nanda-text-muted text-xs whitespace-nowrap">
								{fmt(ev.createdAt)}
							</td>
							<td class="py-2 pr-3 font-mono text-xs text-nanda-text">{ev.eventType}</td>
							<td class="py-2 pr-3 text-nanda-text-muted text-xs">{ev.actorEmail ?? '—'}</td>
							<td class="py-2 pr-3 text-nanda-text-muted text-xs">
								{ev.targetType ?? '—'}{ev.targetId ? `/${ev.targetId}` : ''}
							</td>
							<td class="py-2 text-nanda-text-dim text-xs font-mono">{ev.ip ?? '—'}</td>
						</tr>
						{#if expandedId === ev.id && ev.metadata}
							<tr class="bg-nanda-bg-elevated/20">
								<td colspan="5" class="px-3 py-2">
									<pre
										class="text-[11px] text-nanda-text-muted whitespace-pre-wrap font-mono overflow-x-auto">{JSON.stringify(
											parseMeta(ev.metadata),
											null,
											2
										)}</pre>
								</td>
							</tr>
						{/if}
					{:else}
						<tr>
							<td colspan="5" class="py-8 text-center text-nanda-text-dim">
								<ScrollText class="h-5 w-5 inline mr-1" /> No audit events match these filters.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="flex items-center justify-between mt-3 text-xs text-nanda-text-muted">
			<span>
				Showing {offset + 1}–{Math.min(offset + events.length, total)} of {total}
			</span>
			<div class="flex gap-2">
				<a
					href={buildUrl(Math.max(0, offset - limit))}
					class="flex items-center gap-1 px-3 py-1 rounded border border-nanda-border hover:bg-nanda-bg-elevated"
					class:opacity-30={offset === 0}
					class:pointer-events-none={offset === 0}
				>
					<ChevronLeft class="h-3.5 w-3.5" /> Prev
				</a>
				<a
					href={buildUrl(offset + limit)}
					class="flex items-center gap-1 px-3 py-1 rounded border border-nanda-border hover:bg-nanda-bg-elevated"
					class:opacity-30={offset + limit >= total}
					class:pointer-events-none={offset + limit >= total}
				>
					Next <ChevronRight class="h-3.5 w-3.5" />
				</a>
			</div>
		</div>
	</BaseWidget>
</div>
