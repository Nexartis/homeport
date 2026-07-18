<script lang="ts">
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import {
		Lock,
		Save,
		CircleCheck,
		CircleAlert,
		History,
		Fingerprint,
		QrCode
	} from 'lucide-svelte';

	import { untrack } from 'svelte';

	const { data } = $props();
	const initial = $derived(data.settings);
	const auditEvents = $derived(data.auditEvents);
	const dbAvailable = $derived(data.dbAvailable);

	// Capture the initial loader snapshot without a reactive dependency (the
	// $effect below re-syncs the form on navigation). `untrack` is the documented
	// Svelte 5 idiom for reading an initial value, and keeps both svelte-check and
	// eslint clean.
	const snapshot = untrack(() => data.settings);
	let authMode = $state<'solo' | 'invite' | 'open'>(
		(snapshot?.authMode as 'solo' | 'invite' | 'open') ?? 'solo'
	);
	let waitlistEnabled = $state<boolean>(Boolean(snapshot?.waitlistEnabled));
	let defaultRole = $state<'developer' | 'viewer'>(
		(snapshot?.defaultRole as 'developer' | 'viewer') ?? 'developer'
	);
	let yanezEnabled = $state<boolean>(Boolean(snapshot?.yanezEnabled));
	let saving = $state(false);
	let message = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	// Live test-QR state (mints a real challenge against this node).
	let testQr = $state<{ qrDataUrl: string; deepLink: string; challengeId: string } | null>(null);
	let testing = $state(false);
	let testError = $state<string | null>(null);

	$effect(() => {
		if (initial) {
			authMode = initial.authMode as 'solo' | 'invite' | 'open';
			waitlistEnabled = Boolean(initial.waitlistEnabled);
			defaultRole = (initial.defaultRole as 'developer' | 'viewer') ?? 'developer';
			yanezEnabled = Boolean(initial.yanezEnabled);
		}
	});

	async function generateTestQr() {
		testing = true;
		testError = null;
		testQr = null;
		try {
			const res = await fetch('/api/yanez/challenge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subject: 'admin-settings-test' })
			});
			const body = (await res.json()) as {
				error?: string;
				challengeId?: string;
				deepLink?: string;
				qrDataUrl?: string;
			};
			if (!res.ok || !body.qrDataUrl || !body.deepLink || !body.challengeId) {
				testError = body.error ?? `HTTP ${res.status}`;
			} else {
				testQr = {
					qrDataUrl: body.qrDataUrl,
					deepLink: body.deepLink,
					challengeId: body.challengeId
				};
			}
		} catch (err) {
			testError = err instanceof Error ? err.message : String(err);
		} finally {
			testing = false;
		}
	}

	async function save() {
		saving = true;
		message = null;
		try {
			const res = await fetch('/api/admin/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ authMode, waitlistEnabled, defaultRole, yanezEnabled })
			});
			const body = (await res.json()) as {
				error?: string;
				message?: string;
				detail?: string;
				changed?: string[];
			};
			if (!res.ok) {
				const serverText = body.error ?? body.message;
				const text = serverText
					? body.detail
						? `${serverText} — ${body.detail}`
						: serverText
					: `HTTP ${res.status}`;
				message = { kind: 'error', text };
			} else {
				message = {
					kind: 'success',
					text: body.changed?.length ? `Saved (${body.changed.join(', ')})` : 'No changes'
				};
			}
		} catch (err) {
			message = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		} finally {
			saving = false;
		}
	}

	const authModeOptions: { value: 'solo' | 'invite' | 'open'; label: string; desc: string }[] = [
		{ value: 'solo', label: 'Solo', desc: 'Only the owner email can sign in.' },
		{ value: 'invite', label: 'Invite-only', desc: 'Allowlist (+ optional waitlist).' },
		{ value: 'open', label: 'Open', desc: 'Anyone with a valid OAuth account.' }
	];
</script>

<svelte:head><title>Auth Settings — NANDA Admin</title></svelte:head>

<div class="p-4 grid lg:grid-cols-[1fr,320px] gap-4">
	<div class="space-y-4">
		{#if !dbAvailable}
			<BaseWidget title="Database Status" collapsible={false}>
				<p class="text-sm text-red-400">Database binding not available.</p>
			</BaseWidget>
		{:else}
			<BaseWidget title="Yanez Biometric Signing">
				<div class="space-y-3">
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={yanezEnabled}
							disabled={saving}
							class="mt-1 accent-nanda-primary-500"
						/>
						<div class="flex-1">
							<p class="flex items-center gap-1.5 text-sm font-medium text-nanda-text">
								<Fingerprint class="h-4 w-4 text-nanda-primary-400" />
								Enable sign-and-return
							</p>
							<p class="text-xs text-nanda-text-muted mt-0.5">
								Lets the Yanez mobile app sign challenges this node issues (QR / deep link →
								biometric approval → signed callback). Off by default. Requires the node's Yanez
								partner secrets to be configured.
							</p>
						</div>
					</label>

					{#if yanezEnabled}
						<div class="pt-1 border-t border-nanda-border">
							<button
								type="button"
								onclick={generateTestQr}
								disabled={testing}
								class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-nanda-border text-sm text-nanda-text hover:border-nanda-border-hover disabled:opacity-50"
							>
								<QrCode class="h-4 w-4" />
								{testing ? 'Generating…' : 'Generate test QR'}
							</button>

							{#if testError}
								<p class="flex items-center gap-1.5 text-xs text-red-400 mt-2">
									<CircleAlert class="h-3.5 w-3.5" />
									{testError}
								</p>
							{/if}

							{#if testQr}
								<div class="mt-3 flex flex-col items-start gap-2">
									<img
										src={testQr.qrDataUrl}
										alt="Yanez sign-and-return test QR"
										class="h-44 w-44 rounded-lg border border-nanda-border bg-white p-2"
									/>
									<p class="text-[11px] text-nanda-text-dim font-mono break-all max-w-full">
										{testQr.deepLink}
									</p>
									<p class="text-[11px] text-nanda-text-muted">
										Scan with the Yanez app to run a live sign-and-return. Challenge
										<span class="font-mono">{testQr.challengeId.slice(0, 8)}</span>.
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</BaseWidget>

			<BaseWidget title="Authentication Mode">
				<fieldset class="space-y-2" disabled={saving}>
					{#each authModeOptions as opt (opt.value)}
						<label
							class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
							class:border-nanda-primary-500={authMode === opt.value}
							class:bg-nanda-primary-500={false}
							class:border-nanda-border={authMode !== opt.value}
						>
							<input
								type="radio"
								bind:group={authMode}
								value={opt.value}
								class="mt-1 accent-nanda-primary-500"
							/>
							<div>
								<p class="text-sm font-medium text-nanda-text">{opt.label}</p>
								<p class="text-xs text-nanda-text-muted">{opt.desc}</p>
							</div>
						</label>
					{/each}
				</fieldset>
			</BaseWidget>

			{#if authMode === 'invite'}
				<BaseWidget title="Waitlist">
					<label class="flex items-center gap-2 text-sm text-nanda-text cursor-pointer">
						<input
							type="checkbox"
							bind:checked={waitlistEnabled}
							class="accent-nanda-primary-500"
						/>
						<span>Queue unknown emails on a waitlist instead of rejecting them.</span>
					</label>
				</BaseWidget>
			{/if}

			<BaseWidget title="Default Role for New Users">
				<fieldset class="flex flex-wrap gap-3 text-sm" disabled={saving}>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							bind:group={defaultRole}
							value="developer"
							class="accent-nanda-primary-500"
						/>
						Developer
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							bind:group={defaultRole}
							value="viewer"
							class="accent-nanda-primary-500"
						/>
						Viewer
					</label>
				</fieldset>
			</BaseWidget>

			<div class="flex items-center justify-between gap-3">
				<div>
					{#if message}
						<p
							class="flex items-center gap-1.5 text-sm"
							class:text-green-400={message.kind === 'success'}
							class:text-red-400={message.kind === 'error'}
						>
							{#if message.kind === 'success'}
								<CircleCheck class="h-4 w-4" />
							{:else}
								<CircleAlert class="h-4 w-4" />
							{/if}
							{message.text}
						</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={save}
					disabled={saving}
					class="flex items-center gap-2 px-4 py-2 rounded-lg bg-nanda-primary-500 text-white text-sm font-medium hover:bg-nanda-primary-600 disabled:opacity-50"
				>
					<Save class="h-4 w-4" />
					{saving ? 'Saving…' : 'Save Changes'}
				</button>
			</div>
		{/if}
	</div>

	<aside class="space-y-3">
		<BaseWidget title="Recent Settings Activity">
			<ul class="space-y-2 text-xs">
				{#each auditEvents as ev (ev.id)}
					<li class="flex gap-2 p-2 rounded bg-nanda-bg-elevated/40 border border-nanda-border">
						<History class="h-3.5 w-3.5 mt-0.5 text-nanda-text-dim flex-shrink-0" />
						<div class="min-w-0 flex-1">
							<p class="font-mono text-nanda-text truncate">{ev.eventType}</p>
							<p class="text-nanda-text-dim truncate">
								{ev.actorEmail ?? 'system'} · {new Date(ev.createdAt * 1000).toLocaleString()}
							</p>
						</div>
					</li>
				{:else}
					<li class="text-nanda-text-dim">No settings changes yet.</li>
				{/each}
			</ul>
		</BaseWidget>
		<p class="flex items-center gap-1.5 text-[11px] text-nanda-text-dim">
			<Lock class="h-3 w-3" /> Mutations require the owner account.
		</p>
	</aside>
</div>
