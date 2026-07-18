<script lang="ts">
	import { page } from '$app/state';
	import { PanelLeftClose, PanelLeftOpen, Command, ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import CommandPalette from '$lib/components/admin/CommandPalette.svelte';
	import { adminNavItems, getGroupedNavItems, isActiveRoute } from '$lib/config/nav';
	import type { AdminStats } from './+layout.server';
	import { browser } from '$app/environment';

	const {
		data,
		children
	}: {
		data: { stats?: AdminStats; user?: { email?: string }; currentPath?: string };
		children: Snippet;
	} = $props();

	let leftCollapsed = $state(false);

	let commandPaletteOpen = $state(false);
	let mobileNavOpen = $state(false);

	const navGroups = getGroupedNavItems();

	// Collapsed groups state with localStorage persistence
	const STORAGE_KEY = 'nnn-admin-nav-collapsed';
	const collapsedGroups = $state<Record<string, boolean>>(
		browser
			? (() => {
					try {
						const stored = localStorage.getItem(STORAGE_KEY);
						return stored ? JSON.parse(stored) : {};
					} catch {
						return {};
					}
				})()
			: {}
	);

	function toggleGroup(groupId: string) {
		collapsedGroups[groupId] = !collapsedGroups[groupId];
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
			} catch {}
		}
	}

	/** Check if a group has any active item */
	function groupHasActive(groupId: string): boolean {
		return (
			navGroups.find((g) => g.id === groupId)?.items.some((item) => isActive(item.href)) ?? false
		);
	}

	function isActive(href: string): boolean {
		return isActiveRoute(page.url.pathname, href);
	}

	const activeLabel = $derived(adminNavItems.find((n) => isActive(n.href))?.label ?? 'Dashboard');

	const stats = $derived(data.stats);

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			commandPaletteOpen = !commandPaletteOpen;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile nav bar (visible < md) -->
<div
	class="md:hidden flex items-center justify-between border-b border-nanda-border bg-nanda-bg-surface px-4 py-2"
>
	<button
		class="text-nanda-text-muted hover:text-nanda-text"
		onclick={() => (mobileNavOpen = !mobileNavOpen)}
		aria-label="Toggle navigation"
	>
		{#if mobileNavOpen}
			<ChevronDown class="h-5 w-5" />
		{:else}
			<ChevronRight class="h-5 w-5" />
		{/if}
	</button>
	<span class="text-sm font-medium text-nanda-text">{activeLabel}</span>
</div>

{#if mobileNavOpen}
	<div class="md:hidden border-b border-nanda-border bg-nanda-bg-surface px-2 py-2 space-y-3">
		{#each navGroups as group (group.id)}
			<div>
				<p class="px-3 py-1 text-[10px] uppercase tracking-wider text-nanda-text-dim font-semibold">
					{group.label}
				</p>
				<div class="space-y-0.5">
					{#each group.items as item (item.href)}
						<a
							href={item.href}
							class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors {isActive(
								item.href
							)
								? 'bg-nanda-primary-500/20 text-nanda-primary-400'
								: 'text-nanda-text-muted hover:bg-nanda-bg-elevated hover:text-nanda-text'}"
							onclick={() => (mobileNavOpen = false)}
						>
							<item.icon class="h-4 w-4" />
							<span class="flex-1">{item.label}</span>
							{#if item.badge && stats}
								{@const count = item.badge(stats)}
								{#if count > 0}
									<span
										class="text-[10px] font-mono bg-nanda-primary-500/20 text-nanda-primary-400 px-1.5 py-0.5 rounded-full leading-none"
										>{count}</span
									>
								{/if}
							{/if}
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Three-panel layout (desktop) -->
<div class="flex h-[calc(100vh-64px)] bg-nanda-bg">
	<!-- LEFT SIDEBAR -->
	<aside
		class="hidden md:flex flex-col border-r border-nanda-border bg-nanda-bg-surface transition-all duration-200 {leftCollapsed
			? 'w-14'
			: 'w-60'} flex-shrink-0"
	>
		<!-- Collapse toggle -->
		<div class="flex items-center justify-between px-3 py-2 border-b border-nanda-border">
			{#if !leftCollapsed}
				<a
					href="/admin"
					class="text-xs font-semibold uppercase tracking-wider text-nanda-text-dim hover:text-nanda-text transition-colors"
					>Admin</a
				>
			{/if}
			<button
				class="text-nanda-text-dim hover:text-nanda-text p-1 rounded transition-colors"
				onclick={() => (leftCollapsed = !leftCollapsed)}
				aria-label={leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				{#if leftCollapsed}
					<PanelLeftOpen class="h-4 w-4" />
				{:else}
					<PanelLeftClose class="h-4 w-4" />
				{/if}
			</button>
		</div>

		<!-- Grouped nav items -->
		<nav class="flex-1 overflow-y-auto px-2 py-2 space-y-3">
			{#each navGroups as group (group.id)}
				<div>
					{#if !leftCollapsed}
						<!-- Group header (clickable to collapse) -->
						<button
							class="flex w-full items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors {groupHasActive(
								group.id
							)
								? 'text-nanda-primary-400/70'
								: 'text-nanda-text-dim'} hover:text-nanda-text-muted"
							onclick={() => toggleGroup(group.id)}
						>
							<ChevronRight
								class="h-3 w-3 transition-transform {collapsedGroups[group.id] ? '' : 'rotate-90'}"
							/>
							{group.label}
						</button>
					{/if}

					{#if !collapsedGroups[group.id] || leftCollapsed}
						<div class="space-y-0.5 {leftCollapsed ? '' : 'mt-0.5'}">
							{#each group.items as item (item.href)}
								<a
									href={item.href}
									class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors {isActive(
										item.href
									)
										? 'bg-nanda-primary-500/20 text-nanda-primary-400'
										: 'text-nanda-text-muted hover:bg-nanda-bg-elevated hover:text-nanda-text'}"
									title={leftCollapsed ? item.label : undefined}
								>
									<item.icon class="h-4 w-4 flex-shrink-0" />
									{#if !leftCollapsed}
										<span class="flex-1">{item.label}</span>
										{#if item.badge && stats}
											{@const count = item.badge(stats)}
											{#if count > 0}
												<span
													class="text-[10px] font-mono bg-nanda-primary-500/20 text-nanda-primary-400 px-1.5 py-0.5 rounded-full leading-none"
													>{count}</span
												>
											{/if}
										{/if}
									{/if}
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</nav>

		<!-- ⌘K trigger -->
		<div class="border-t border-nanda-border px-2 py-2">
			{#if !leftCollapsed}
				<button
					class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-nanda-text-dim hover:bg-nanda-bg-elevated hover:text-nanda-text transition-colors"
					onclick={() => (commandPaletteOpen = true)}
				>
					<Command class="h-3.5 w-3.5" />
					<span>Search</span>
					<kbd class="ml-auto text-[10px] font-mono border border-nanda-border rounded px-1 py-0.5"
						>⌘K</kbd
					>
				</button>
			{:else}
				<button
					class="flex w-full items-center justify-center rounded-lg p-1.5 text-nanda-text-dim hover:bg-nanda-bg-elevated hover:text-nanda-text transition-colors"
					onclick={() => (commandPaletteOpen = true)}
					title="Search (⌘K)"
				>
					<Command class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</aside>

	<!-- CENTER PANEL -->
	<main class="flex-1 flex flex-col min-w-0 overflow-hidden">
		<!-- Top bar -->
		<div
			class="hidden md:flex items-center justify-between border-b border-nanda-border px-4 py-2 bg-nanda-bg-surface flex-shrink-0"
		>
			<h2 class="text-sm font-medium text-nanda-text-muted">{activeLabel}</h2>
		</div>

		<!-- Page content -->
		<div class="flex-1 overflow-auto">
			{@render children()}
		</div>
	</main>
</div>

<CommandPalette bind:open={commandPaletteOpen} />
