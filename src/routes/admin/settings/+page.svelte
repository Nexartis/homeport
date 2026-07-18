<script lang="ts">
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import { Lock, Mail, Palette, ScrollText, UserCheck, UserX, Users, Clock } from 'lucide-svelte';

	const { data } = $props();
	const settings = $derived(data.settings);
	const counts = $derived(data.invitationCounts);
	const dbAvailable = $derived(data.dbAvailable);

	const authModeLabels: Record<string, string> = {
		solo: 'Solo (owner only)',
		invite: 'Invite-only',
		open: 'Open (any email)'
	};

	const subPages = [
		{
			href: '/admin/settings/auth',
			label: 'Authentication',
			icon: Lock,
			desc: 'Auth mode, default role, waitlist'
		},
		{
			href: '/admin/settings/invitations',
			label: 'Invitations',
			icon: Mail,
			desc: 'Manage the allowlist & resend emails'
		},
		{
			href: '/admin/settings/branding',
			label: 'Branding',
			icon: Palette,
			desc: 'Node name, welcome copy, brand colors'
		},
		{
			href: '/admin/settings/audit',
			label: 'Audit Log',
			icon: ScrollText,
			desc: 'Operator action history'
		}
	];
</script>

<svelte:head><title>Settings — NANDA Admin</title></svelte:head>

<div class="p-4 space-y-4">
	{#if !dbAvailable}
		<BaseWidget title="Database Status" collapsible={false}>
			<p class="text-sm text-red-400">
				Database binding not available — settings cannot be loaded.
			</p>
		</BaseWidget>
	{:else}
		<!-- KPI Stats -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<StatWidget
				label="Auth Mode"
				value={settings ? (authModeLabels[settings.authMode] ?? settings.authMode) : '—'}
				icon={Lock}
			/>
			<StatWidget
				label="Invited"
				value={counts?.invited ?? 0}
				subtitle="pending acceptance"
				icon={Mail}
			/>
			<StatWidget
				label="Accepted"
				value={counts?.accepted ?? 0}
				subtitle="active members"
				icon={UserCheck}
			/>
			<StatWidget label="Revoked" value={counts?.revoked ?? 0} icon={UserX} />
		</div>

		<BaseWidget title="Node Identity">
			<div class="grid gap-3 sm:grid-cols-2 text-sm">
				<div>
					<p class="text-xs text-nanda-text-dim uppercase tracking-wide">Node Name</p>
					<p class="text-nanda-text font-medium">{settings?.nodeName ?? '—'}</p>
				</div>
				<div>
					<p class="text-xs text-nanda-text-dim uppercase tracking-wide">Owner Email</p>
					<p class="text-nanda-text font-mono text-xs">{settings?.ownerEmail ?? '—'}</p>
				</div>
				<div>
					<p class="text-xs text-nanda-text-dim uppercase tracking-wide">Support Email</p>
					<p class="text-nanda-text font-mono text-xs">{settings?.supportEmail ?? '—'}</p>
				</div>
				<div>
					<p class="text-xs text-nanda-text-dim uppercase tracking-wide">Default Role</p>
					<p class="text-nanda-text">{settings?.defaultRole ?? '—'}</p>
				</div>
				{#if settings?.waitlistEnabled}
					<div class="sm:col-span-2 flex items-center gap-2 text-xs text-nanda-text-muted">
						<Users class="h-3.5 w-3.5" />
						Waitlist is enabled — unknown emails are queued instead of rejected.
					</div>
				{/if}
			</div>
		</BaseWidget>

		<BaseWidget title="Configure">
			<div class="grid gap-3 sm:grid-cols-2">
				{#each subPages as page (page.href)}
					<a
						href={page.href}
						class="flex items-start gap-3 p-3 rounded-lg border border-nanda-border bg-nanda-bg-elevated/40 hover:border-nanda-border-hover hover:bg-nanda-bg-elevated transition-colors"
					>
						<div
							class="flex h-9 w-9 items-center justify-center rounded-lg bg-nanda-primary-500/10"
						>
							<page.icon class="h-4.5 w-4.5 text-nanda-primary-400" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-nanda-text">{page.label}</p>
							<p class="text-xs text-nanda-text-muted mt-0.5">{page.desc}</p>
						</div>
					</a>
				{/each}
			</div>
		</BaseWidget>

		<p class="flex items-center gap-1.5 text-[11px] text-nanda-text-dim">
			<Clock class="h-3 w-3" />
			Settings last updated
			{settings ? new Date(settings.updatedAt * 1000).toLocaleString() : '—'}
		</p>
	{/if}
</div>
