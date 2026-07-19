<script lang="ts">
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import ActivityWidget from '$lib/components/admin/widgets/ActivityWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import {
		Bot,
		ShieldCheck,
		Scale,
		Eye,
		Coins,
		TriangleAlert,
		Users,
		Globe,
		KeyRound,
		Rocket,
		Heart,
		ArrowRight,
		CircleCheck
	} from 'lucide-svelte';

	const { data } = $props();

	const keysInitialized = $derived((data as Record<string, unknown>).keysInitialized ?? true);
	const stats = $derived(
		(data as Record<string, unknown>).stats as Record<string, Record<string, number>> | undefined
	);
	const recentActivity = $derived(
		(data.recentActivity ?? []) as Array<{
			service: string;
			type: string | null;
			createdAt: number | null;
		}>
	);
</script>

<svelte:head>
	<title>Admin Dashboard — NANDA Services</title>
</svelte:head>

<div class="p-4 space-y-4">
	<!-- ================================================================== -->
	<!-- ONBOARDING WIZARD — shown when keys are not yet initialized        -->
	<!-- ================================================================== -->
	{#if !keysInitialized}
		<div class="rounded-xl border border-nanda-primary/30 bg-nanda-primary/5 p-6 space-y-6">
			<!-- Welcome header -->
			<div class="flex items-start gap-4">
				<div
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-nanda-primary/20"
				>
					<Rocket class="h-6 w-6 text-nanda-primary" />
				</div>
				<div>
					<h2 class="text-xl font-bold text-nanda-text">Welcome to Your NANDA Node</h2>
					<p class="mt-1 text-sm text-nanda-text-muted">
						Your node has been deployed successfully. Complete these steps to get it fully
						operational.
					</p>
				</div>
			</div>

			<!-- Setup steps -->
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Step 1: Initialize Keys -->
				<a
					href="/admin/keys"
					class="group flex flex-col gap-3 rounded-lg border border-nanda-border bg-nanda-bg-elevated p-4 transition-colors hover:border-nanda-primary/50"
				>
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-nanda-primary/20 text-nanda-primary"
						>
							<KeyRound class="h-4 w-4" />
						</div>
						<span
							class="rounded-full bg-nanda-danger/20 px-2 py-0.5 text-xs font-medium text-nanda-danger"
							>Required</span
						>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-nanda-text">Initialize Keys</h3>
						<p class="mt-1 text-xs text-nanda-text-dim">
							Generate Ed25519 signing keys, HMAC secrets, and authentication tokens.
						</p>
					</div>
					<div
						class="mt-auto flex items-center gap-1 text-xs font-medium text-nanda-accent group-hover:text-nanda-accent-300"
					>
						Set up now <ArrowRight class="h-3 w-3" />
					</div>
				</a>

				<!-- Step 2: Verify Health -->
				<a
					href="/health"
					target="_blank"
					class="group flex flex-col gap-3 rounded-lg border border-nanda-border bg-nanda-bg-elevated p-4 transition-colors hover:border-nanda-primary/50"
				>
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20 text-green-400"
						>
							<Heart class="h-4 w-4" />
						</div>
						<span
							class="rounded-full bg-nanda-border px-2 py-0.5 text-xs font-medium text-nanda-text-muted"
							>After keys</span
						>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-nanda-text">Verify Health</h3>
						<p class="mt-1 text-xs text-nanda-text-dim">
							Check that the /health endpoint returns OK and all services are running.
						</p>
					</div>
					<div
						class="mt-auto flex items-center gap-1 text-xs font-medium text-nanda-accent group-hover:text-nanda-accent-300"
					>
						Check health <ArrowRight class="h-3 w-3" />
					</div>
				</a>

				<!-- Step 3: Register an Agent -->
				<a
					href="/admin/agents"
					class="group flex flex-col gap-3 rounded-lg border border-nanda-border bg-nanda-bg-elevated p-4 transition-colors hover:border-nanda-primary/50"
				>
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400"
						>
							<Bot class="h-4 w-4" />
						</div>
						<span
							class="rounded-full bg-nanda-border px-2 py-0.5 text-xs font-medium text-nanda-text-muted"
							>Optional</span
						>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-nanda-text">Register an Agent</h3>
						<p class="mt-1 text-xs text-nanda-text-dim">
							Add your first AI agent to the registry to start managing compliance and trust.
						</p>
					</div>
					<div
						class="mt-auto flex items-center gap-1 text-xs font-medium text-nanda-accent group-hover:text-nanda-accent-300"
					>
						Add agent <ArrowRight class="h-3 w-3" />
					</div>
				</a>

				<!-- Step 4: Federation -->
				<a
					href="/admin/federation"
					class="group flex flex-col gap-3 rounded-lg border border-nanda-border bg-nanda-bg-elevated p-4 transition-colors hover:border-nanda-primary/50"
				>
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400"
						>
							<Globe class="h-4 w-4" />
						</div>
						<span
							class="rounded-full bg-nanda-border px-2 py-0.5 text-xs font-medium text-nanda-text-muted"
							>Optional</span
						>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-nanda-text">Join Federation</h3>
						<p class="mt-1 text-xs text-nanda-text-dim">
							Connect to the NANDA federation network to share agent data across nodes.
						</p>
					</div>
					<div
						class="mt-auto flex items-center gap-1 text-xs font-medium text-nanda-accent group-hover:text-nanda-accent-300"
					>
						Configure <ArrowRight class="h-3 w-3" />
					</div>
				</a>
			</div>
		</div>
	{:else}
		<!-- Keys initialized — show a subtle success banner (dismissible via localStorage) -->
		<div
			class="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5 flex items-center gap-2"
		>
			<CircleCheck class="h-4 w-4 text-green-400 shrink-0" />
			<p class="text-sm text-nanda-text-muted">Node is fully configured and operational.</p>
		</div>
	{/if}
	<!-- Row 1: Key stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<StatWidget
			label="Agents"
			value={stats?.agents?.total ?? 0}
			subtitle="{stats?.agents?.alive ?? 0} alive"
			icon={Bot}
		/>
		<StatWidget
			label="Certificates"
			value={stats?.certificates?.active ?? 0}
			subtitle="active"
			icon={ShieldCheck}
		/>
		<StatWidget
			label="Decisions"
			value={stats?.decisions?.total ?? 0}
			subtitle="{stats?.decisions?.recent ?? 0} last 24h"
			icon={Scale}
		/>
		<StatWidget label="Wallets" value={stats?.wallets?.total ?? 0} icon={Coins} />
		<StatWidget label="Visitors" value={stats?.visitors?.total ?? 0} icon={Users} />
	</div>

	<!-- Row 2: Service health overview -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<StatWidget
			label="Cert Pipeline"
			value={stats?.certJobs?.running ?? 0}
			subtitle="{stats?.certJobs?.pending ?? 0} pending · {stats?.certJobs?.complete ?? 0} done"
		/>
		<StatWidget
			label="Telemetry Events"
			value={stats?.telemetry?.total ?? 0}
			subtitle="{stats?.telemetry?.recentErrors ?? 0} errors (24h)"
			icon={Eye}
		/>
		<StatWidget label="Violations" value={stats?.violations?.total ?? 0} icon={TriangleAlert} />
		<StatWidget
			label="Intents"
			value={stats?.intents?.total ?? 0}
			subtitle="{stats?.intents?.open ?? 0} open"
		/>
	</div>

	<!-- Row 3: Activity + more -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<BaseWidget title="Recent Activity" class="col-span-1">
			<ActivityWidget items={recentActivity} />
		</BaseWidget>

		<BaseWidget title="Service Summary" class="col-span-1">
			<div class="space-y-3 text-sm">
				<div class="flex items-center justify-between">
					<span class="text-nanda-text-muted">Compliance Policies</span>
					<span class="font-mono text-nanda-text">{stats?.policies?.total ?? 0}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-nanda-text-muted">Probe Runs</span>
					<span class="font-mono text-nanda-text">{stats?.probes?.total ?? 0}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-nanda-text-muted">Reputation Snapshots</span>
					<span class="font-mono text-nanda-text">{stats?.reputation?.total ?? 0}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-nanda-text-muted">Settlements</span>
					<span class="font-mono text-nanda-text">{stats?.settlements?.total ?? 0}</span>
				</div>
			</div>
		</BaseWidget>
	</div>

	<!-- Row 4: Federation health -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
		<a href="/admin/federation" class="contents">
			<StatWidget
				label="Federation Peers"
				value={stats?.federation?.peers ?? 0}
				subtitle="{stats?.federation?.active ?? 0} active"
				icon={Globe}
			/>
		</a>
		<a href="/admin/federation" class="contents">
			<StatWidget
				label="Gossip Exchanges"
				value={stats?.federation?.gossipExchanges ?? 0}
				icon={Globe}
			/>
		</a>
	</div>
</div>
