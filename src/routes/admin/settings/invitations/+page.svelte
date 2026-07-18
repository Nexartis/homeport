<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import { Mail, RotateCw, Ban, Trash2, CircleAlert, CircleCheck, Plus } from 'lucide-svelte';
	import type { InvitationRecord } from '$lib/db/schema';

	const { data } = $props();
	const invitations = $derived<InvitationRecord[]>(data.invitations ?? []);

	let statusFilter = $state<string>('all');
	const filtered = $derived(
		statusFilter === 'all' ? invitations : invitations.filter((i) => i.status === statusFilter)
	);

	const statusChips: { value: string; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'invited', label: 'Invited' },
		{ value: 'waitlisted', label: 'Waitlisted' },
		{ value: 'accepted', label: 'Accepted' },
		{ value: 'revoked', label: 'Revoked' },
		{ value: 'expired', label: 'Expired' }
	];

	// Create form state
	let newEmail = $state('');
	let newRole = $state<'developer' | 'viewer' | 'admin'>('developer');
	let newNote = $state('');
	let skipEmail = $state(false);
	let creating = $state(false);
	let toast = $state<{ kind: 'success' | 'error'; text: string } | null>(null);
	let busyId = $state<string | null>(null);

	function setToast(kind: 'success' | 'error', text: string) {
		toast = { kind, text };
		setTimeout(() => {
			if (toast?.text === text) toast = null;
		}, 4000);
	}

	async function create() {
		if (!newEmail.includes('@')) {
			setToast('error', 'Enter a valid email');
			return;
		}
		creating = true;
		try {
			const res = await fetch('/api/admin/invitations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: newEmail,
					role: newRole,
					note: newNote || undefined,
					skipEmail
				})
			});
			const body = (await res.json()) as {
				error?: string;
				emailSent?: boolean;
				emailError?: string;
				existingId?: string;
			};
			if (!res.ok) {
				setToast('error', body.error ?? `HTTP ${res.status}`);
			} else {
				setToast(
					'success',
					body.emailSent
						? 'Invitation sent'
						: `Invitation created${body.emailError ? ` (email failed: ${body.emailError})` : ' (email skipped)'}`
				);
				newEmail = '';
				newNote = '';
				skipEmail = false;
				await invalidateAll();
			}
		} catch (err) {
			setToast('error', err instanceof Error ? err.message : String(err));
		} finally {
			creating = false;
		}
	}

	async function act(id: string, action: 'resend' | 'revoke' | 'delete') {
		busyId = id;
		try {
			const method = action === 'delete' ? 'DELETE' : 'POST';
			const url =
				action === 'delete'
					? `/api/admin/invitations/${id}`
					: `/api/admin/invitations/${id}/${action}`;
			const res = await fetch(url, { method });
			const body = (await res.json()) as { error?: string };
			if (!res.ok) setToast('error', body.error ?? `HTTP ${res.status}`);
			else {
				setToast('success', `Invitation ${action}d`);
				await invalidateAll();
			}
		} catch (err) {
			setToast('error', err instanceof Error ? err.message : String(err));
		} finally {
			busyId = null;
		}
	}

	function fmtTs(ts: number | null | undefined) {
		return ts ? new Date(ts * 1000).toLocaleString() : '—';
	}
</script>

<svelte:head><title>Invitations — NANDA Admin</title></svelte:head>

<div class="p-4 space-y-4">
	{#if toast}
		<div
			class="flex items-center gap-2 p-3 rounded-lg text-sm"
			class:bg-green-500={toast.kind === 'success'}
			class:bg-red-500={toast.kind === 'error'}
		>
			{#if toast.kind === 'success'}<CircleCheck class="h-4 w-4" />{:else}<CircleAlert
					class="h-4 w-4"
				/>{/if}
			<span class="text-white">{toast.text}</span>
		</div>
	{/if}

	<BaseWidget title="Invite someone">
		<div class="grid gap-3 sm:grid-cols-[2fr,1fr,auto]">
			<input
				type="email"
				bind:value={newEmail}
				placeholder="person@example.com"
				class="px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-sm text-nanda-text"
			/>
			<select
				bind:value={newRole}
				class="px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-sm text-nanda-text"
			>
				<option value="developer">Developer</option>
				<option value="viewer">Viewer</option>
				<option value="admin">Admin</option>
			</select>
			<button
				type="button"
				onclick={create}
				disabled={creating}
				class="flex items-center gap-2 px-4 py-2 rounded-lg bg-nanda-primary-500 text-white text-sm font-medium hover:bg-nanda-primary-600 disabled:opacity-50"
			>
				<Plus class="h-4 w-4" />
				{creating ? 'Sending…' : 'Send Invite'}
			</button>
			<input
				type="text"
				bind:value={newNote}
				placeholder="Optional note (shown in the list)"
				class="sm:col-span-2 px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-sm text-nanda-text"
			/>
			<label class="flex items-center gap-2 text-xs text-nanda-text-muted">
				<input type="checkbox" bind:checked={skipEmail} class="accent-nanda-primary-500" />
				Skip email (copy link manually)
			</label>
		</div>
	</BaseWidget>

	<div class="flex flex-wrap gap-2">
		{#each statusChips as chip (chip.value)}
			<button
				type="button"
				onclick={() => (statusFilter = chip.value)}
				class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
				class:border-nanda-primary-500={statusFilter === chip.value}
				class:text-nanda-primary-400={statusFilter === chip.value}
				class:border-nanda-border={statusFilter !== chip.value}
				class:text-nanda-text-muted={statusFilter !== chip.value}
			>
				{chip.label}
			</button>
		{/each}
	</div>

	<BaseWidget title="Invitations ({filtered.length})">
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="text-xs uppercase tracking-wide text-nanda-text-dim">
					<tr class="border-b border-nanda-border">
						<th class="text-left py-2 pr-3">Email</th>
						<th class="text-left py-2 pr-3">Role</th>
						<th class="text-left py-2 pr-3">Status</th>
						<th class="text-left py-2 pr-3">Invited By</th>
						<th class="text-left py-2 pr-3">Last Sent</th>
						<th class="text-right py-2">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as inv (inv.id)}
						<tr class="border-b border-nanda-border/50 hover:bg-nanda-bg-elevated/40">
							<td class="py-2 pr-3 text-nanda-text font-mono text-xs">{inv.email}</td>
							<td class="py-2 pr-3 text-nanda-text">{inv.role}</td>
							<td class="py-2 pr-3">
								<span
									class="px-2 py-0.5 rounded-full text-[10px] uppercase border border-nanda-border text-nanda-text-muted"
								>
									{inv.status}
								</span>
							</td>
							<td class="py-2 pr-3 text-nanda-text-muted text-xs">{inv.invitedByEmail ?? '—'}</td>
							<td class="py-2 pr-3 text-nanda-text-muted text-xs">{fmtTs(inv.lastSentAt)}</td>
							<td class="py-2 text-right">
								<div class="inline-flex gap-1">
									<button
										type="button"
										onclick={() => act(inv.id, 'resend')}
										disabled={busyId === inv.id ||
											inv.status === 'accepted' ||
											inv.status === 'revoked'}
										title="Resend"
										class="p-1.5 rounded hover:bg-nanda-bg-elevated disabled:opacity-30"
									>
										<RotateCw class="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										onclick={() => act(inv.id, 'revoke')}
										disabled={busyId === inv.id ||
											inv.status === 'revoked' ||
											inv.status === 'accepted'}
										title="Revoke"
										class="p-1.5 rounded hover:bg-nanda-bg-elevated disabled:opacity-30"
									>
										<Ban class="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										onclick={() => act(inv.id, 'delete')}
										disabled={busyId === inv.id}
										title="Delete"
										class="p-1.5 rounded hover:bg-red-500/10 text-red-400 disabled:opacity-30"
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="py-8 text-center text-nanda-text-dim">
								<Mail class="h-5 w-5 inline mr-1" /> No invitations match this filter.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</BaseWidget>
</div>
