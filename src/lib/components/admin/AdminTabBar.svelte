<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	interface Tab {
		id: string;
		label: string;
	}

	const { tabs, activeTab }: { tabs: Tab[]; activeTab: string } = $props();

	function switchTab(tab: string) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('tab', tab);
		params.delete('page');
		goto(`?${params.toString()}`, { replaceState: true });
	}
</script>

<div class="flex gap-1 border-b border-nanda-border" role="tablist">
	{#each tabs as tab (tab.id)}
		<button
			role="tab"
			aria-selected={activeTab === tab.id}
			class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px {activeTab === tab.id
				? 'border-nanda-primary-400 text-nanda-primary-400'
				: 'border-transparent text-nanda-text-muted hover:text-nanda-text'}"
			onclick={() => switchTab(tab.id)}>{tab.label}</button
		>
	{/each}
</div>
