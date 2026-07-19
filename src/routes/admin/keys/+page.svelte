<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import StatWidget from '$lib/components/admin/widgets/StatWidget.svelte';
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import {
		KeyRound,
		RotateCw,
		ShieldCheck,
		TriangleAlert,
		Copy,
		Check,
		Clock,
		ShieldOff
	} from 'lucide-svelte';

	/** Key metadata — friendly names and descriptions */
	const KEY_INFO: Record<string, { name: string; desc: string }> = {
		hmac_secret: {
			name: 'Request Signing',
			desc: 'Signs and verifies API requests between services.'
		},
		radius_secret: {
			name: 'Audit Radius',
			desc: 'Secures audit trail computation and tamper detection.'
		},
		ed25519_private_key_v1: {
			name: 'Identity Key (v1)',
			desc: 'Signs agent registrations, federation messages, and verifiable credentials.'
		},
		ed25519_private_key_v2: {
			name: 'Identity Key (v2)',
			desc: 'Reserved for seamless key rotation without service interruption.'
		},
		cron_auth_token: {
			name: 'Scheduler Token',
			desc: 'Authenticates scheduled maintenance — probes, sweeps, and gossip sync.'
		},
		federation_admin_key: {
			name: 'Federation Key',
			desc: 'Authenticates peer-to-peer sync between federated nodes.'
		}
	};

	const { data } = $props();
	const keys = $derived(data.keys ?? []);
	const allInitialized = $derived(data.allInitialized ?? false);
	const kvAvailable = $derived(data.kvAvailable ?? false);
	let loading = $state(false);
	let rotatingKey = $state<string | null>(null);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let copiedKey = $state<string | null>(null);

	// Derived stats for StatWidgets
	const totalKeys = $derived(keys.length);
	const initializedCount = $derived(
		keys.filter((k: { initialized: boolean }) => k.initialized).length
	);
	const pendingCount = $derived(totalKeys - initializedCount);
	const lastRotated = $derived(() => {
		const dates = keys
			.filter((k: { updatedAt?: string }) => k.updatedAt)
			.map((k: { updatedAt?: string }) => new Date(k.updatedAt!).getTime());
		if (dates.length === 0) return '—';
		const latest = new Date(Math.max(...dates));
		return latest.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	});

	async function initializeKeys(force = false) {
		loading = true;
		message = null;
		try {
			const res = await fetch('/api/admin/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ force })
			});
			const result = (await res.json()) as { message?: string; error?: string };
			if (res.ok) {
				message = { type: 'success', text: result.message ?? 'Done' };
				await invalidateAll();
			} else {
				message = { type: 'error', text: result.error ?? 'Initialization failed' };
			}
		} catch {
			message = { type: 'error', text: 'Network error' };
		} finally {
			loading = false;
		}
	}

	async function rotateKey(keyName: string) {
		rotatingKey = keyName;
		message = null;
		try {
			const res = await fetch('/api/admin/keys', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: keyName })
			});
			const result = (await res.json()) as { message?: string; error?: string };
			if (res.ok) {
				message = { type: 'success', text: result.message ?? 'Done' };
				await invalidateAll();
			} else {
				message = { type: 'error', text: result.error ?? 'Rotation failed' };
			}
		} catch {
			message = { type: 'error', text: 'Network error' };
		} finally {
			rotatingKey = null;
		}
	}

	async function copyPublicKey(value: string, keyName: string) {
		await navigator.clipboard.writeText(value);
		copiedKey = keyName;
		setTimeout(() => (copiedKey = null), 2000);
	}
</script>

<svelte:head><title>Key Management — NANDA Admin</title></svelte:head>

<div class="p-4 space-y-4">
	<!-- KPI Stats -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<StatWidget label="Total Keys" value={totalKeys} icon={KeyRound} />
		<StatWidget
			label="Initialized"
			value={initializedCount}
			subtitle={allInitialized ? 'all ready' : `${pendingCount} pending`}
			icon={ShieldCheck}
		/>
		<StatWidget
			label="Pending"
			value={pendingCount}
			icon={pendingCount > 0 ? TriangleAlert : ShieldCheck}
		/>
		<StatWidget label="Last Rotated" value={lastRotated()} icon={Clock} />
	</div>

	{#if !kvAvailable}
		<BaseWidget title="KV Store Status" collapsible={false}>
			<div class="flex items-start gap-3">
				<ShieldOff class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
				<p class="text-sm text-red-400">KV namespace (NANDA_NODE_CACHE) not available.</p>
			</div>
		</BaseWidget>
	{:else}
		{#if message}
			<div
				class="rounded-xl border p-3 text-sm {message.type === 'success'
					? 'border-green-500/30 bg-green-500/10 text-green-400'
					: 'border-red-500/30 bg-red-500/10 text-red-400'}"
			>
				{message.text}
			</div>
		{/if}

		{#if !allInitialized}
			<BaseWidget title="Setup Required" collapsible={false}>
				<div class="flex items-start gap-3">
					<TriangleAlert class="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
					<div class="flex-1">
						<p class="text-sm text-nanda-text-muted">
							Generate all required cryptographic keys. Keys are stored in your node's encrypted KV
							store and never leave your infrastructure.
						</p>
						<button
							class="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-nanda-primary-500 hover:bg-nanda-primary-600 text-white transition-colors disabled:opacity-50"
							onclick={() => initializeKeys()}
							disabled={loading}
						>
							{loading ? 'Initializing…' : 'Initialize All Keys'}
						</button>
					</div>
				</div>
			</BaseWidget>
		{/if}

		<!-- Key cards -->
		<BaseWidget title="Cryptographic Keys">
			<div class="space-y-3">
				{#each keys as key (key.key)}
					{@const info = KEY_INFO[key.key]}
					{@const isOptional = key.key === 'ed25519_private_key_v2'}
					<div
						class="rounded-lg border bg-nanda-bg-elevated/50 p-4 {isOptional && !key.initialized
							? 'border-nanda-border/40 opacity-50'
							: 'border-nanda-border/60'}"
					>
						<div class="flex items-start gap-4">
							<!-- Status icon -->
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {key.initialized
									? 'bg-green-500/10'
									: isOptional
										? 'bg-nanda-bg-elevated'
										: 'bg-amber-500/10'}"
							>
								{#if key.initialized}
									<ShieldCheck class="h-4.5 w-4.5 text-green-400" />
								{:else if isOptional}
									<KeyRound class="h-4.5 w-4.5 text-nanda-text-dim" />
								{:else}
									<TriangleAlert class="h-4.5 w-4.5 text-amber-400" />
								{/if}
							</div>

							<!-- Content -->
							<div class="flex-1 min-w-0">
								<div class="flex items-baseline gap-2">
									<p class="text-sm font-medium text-nanda-text">
										{info?.name ?? key.label}
									</p>
									{#if isOptional && !key.initialized}
										<span class="text-xs text-nanda-text-dim">optional</span>
									{/if}
								</div>
								<p class="text-xs text-nanda-text-muted mt-0.5 leading-relaxed">
									{info?.desc ?? ''}
								</p>
								{#if key.updatedAt}
									<p class="text-xs text-nanda-text-dim mt-1.5">
										Last rotated {new Date(key.updatedAt).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</p>
								{/if}
								{#if key.publicKey}
									<div class="mt-2 flex items-center gap-2">
										<span class="text-xs text-nanda-text-dim">Public key:</span>
										<code
											class="text-xs text-nanda-primary-400 bg-nanda-bg-elevated px-2 py-0.5 rounded font-mono truncate max-w-[280px]"
											>{key.publicKey}</code
										>
										<button
											class="text-nanda-text-muted hover:text-nanda-text transition-colors"
											onclick={() => key.publicKey && copyPublicKey(key.publicKey, key.key)}
											title="Copy public key"
										>
											{#if copiedKey === key.key}<Check
													class="h-3.5 w-3.5 text-green-400"
												/>{:else}<Copy class="h-3.5 w-3.5" />{/if}
										</button>
									</div>
								{/if}
							</div>

							<!-- Rotate button -->
							{#if key.initialized}
								<button
									class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-nanda-border hover:bg-nanda-bg-elevated text-nanda-text-muted hover:text-nanda-text transition-colors disabled:opacity-50"
									onclick={() => rotateKey(key.key)}
									disabled={rotatingKey === key.key}
								>
									<RotateCw class="h-3.5 w-3.5 {rotatingKey === key.key ? 'animate-spin' : ''}" />
									{rotatingKey === key.key ? 'Rotating…' : 'Rotate'}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if allInitialized}
				<div class="mt-4 pt-4 border-t border-nanda-border/40">
					<div class="flex items-center gap-3">
						<button
							class="px-4 py-2 text-sm font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
							onclick={() => initializeKeys(true)}
							disabled={loading}
						>
							{loading ? 'Regenerating…' : 'Regenerate All Keys'}
						</button>
						<p class="text-xs text-nanda-text-dim">
							Invalidates all existing keys. Certificates and signatures will become unverifiable.
						</p>
					</div>
				</div>
			{/if}
		</BaseWidget>
	{/if}
</div>
