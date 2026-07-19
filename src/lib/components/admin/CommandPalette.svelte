<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { Search, RefreshCw, KeyRound, X } from 'lucide-svelte';
	import { adminNavItems } from '$lib/config/nav';
	import type { AdminNavItem } from '$lib/config/nav';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let searchValue = $state('');

	interface CommandItem {
		id: string;
		label: string;
		description?: string;
		shortcut?: string;
		section: string;
		icon: AdminNavItem['icon'];
		action: () => void;
	}

	// Build nav commands from shared config
	const navCommands: CommandItem[] = adminNavItems.map((item) => ({
		id: item.id,
		label: item.label,
		description: item.description ?? '',
		section: 'Navigation',
		icon: item.icon,
		shortcut: item.id === 'network' ? '⌘M' : '',
		action: () => navigate(item.href)
	}));

	// Action commands (non-navigation)
	const actionCommands: CommandItem[] = [
		{
			id: 'rotate-keys',
			label: 'Rotate Keys',
			description: 'Rotate signing keys',
			section: 'Actions',
			icon: KeyRound,
			shortcut: '',
			action: () => navigate('/admin/registry')
		},
		{
			id: 'sync',
			label: 'Trigger Federation Sync',
			description: 'Sync with peers',
			section: 'Actions',
			icon: RefreshCw,
			shortcut: '',
			action: () => navigate('/admin/registry')
		}
	];

	const commands: CommandItem[] = [...navCommands, ...actionCommands];

	const filtered = $derived(
		searchValue.trim() === ''
			? commands
			: commands.filter(
					(c) =>
						c.label.toLowerCase().includes(searchValue.toLowerCase()) ||
						c.description?.toLowerCase().includes(searchValue.toLowerCase())
				)
	);

	const sections = $derived([...new Set(filtered.map((c) => c.section))]);

	function navigate(href: string) {
		open = false;
		searchValue = '';
		goto(href);
	}

	function executeCommand(cmd: CommandItem) {
		cmd.action();
		open = false;
		searchValue = '';
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-nanda-border bg-nanda-bg-surface shadow-2xl"
		>
			<!-- Search input -->
			<div class="flex items-center gap-3 border-b border-nanda-border px-4 py-3">
				<Search class="h-4 w-4 text-nanda-text-dim flex-shrink-0" />
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					placeholder="Search commands, agents, services…"
					bind:value={searchValue}
					autofocus
					class="flex-1 bg-transparent text-sm text-nanda-text placeholder:text-nanda-text-dim outline-none"
				/>
				{#if searchValue}
					<button
						onclick={() => (searchValue = '')}
						class="text-nanda-text-dim hover:text-nanda-text"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
				<kbd
					class="hidden sm:inline-flex items-center gap-0.5 rounded border border-nanda-border px-1.5 py-0.5 text-[10px] text-nanda-text-dim font-mono"
				>
					ESC
				</kbd>
			</div>

			<!-- Results -->
			<div class="max-h-[60vh] overflow-y-auto p-2">
				{#if filtered.length === 0}
					<div class="py-8 text-center text-sm text-nanda-text-dim">
						No results found for "{searchValue}"
					</div>
				{:else}
					{#each sections as section}
						<div class="px-2 pt-3 pb-1">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-nanda-text-dim">
								{section}
							</p>
						</div>
						{#each filtered.filter((c) => c.section === section) as cmd (cmd.id)}
							<button
								class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-nanda-bg-elevated focus:bg-nanda-bg-elevated outline-none"
								onclick={() => executeCommand(cmd)}
							>
								<cmd.icon class="h-4 w-4 text-nanda-primary-400 flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<p class="text-nanda-text truncate">{cmd.label}</p>
									{#if cmd.description}
										<p class="text-xs text-nanda-text-dim truncate">{cmd.description}</p>
									{/if}
								</div>
								{#if cmd.shortcut}
									<kbd class="text-[10px] text-nanda-text-dim font-mono">{cmd.shortcut}</kbd>
								{/if}
							</button>
						{/each}
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="border-t border-nanda-border px-4 py-2 flex items-center gap-4 text-[10px] text-nanda-text-dim"
			>
				<span>↑↓ Navigate</span>
				<span>↵ Select</span>
				<span>⌘K Toggle</span>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
