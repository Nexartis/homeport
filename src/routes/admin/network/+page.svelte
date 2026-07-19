<script lang="ts">
	import NetworkExplorer from '$lib/components/admin/NetworkExplorer.svelte';
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import { Bot, Radio, Globe, Network } from 'lucide-svelte';
	import type { NetworkAgent, NetworkPeer, RegistryStats } from '$lib/types/admin';

	const { data } = $props();

	const agents = $derived((data.agents ?? []) as NetworkAgent[]);
	const peers = $derived((data.peers ?? []) as NetworkPeer[]);
	const stats = $derived(data.stats as RegistryStats | null);
</script>

<svelte:head>
	<title>Network Explorer — NANDA Admin</title>
</svelte:head>

<div class="flex h-full flex-col gap-4 p-4">
	<!-- Stats bar -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<StatWidget
			label="Total Agents"
			value={stats?.total ?? 0}
			subtitle="{stats?.alive ?? 0} alive"
			icon={Bot}
		/>
		<StatWidget label="Local" value={stats?.local_agents ?? 0} icon={Radio} />
		<StatWidget
			label="Federated"
			value={stats?.federated ?? 0}
			subtitle="{peers.length} peer{peers.length !== 1 ? 's' : ''}"
			icon={Globe}
		/>
		<StatWidget label="Connections" value={agents.length} subtitle="in graph" icon={Network} />
	</div>

	<!-- Network graph -->
	<div class="min-h-0 flex-1 overflow-hidden rounded-xl border border-nanda-border/30 bg-[#0a0a0f]">
		<NetworkExplorer {agents} />
	</div>
</div>
