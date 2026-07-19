<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import TableWidget from '$lib/components/admin/widgets/TableWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import AdminTabBar from '$lib/components/admin/AdminTabBar.svelte';
	import {
		Globe,
		Radio,
		TriangleAlert,
		ArrowRightLeft,
		Route,
		RefreshCw,
		Send,
		Database,
		Plus,
		Trash2,
		Download,
		Eye,
		Upload,
		Check,
		X,
		ExternalLink,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import { relativeTime } from '$lib/utils/date';
	import { page } from '$app/state';

	interface PreviewAgent {
		agent_id: string;
		agent_url: string;
		name?: string;
		description?: string;
		capabilities?: string[];
		tags?: string[];
		availabilityStatus?: string;
	}

	const { data } = $props();

	const activeTab = $derived(page.url.searchParams.get('tab') || 'peers');

	let gossiping = $state(false);
	let actionMessage = $state('');
	let actionIsError = $state(false);

	function setMsg(msg: string, isErr = false) {
		actionMessage = msg;
		actionIsError = isErr;
	}

	async function adminAction(action: string, extra: Record<string, unknown> = {}) {
		const res = await fetch('/api/admin/federation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, ...extra })
		});
		const result = (await res.json()) as Record<string, unknown>;
		if (!res.ok) throw new Error((result.error as string) ?? res.statusText);
		return result;
	}

	async function triggerGossip() {
		gossiping = true;
		setMsg('');
		try {
			const result = await adminAction('trigger-gossip');
			setMsg(
				`Gossip pushed to ${Object.keys((result.results as Record<string, unknown>) ?? {}).length} peers`
			);
		} catch (err) {
			setMsg(`Gossip error: ${err instanceof Error ? err.message : String(err)}`, true);
		} finally {
			gossiping = false;
		}
	}

	// --- Derived data ---
	const peers = $derived((data.peers ?? []) as Array<Record<string, unknown>>);
	const summary = $derived(
		(data.peerSummary ?? { active: 0, degraded: 0, offline: 0, total: 0 }) as Record<string, number>
	);
	const gossipStats = $derived(
		(data.gossipStats ?? { total_exchanges: 0, inbound: 0, outbound: 0 }) as Record<string, number>
	);
	const quiltRoutes = $derived((data.quiltRoutes ?? []) as Array<Record<string, unknown>>);
	const pageData = $derived(data as Record<string, unknown>);
	const externalRegistries = $derived(
		(pageData.externalRegistries ?? []) as Array<Record<string, unknown>>
	);
	const localAgents = $derived((pageData.localAgents ?? []) as Array<Record<string, unknown>>);

	// --- External registry state ---
	let syncingExternal = $state(false);
	let addingRegistry = $state(false);
	let showAddForm = $state(false);
	let newRegistryId = $state('');
	let newRegistryName = $state('');
	let newRegistryUrl = $state('');
	let newRegistryAdapter = $state('nanda');

	// Preview state
	let previewingRegistryId = $state<string | null>(null);
	let previewAgents = $state<PreviewAgent[]>([]);
	let previewHealth = $state<string | null>(null);
	let previewLoading = $state(false);

	// Outbound registration state
	let showOutboundPanel = $state(false);
	let outboundTargetId = $state<string | null>(null);
	let registeringAgent = $state<string | null>(null);
	let registrationResults = $state<Record<string, { success: boolean; message?: string }>>({});

	// Expanded registry detail
	let expandedRegistryId = $state<string | null>(null);

	// --- Known registry presets ---
	const REGISTRY_PRESETS = [
		{
			id: 'mit-nanda-index',
			name: 'MIT NANDA Index (NEST)',
			url: '',
			adapter: 'nanda',
			description:
				'The official MIT NANDA Index — enter its base URL manually (see nest.projectnanda.org)'
		},
		{
			id: 'hol-nanda',
			name: 'HOL Registry Broker',
			url: 'https://hol.org',
			adapter: 'hol',
			description: 'Aggregates 183K+ agents across NANDA, A2A, MCP, Virtuals (aggregator)'
		}
	];

	function applyPreset(preset: (typeof REGISTRY_PRESETS)[0]) {
		newRegistryId = preset.id;
		newRegistryName = preset.name;
		newRegistryUrl = preset.url;
		newRegistryAdapter = preset.adapter;
	}

	async function triggerExternalSync(registryId?: string) {
		syncingExternal = true;
		setMsg('');
		try {
			const result = await adminAction(
				'sync-external-registries',
				registryId ? { registryId } : {}
			);
			const results = (result.results as Array<Record<string, unknown>>) ?? [];
			const total = results.reduce(
				(s, r) => s + ((r.imported as number) ?? 0) + ((r.updated as number) ?? 0),
				0
			);
			setMsg(`Imported ${total} agents from ${results.length} registries`);
			setTimeout(() => window.location.reload(), 1500);
		} catch (err) {
			setMsg(`Sync error: ${err instanceof Error ? err.message : String(err)}`, true);
		} finally {
			syncingExternal = false;
		}
	}

	async function addRegistry() {
		if (!newRegistryId || !newRegistryName || !newRegistryUrl) return;
		addingRegistry = true;
		setMsg('');
		try {
			await adminAction('add-external-registry', {
				registryId: newRegistryId,
				name: newRegistryName,
				baseUrl: newRegistryUrl,
				adapterType: newRegistryAdapter
			});
			setMsg(`Added ${newRegistryName}`);
			showAddForm = false;
			newRegistryId = '';
			newRegistryName = '';
			newRegistryUrl = '';
			window.location.reload();
		} catch (err) {
			setMsg(`Failed: ${err instanceof Error ? err.message : String(err)}`, true);
		} finally {
			addingRegistry = false;
		}
	}

	async function removeRegistry(registryId: string, name: string) {
		if (!confirm(`Remove "${name}" and all its imported agents?`)) return;
		try {
			await adminAction('remove-external-registry', { registryId, removeAgents: true });
			setMsg(`Removed ${name}`);
			window.location.reload();
		} catch (err) {
			setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`, true);
		}
	}

	async function previewRegistry(registryId: string) {
		if (previewingRegistryId === registryId) {
			previewingRegistryId = null;
			previewAgents = [];
			return;
		}
		previewLoading = true;
		previewingRegistryId = registryId;
		previewAgents = [];
		previewHealth = null;
		try {
			const result = await adminAction('preview-external-registry', { registryId });
			previewAgents = (result.agents as PreviewAgent[]) ?? [];
			previewHealth = (result.registryHealth as string) ?? null;
		} catch (err) {
			setMsg(`Preview failed: ${err instanceof Error ? err.message : String(err)}`, true);
			previewingRegistryId = null;
		} finally {
			previewLoading = false;
		}
	}

	async function registerAgentOnExternal(registryId: string, agentId: string, agentUrl: string) {
		registeringAgent = agentId;
		try {
			const result = await adminAction('register-agent-on-external', {
				registryId,
				agent_id: agentId,
				agent_url: agentUrl
			});
			registrationResults = {
				...registrationResults,
				[`${registryId}:${agentId}`]: {
					success: result.success as boolean,
					message: result.message as string
				}
			};
			if (result.success) {
				setMsg(`Registered ${agentId} on external registry`);
			} else {
				setMsg(`Registration failed: ${result.message}`, true);
			}
		} catch (err) {
			registrationResults = {
				...registrationResults,
				[`${registryId}:${agentId}`]: {
					success: false,
					message: err instanceof Error ? err.message : String(err)
				}
			};
			setMsg(`Registration error: ${err instanceof Error ? err.message : String(err)}`, true);
		} finally {
			registeringAgent = null;
		}
	}

	function toggleExpanded(id: string) {
		expandedRegistryId = expandedRegistryId === id ? null : id;
	}

	// --- Table configs ---
	const peerColumns = [
		{ key: 'node_id', label: 'Node ID' },
		{ key: 'peer_url', label: 'URL', class: 'max-w-[200px] truncate' },
		{ key: 'status', label: 'Status' },
		{ key: 'failure_count', label: 'Failures' },
		{ key: 'last_gossip_display', label: 'Last Gossip' },
		{ key: 'capabilities_display', label: 'Capabilities' }
	];

	const peerRows = $derived(
		peers.map((p) => ({
			...p,
			last_gossip_display: relativeTime(p.last_gossip_at as number | undefined),
			capabilities_display: Array.isArray(p.capabilities)
				? (p.capabilities as string[]).join(', ') || '—'
				: '—'
		}))
	);

	const routeColumns = [
		{ key: 'prefix', label: 'Prefix' },
		{ key: 'quilt_type', label: 'Quilt Type' },
		{ key: 'peer_id', label: 'Peer ID' },
		{ key: 'priority', label: 'Priority' }
	];

	const tabs = [
		{ id: 'peers', label: 'Peers' },
		{ id: 'external', label: 'External Registries' },
		{ id: 'quilt', label: 'Quilt Routes' }
	];
</script>

<svelte:head>
	<title>Federation — NANDA Admin</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- Header -->
	<div>
		<h2 class="text-lg font-bold text-nanda-text">Federation</h2>
		<p class="text-xs text-nanda-text-muted">
			Node: <span class="font-mono text-nanda-accent">{data.nodeId}</span>
			{#if data.configuredPeerUrl}
				&nbsp;· Peer: <span class="font-mono">{data.configuredPeerUrl}</span>
			{/if}
		</p>
	</div>

	<!-- KPI Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
		<StatWidget label="Node Peers" value={summary.total ?? 0} icon={Globe} />
		<StatWidget label="Active" value={summary.active ?? 0} icon={Radio} />
		<StatWidget label="Degraded" value={summary.degraded ?? 0} icon={TriangleAlert} />
		<StatWidget label="External Registries" value={externalRegistries.length} icon={Database} />
		<StatWidget
			label="External Agents"
			value={externalRegistries.reduce((s, r) => s + ((r.totalAgentsSynced as number) ?? 0), 0)}
			subtitle="{externalRegistries.filter((r) => r.enabled).length} enabled"
			icon={Download}
		/>
		<StatWidget
			label="Gossip Exchanges"
			value={gossipStats.total_exchanges ?? 0}
			subtitle="{gossipStats.inbound ?? 0} in · {gossipStats.outbound ?? 0} out"
			icon={ArrowRightLeft}
		/>
	</div>

	<!-- Action bar -->
	<div class="flex items-center gap-3 flex-wrap">
		<button
			onclick={triggerGossip}
			disabled={gossiping}
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-nanda-accent/10 text-nanda-accent hover:bg-nanda-accent/20 disabled:opacity-50 transition-colors"
		>
			<Send class="h-3.5 w-3.5" />
			{gossiping ? 'Pushing…' : 'Push Gossip'}
		</button>
		{#if actionMessage}
			<span class="text-xs {actionIsError ? 'text-red-400' : 'text-nanda-text-muted'}">
				{actionMessage}
			</span>
		{/if}
	</div>

	<!-- Tab bar -->
	<AdminTabBar {tabs} {activeTab} />

	{#if activeTab === 'peers'}
		<BaseWidget title="Federation Peers">
			{#if peerRows.length === 0}
				<div class="text-center py-8">
					<Globe class="h-8 w-8 text-nanda-text-dim mx-auto mb-2" />
					<p class="text-sm text-nanda-text-muted">No federation peers registered</p>
					<p class="text-xs text-nanda-text-dim mt-1">
						Register a peer via POST /api/admin/federation or the mutual join endpoint
					</p>
				</div>
			{:else}
				<TableWidget columns={peerColumns} rows={peerRows} searchable pageSize={10} />
			{/if}
		</BaseWidget>
	{:else if activeTab === 'external'}
		<!-- ========== EXTERNAL REGISTRIES (INBOUND) ========== -->
		<BaseWidget title="Inbound — External NANDA Registries">
			<p class="text-xs text-nanda-text-dim mb-4">
				Connect to external NANDA registries to discover and import agents into this node. All
				import actions are manual — nothing syncs automatically.
			</p>

			<!-- Add Registry -->
			<div class="mb-4 flex items-center gap-2">
				<button
					onclick={() => (showAddForm = !showAddForm)}
					class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-nanda-accent/10 text-nanda-accent hover:bg-nanda-accent/20 transition-colors"
				>
					<Plus class="h-3.5 w-3.5" />
					{showAddForm ? 'Cancel' : 'Connect Registry'}
				</button>
			</div>

			{#if showAddForm}
				<div class="mb-6 p-4 rounded-lg bg-nanda-bg-raised border border-nanda-border space-y-4">
					<!-- Presets -->
					<div>
						<p class="text-xs font-medium text-nanda-text mb-2">Quick Connect — Known Registries</p>
						<div class="flex flex-wrap gap-2">
							{#each REGISTRY_PRESETS as preset}
								{@const alreadyAdded = externalRegistries.some((r) => r.id === preset.id)}
								<button
									onclick={() => applyPreset(preset)}
									disabled={alreadyAdded}
									class="group flex flex-col items-start px-3 py-2 rounded-lg border text-left text-xs transition-colors
										{alreadyAdded
										? 'border-nanda-border/50 opacity-50 cursor-not-allowed'
										: 'border-nanda-border hover:border-nanda-accent hover:bg-nanda-accent/5 cursor-pointer'}"
								>
									<span class="font-medium text-nanda-text">{preset.name}</span>
									<span class="text-nanda-text-dim text-[10px]">{preset.description}</span>
									{#if alreadyAdded}
										<span class="text-[10px] text-green-500 mt-0.5 flex items-center gap-1">
											<Check class="h-3 w-3" /> Already connected
										</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<hr class="border-nanda-border" />

					<!-- Manual form -->
					<p class="text-xs font-medium text-nanda-text">Or enter details manually</p>
					<div class="grid grid-cols-2 gap-3">
						<label class="text-xs text-nanda-text-muted">
							ID
							<input
								type="text"
								bind:value={newRegistryId}
								placeholder="e.g. mit-nanda-index"
								class="mt-1 w-full px-2 py-1.5 text-xs rounded bg-nanda-bg border border-nanda-border text-nanda-text"
							/>
						</label>
						<label class="text-xs text-nanda-text-muted">
							Name
							<input
								type="text"
								bind:value={newRegistryName}
								placeholder="e.g. MIT NANDA Index"
								class="mt-1 w-full px-2 py-1.5 text-xs rounded bg-nanda-bg border border-nanda-border text-nanda-text"
							/>
						</label>
						<label class="text-xs text-nanda-text-muted">
							Base URL
							<input
								type="text"
								bind:value={newRegistryUrl}
								placeholder="e.g. https://registry.example.com"
								class="mt-1 w-full px-2 py-1.5 text-xs rounded bg-nanda-bg border border-nanda-border text-nanda-text"
							/>
						</label>
						<label class="text-xs text-nanda-text-muted">
							Adapter
							<select
								bind:value={newRegistryAdapter}
								class="mt-1 w-full px-2 py-1.5 text-xs rounded bg-nanda-bg border border-nanda-border text-nanda-text"
							>
								<option value="nanda">NANDA Index (MIT-compatible)</option>
								<option value="hol">HOL Registry Broker</option>
							</select>
						</label>
					</div>
					<div class="flex gap-2">
						<button
							onclick={addRegistry}
							disabled={addingRegistry || !newRegistryId || !newRegistryName || !newRegistryUrl}
							class="px-3 py-1.5 text-xs font-medium rounded-lg bg-nanda-accent text-white hover:bg-nanda-accent/90 disabled:opacity-50"
						>
							{addingRegistry ? 'Connecting…' : 'Connect Registry'}
						</button>
						<button
							onclick={() => (showAddForm = false)}
							class="px-3 py-1.5 text-xs font-medium rounded-lg border border-nanda-border text-nanda-text-muted hover:bg-nanda-bg-raised"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<!-- Registry cards -->
			{#if externalRegistries.length === 0}
				<div class="text-center py-8">
					<Database class="h-8 w-8 text-nanda-text-dim mx-auto mb-2" />
					<p class="text-sm text-nanda-text-muted">No external registries connected</p>
					<p class="text-xs text-nanda-text-dim mt-1">
						Click "Connect Registry" above to add the MIT NANDA Index or other NANDA nodes
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each externalRegistries as reg}
						{@const regId = reg.id as string}
						{@const isExpanded = expandedRegistryId === regId}
						{@const isPreviewing = previewingRegistryId === regId}
						<div class="rounded-lg border border-nanda-border bg-nanda-bg-raised overflow-hidden">
							<!-- Registry header -->
							<div class="flex items-center justify-between px-4 py-3">
								<button
									onclick={() => toggleExpanded(regId)}
									class="flex items-center gap-3 text-left flex-1"
								>
									<div>
										<div class="flex items-center gap-2">
											<span class="text-sm font-medium text-nanda-text">{reg.name}</span>
											<span
												class="px-1.5 py-0.5 text-[10px] rounded-full {reg.lastSyncStatus ===
												'success'
													? 'bg-green-500/10 text-green-500'
													: reg.lastSyncStatus === 'error'
														? 'bg-red-500/10 text-red-400'
														: 'bg-nanda-text-dim/10 text-nanda-text-dim'}"
											>
												{reg.lastSyncStatus ?? 'never synced'}
											</span>
											<span
												class="px-1.5 py-0.5 text-[10px] rounded-full bg-nanda-accent/10 text-nanda-accent"
											>
												{reg.adapterType}
											</span>
										</div>
										<p class="text-xs text-nanda-text-dim mt-0.5 font-mono">
											{reg.baseUrl}
										</p>
									</div>
									{#if isExpanded}
										<ChevronUp class="h-4 w-4 text-nanda-text-dim" />
									{:else}
										<ChevronDown class="h-4 w-4 text-nanda-text-dim" />
									{/if}
								</button>

								<!-- Quick actions -->
								<div class="flex items-center gap-2 ml-4">
									<span class="text-xs text-nanda-text-dim">
										{reg.totalAgentsSynced ?? 0} agents
									</span>
									<button
										onclick={() => previewRegistry(regId)}
										disabled={previewLoading && isPreviewing}
										class="p-1.5 rounded text-nanda-accent hover:bg-nanda-accent/10 transition-colors"
										title="Preview agents"
									>
										<Eye class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={() => triggerExternalSync(regId)}
										disabled={syncingExternal}
										class="p-1.5 rounded text-nanda-accent hover:bg-nanda-accent/10 transition-colors"
										title="Import agents"
									>
										<Download class="h-3.5 w-3.5 {syncingExternal ? 'animate-bounce' : ''}" />
									</button>
									<button
										onclick={() => removeRegistry(regId, reg.name as string)}
										class="p-1.5 rounded text-red-500 hover:bg-red-500/10 transition-colors"
										title="Disconnect registry"
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>

							<!-- Expanded detail -->
							{#if isExpanded}
								<div class="border-t border-nanda-border px-4 py-3 space-y-2">
									<div class="grid grid-cols-3 gap-4 text-xs">
										<div>
											<span class="text-nanda-text-dim">Last sync count</span>
											<p class="font-medium text-nanda-text">
												{reg.lastSyncAgentCount ?? 0}
											</p>
										</div>
										<div>
											<span class="text-nanda-text-dim">Total synced</span>
											<p class="font-medium text-nanda-text">
												{reg.totalAgentsSynced ?? 0}
											</p>
										</div>
										<div>
											<span class="text-nanda-text-dim">Last sync</span>
											<p class="font-medium text-nanda-text">
												{reg.lastSyncAt ? relativeTime(reg.lastSyncAt as number) : 'never'}
											</p>
										</div>
									</div>
									{#if reg.lastSyncError}
										<div class="text-xs p-2 rounded bg-red-500/10 text-red-400 font-mono break-all">
											{reg.lastSyncError}
										</div>
									{/if}
								</div>
							{/if}

							<!-- Preview panel -->
							{#if isPreviewing}
								<div class="border-t border-nanda-border px-4 py-3 bg-nanda-bg/50">
									{#if previewLoading}
										<div
											class="flex items-center gap-2 text-xs text-nanda-text-dim py-4 justify-center"
										>
											<RefreshCw class="h-4 w-4 animate-spin" />
											Loading agents from registry…
										</div>
									{:else}
										<div class="flex items-center justify-between mb-3">
											<p class="text-xs font-medium text-nanda-text">
												Preview: {previewAgents.length} agents found
												{#if previewHealth}
													<span
														class="ml-2 px-1.5 py-0.5 rounded-full text-[10px] {previewHealth ===
														'ok'
															? 'bg-green-500/10 text-green-500'
															: 'bg-red-500/10 text-red-400'}"
													>
														health: {previewHealth}
													</span>
												{/if}
											</p>
											<button
												onclick={() => {
													previewingRegistryId = null;
													previewAgents = [];
												}}
												class="p-1 text-nanda-text-dim hover:text-nanda-text"
											>
												<X class="h-3.5 w-3.5" />
											</button>
										</div>
										<div class="max-h-64 overflow-y-auto space-y-1.5">
											{#each previewAgents as agent}
												<div
													class="flex items-center justify-between px-3 py-2 rounded bg-nanda-bg-raised border border-nanda-border/50 text-xs"
												>
													<div class="flex-1 min-w-0">
														<span class="font-medium text-nanda-text">
															{agent.name ?? agent.agent_id}
														</span>
														{#if agent.description}
															<span class="text-nanda-text-dim ml-2 truncate">
																— {agent.description}
															</span>
														{/if}
														<div class="text-[10px] text-nanda-text-dim font-mono mt-0.5 truncate">
															{agent.agent_url || '—'}
														</div>
													</div>
													{#if agent.availabilityStatus}
														<span
															class="ml-2 px-1.5 py-0.5 rounded-full text-[10px]
																{agent.availabilityStatus === 'active'
																? 'bg-green-500/10 text-green-500'
																: 'bg-yellow-500/10 text-yellow-500'}"
														>
															{agent.availabilityStatus}
														</span>
													{/if}
												</div>
											{/each}
										</div>
										{#if previewAgents.length > 0}
											<div class="mt-3 flex items-center gap-2">
												<button
													onclick={() => triggerExternalSync(regId)}
													disabled={syncingExternal}
													class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-nanda-accent text-white hover:bg-nanda-accent/90 disabled:opacity-50"
												>
													<Download class="h-3.5 w-3.5" />
													Import All {previewAgents.length} Agents
												</button>
												<span class="text-[10px] text-nanda-text-dim">
													Agents will be stored locally with "{reg.adapterType === 'hol'
														? 'hol-nanda'
														: 'nanda-ext'}:" prefix
												</span>
											</div>
										{/if}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</BaseWidget>

		<!-- ========== OUTBOUND — Register Our Agents ========== -->
		<BaseWidget title="Outbound — Register Agents on External Nodes">
			<p class="text-xs text-nanda-text-dim mb-4">
				Push your local agents to external NANDA registries so other nodes can discover them.
				Currently supports NANDA Index-compatible registries (POST /register).
			</p>

			{#if localAgents.length === 0}
				<div class="text-center py-6">
					<Upload class="h-8 w-8 text-nanda-text-dim mx-auto mb-2" />
					<p class="text-sm text-nanda-text-muted">No local agents to register</p>
					<p class="text-xs text-nanda-text-dim mt-1">
						Register agents on this node first via /register or the admin panel
					</p>
				</div>
			{:else}
				<!-- Select target registry -->
				<div class="mb-4">
					<p class="text-xs text-nanda-text-muted mb-1">Target Registry</p>
					{#if externalRegistries.filter((r) => r.adapterType === 'nanda').length === 0}
						<p class="text-xs text-nanda-text-dim">
							No NANDA-compatible registries connected. Add one above first.
						</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each externalRegistries.filter((r) => r.adapterType === 'nanda') as reg}
								{@const selected = outboundTargetId === (reg.id as string)}
								<button
									onclick={() => {
										outboundTargetId = selected ? null : (reg.id as string);
										showOutboundPanel = !selected;
									}}
									class="px-3 py-1.5 text-xs rounded-lg border transition-colors
										{selected
										? 'border-nanda-accent bg-nanda-accent/10 text-nanda-accent'
										: 'border-nanda-border text-nanda-text-muted hover:border-nanda-accent'}"
								>
									{reg.name}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if showOutboundPanel && outboundTargetId}
					{@const targetReg = externalRegistries.find((r) => r.id === outboundTargetId)}
					<div class="space-y-2">
						<p class="text-xs text-nanda-text-muted">
							Your agents → <span class="font-medium text-nanda-text">{targetReg?.name}</span>
							<span class="font-mono text-nanda-text-dim ml-1">({targetReg?.baseUrl})</span>
						</p>
						<div class="max-h-72 overflow-y-auto space-y-1.5">
							{#each localAgents as agent}
								{@const key = `${outboundTargetId}:${agent.agent_id}`}
								{@const result = registrationResults[key]}
								<div
									class="flex items-center justify-between px-3 py-2 rounded bg-nanda-bg-raised border border-nanda-border/50 text-xs"
								>
									<div class="flex-1 min-w-0">
										<span class="font-medium text-nanda-text">{agent.agent_id}</span>
										<span class="text-nanda-text-dim font-mono ml-2 truncate">
											{agent.agent_url ?? '—'}
										</span>
									</div>
									<div class="flex items-center gap-2 ml-2">
										{#if result}
											{#if result.success}
												<span class="flex items-center gap-1 text-green-500 text-[10px]">
													<Check class="h-3 w-3" /> Registered
												</span>
											{:else}
												<span class="text-red-400 text-[10px]" title={result.message}>
													<X class="h-3 w-3 inline" /> Failed
												</span>
											{/if}
										{:else}
											<button
												onclick={() =>
													registerAgentOnExternal(
														outboundTargetId!,
														agent.agent_id as string,
														(agent.agent_url as string) ?? ''
													)}
												disabled={registeringAgent === (agent.agent_id as string)}
												class="flex items-center gap-1 px-2 py-1 rounded text-nanda-accent bg-nanda-accent/10 hover:bg-nanda-accent/20 disabled:opacity-50 transition-colors"
											>
												<ExternalLink class="h-3 w-3" />
												{registeringAgent === (agent.agent_id as string)
													? 'Registering…'
													: 'Register'}
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</BaseWidget>
	{:else if activeTab === 'quilt'}
		<BaseWidget title="Quilt Routes">
			{#if quiltRoutes.length === 0}
				<div class="text-center py-8">
					<Route class="h-8 w-8 text-nanda-text-dim mx-auto mb-2" />
					<p class="text-sm text-nanda-text-muted">No quilt routes configured</p>
				</div>
			{:else}
				<TableWidget
					columns={routeColumns}
					rows={quiltRoutes as Record<string, unknown>[]}
					searchable
					pageSize={10}
				/>
			{/if}
		</BaseWidget>
	{/if}
</div>
