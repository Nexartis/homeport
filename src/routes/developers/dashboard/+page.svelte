<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Key,
		Trash2,
		Copy,
		CircleCheck,
		TriangleAlert,
		Clock,
		Package,
		Rocket,
		BookOpen,
		Fingerprint
	} from 'lucide-svelte';
	import { relativeTime } from '$lib/utils/date';
	import type { DevApiKey } from '$lib/types/admin';

	const { data } = $props();

	let newKeyName = $state('');
	let generatedKey = $state<string | null>(null);
	let generating = $state(false);
	let revoking = $state<string | null>(null);
	let copied = $state(false);
	let userIdCopied = $state(false);
	let error = $state<string | null>(null);

	const activeKeys = $derived((data.keys as DevApiKey[]).filter((k) => k.status === 'active'));
	const revokedKeys = $derived((data.keys as DevApiKey[]).filter((k) => k.status === 'revoked'));

	async function generateKey() {
		if (!newKeyName.trim()) {
			error = 'Enter a name for your key (e.g. "my-agent-bot") before clicking Generate.';
			return;
		}
		generating = true;
		error = null;
		try {
			const res = await fetch('/api/developers/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newKeyName.trim() })
			});
			const json = (await res.json()) as { error?: string; key?: { raw_key: string } };
			if (!res.ok) {
				error = json.error ?? 'Request failed';
				return;
			}
			if (!json.key?.raw_key) {
				error = 'Unexpected response: missing key';
				return;
			}
			generatedKey = json.key.raw_key;
			newKeyName = '';
			await invalidateAll();
		} catch (e) {
			error = 'Failed to generate key';
		} finally {
			generating = false;
		}
	}

	async function revokeKey(id: string) {
		if (!confirm('Are you sure you want to revoke this key? This cannot be undone.')) return;
		revoking = id;
		try {
			const res = await fetch(`/api/developers/keys/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const j = (await res.json()) as { error?: string };
				error = j.error ?? 'Request failed';
				return;
			}
			await invalidateAll();
		} catch {
			error = 'Failed to revoke key';
		} finally {
			revoking = null;
		}
	}

	function copyKey() {
		if (generatedKey) {
			navigator.clipboard.writeText(generatedKey);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	function copyUserId() {
		if (data.user?.id) {
			navigator.clipboard.writeText(data.user.id);
			userIdCopied = true;
			setTimeout(() => (userIdCopied = false), 2000);
		}
	}
</script>

<svelte:head>
	<title>Developer Dashboard — Homeport</title>
</svelte:head>

<div class="mx-auto max-w-[900px] px-4 py-10">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-2xl font-extrabold gradient-text">Developer Dashboard</h1>
			<p class="text-sm text-nanda-text-muted mt-1">Manage your API keys and monitor usage.</p>
		</div>
		<a
			href="/developers"
			class="text-sm text-nanda-text-dim hover:text-nanda-text-muted transition-colors"
			>&larr; Developer Portal</a
		>
	</div>

	{#if error}
		<div
			class="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2"
		>
			<TriangleAlert class="h-4 w-4 shrink-0" />
			{error}
			<button class="ml-auto text-xs underline" onclick={() => (error = null)}>Dismiss</button>
		</div>
	{/if}

	<!-- Your identity: user DID + email (used as granted_by_did for delegation.grant) -->
	{#if data.user?.id}
		<div class="nanda-card mb-6">
			<div class="flex items-center gap-2 mb-3">
				<Fingerprint class="h-5 w-5 text-nanda-primary-400" />
				<h2 class="text-lg font-bold">Your Identity</h2>
			</div>
			<div>
				<p class="text-xs text-nanda-text-dim uppercase tracking-wider mb-1">
					User ID — use as <code class="font-mono normal-case tracking-normal">granted_by_did</code>
				</p>
				<div class="flex items-center gap-2">
					<code
						class="flex-1 bg-nanda-bg rounded px-3 py-2 text-xs font-mono text-nanda-text break-all"
						>{data.user.id}</code
					>
					<button
						onclick={copyUserId}
						class="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-nanda-bg px-3 py-2 text-xs font-medium text-nanda-text-muted hover:text-nanda-text transition-colors border border-nanda-border"
					>
						{#if userIdCopied}<CircleCheck class="h-3.5 w-3.5 text-green-400" /> Copied{:else}<Copy
								class="h-3.5 w-3.5"
							/> Copy{/if}
					</button>
				</div>
				{#if data.user.email}
					<p class="text-xs text-nanda-text-dim mt-2">
						Signed in as <span class="text-nanda-text-muted">{data.user.email}</span>
					</p>
				{/if}
				<p class="text-xs text-nanda-text-dim mt-2">
					The API enforces that <code class="font-mono">delegation.grant</code>'s
					<code class="font-mono">granted_by_did</code> matches this ID — unless the calling key has
					<code class="font-mono">operator</code>
					or <code class="font-mono">admin</code>
					scope. See the
					<a
						href="https://raw.githubusercontent.com/Nexartis/homeport/main/SKILL.md"
						class="underline hover:text-nanda-text-muted"
						target="_blank"
						rel="noopener noreferrer">delegation SkillMD</a
					> for the full flow.
				</p>
			</div>
		</div>
	{/if}

	<!-- Generated key banner -->
	{#if generatedKey}
		<div class="mb-6 rounded-lg border border-nanda-primary-500/30 bg-nanda-primary-500/10 p-4">
			<p class="text-sm font-semibold text-nanda-primary-400 mb-2">
				<Key class="h-4 w-4 inline" /> Your new API key (shown only once):
			</p>
			<div class="flex items-center gap-2">
				<code
					class="flex-1 bg-nanda-bg rounded px-3 py-2 text-xs font-mono text-nanda-text break-all"
					>{generatedKey}</code
				>
				<button
					onclick={copyKey}
					class="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-nanda-bg px-3 py-2 text-xs font-medium text-nanda-text-muted hover:text-nanda-text transition-colors border border-nanda-border"
				>
					{#if copied}<CircleCheck class="h-3.5 w-3.5 text-green-400" /> Copied{:else}<Copy
							class="h-3.5 w-3.5"
						/> Copy{/if}
				</button>
			</div>
			<p class="text-xs text-nanda-text-dim mt-2">
				Save this key now. You won't be able to see it again.
			</p>
			<button
				onclick={() => (generatedKey = null)}
				class="mt-2 text-xs text-nanda-text-dim underline">Dismiss</button
			>
		</div>

		<!-- SDK initialization snippet (shown alongside generated key) -->
		<div class="mb-6 nanda-card">
			<div class="flex items-center gap-2 mb-3">
				<Package class="h-5 w-5 text-nanda-primary-400" />
				<h3 class="text-sm font-semibold text-nanda-text">Use it with the TypeScript SDK</h3>
			</div>
			<div class="nanda-card font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed mb-3">
				<span class="text-nanda-text-dim"># Install</span>
				pnpm add @nexartis/homeport-sdk

				<span class="text-nanda-text-dim">// Initialize</span>
				<span class="text-purple-400">import</span>
				{'{'} NnnClient } <span class="text-purple-400">from</span>
				<span class="text-emerald-400">'@nexartis/homeport-sdk'</span>;

				<span class="text-purple-400">const</span> nnn = <span class="text-purple-400">new</span>
				NnnClient({'{'}
				baseUrl:
				<span class="text-emerald-400">'{page.data.registryUrl ?? page.url.origin}'</span>, apiKey:
				process.env.NANDA_API_KEY!, });

				<span class="text-nanda-text-dim">// First call</span>
				<span class="text-purple-400">const</span> agents =
				<span class="text-purple-400">await</span>
				nnn.agents.search({'{'} capabilities: [<span class="text-emerald-400">'code-review'</span>]
				});
			</div>
			<div class="flex flex-wrap gap-2">
				<a
					href="/developers/getting-started"
					class="inline-flex items-center gap-1.5 rounded-lg bg-nanda-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-nanda-primary-500 transition-colors"
				>
					<Rocket class="h-3.5 w-3.5" /> 60-second quickstart
				</a>
				<a
					href="/docs/sdk"
					class="inline-flex items-center gap-1.5 rounded-lg border border-nanda-border px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
				>
					<BookOpen class="h-3.5 w-3.5" /> SDK reference
				</a>
			</div>
		</div>
	{/if}

	<!-- Generate new key -->
	<div class="nanda-card mb-8">
		<h2 class="text-lg font-bold mb-3">Generate API Key</h2>
		<form
			class="flex gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				generateKey();
			}}
		>
			<input
				type="text"
				bind:value={newKeyName}
				placeholder="Key name (e.g. my-agent-bot)"
				maxlength="100"
				class="flex-1 rounded-lg bg-nanda-bg border border-nanda-border px-3 py-2 text-sm text-nanda-text placeholder-nanda-text-dim focus:outline-none focus:ring-1 focus:ring-nanda-primary-500/50"
			/>
			<button
				type="submit"
				disabled={generating}
				class="inline-flex items-center gap-2 rounded-lg bg-nanda-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-nanda-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Key class="h-4 w-4" />
				{generating ? 'Generating...' : 'Generate'}
			</button>
		</form>
		<p class="text-xs text-nanda-text-dim mt-2">
			Free tier: up to 5 active keys, 1,000 requests/month each.
		</p>
	</div>

	<!-- Active keys -->
	<h2 class="text-lg font-bold mb-3">Active Keys ({activeKeys.length})</h2>
	{#if activeKeys.length === 0}
		<div class="nanda-card text-center py-8 mb-8">
			<Key class="h-8 w-8 text-nanda-text-dim mx-auto mb-2" />
			<p class="text-sm text-nanda-text-muted">
				No active API keys yet. Generate your first key above.
			</p>
		</div>
	{:else}
		<div class="space-y-3 mb-8">
			{#each activeKeys as key (key.id)}
				<div class="nanda-card flex items-center gap-4">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="font-semibold text-sm truncate">{key.name}</span>
							<span
								class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium"
								>{key.tier}</span
							>
						</div>
						<div class="flex items-center gap-3 text-xs text-nanda-text-dim">
							<code class="font-mono">{key.keyPrefix}...</code>
							<span
								>{(key.usageCountMonthly ?? 0).toLocaleString()} / {(
									key.rateLimitMonthly ?? 0
								).toLocaleString()} req</span
							>
							<span class="flex items-center gap-1"
								><Clock class="h-3 w-3" /> {relativeTime(key.lastUsedAt)}</span
							>
						</div>
					</div>
					<!-- Usage bar -->
					<div class="w-20 shrink-0">
						<div class="h-1.5 rounded-full bg-nanda-bg overflow-hidden">
							<div
								class="h-full rounded-full bg-nanda-primary-500 transition-all"
								style="width:{Math.min(
									100,
									((key.usageCountMonthly ?? 0) / (key.rateLimitMonthly || 1)) * 100
								)}%"
							></div>
						</div>
					</div>
					<button
						onclick={() => revokeKey(key.id)}
						disabled={revoking === key.id}
						class="shrink-0 p-2 rounded-lg text-nanda-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
						title="Revoke key"
					>
						<Trash2 class="h-4 w-4" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Revoked keys -->
	{#if revokedKeys.length > 0}
		<h2 class="text-lg font-bold mb-3 text-nanda-text-dim">Revoked Keys ({revokedKeys.length})</h2>
		<div class="space-y-3 mb-8 opacity-60">
			{#each revokedKeys as key (key.id)}
				<div class="nanda-card flex items-center gap-4">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="font-semibold text-sm truncate line-through">{key.name}</span>
							<span
								class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium"
								>revoked</span
							>
						</div>
						<div class="flex items-center gap-3 text-xs text-nanda-text-dim">
							<code class="font-mono">{key.keyPrefix}...</code>
							<span>Revoked {relativeTime(key.revokedAt)}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
