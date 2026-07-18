<script lang="ts">
	import BaseWidget from '$lib/components/admin/widgets/BaseWidget.svelte';
	import { Save, Palette, CircleAlert, CircleCheck } from 'lucide-svelte';

	const { data } = $props();
	const initial = $derived(data.settings);

	// svelte-ignore state_referenced_locally — initial snapshot; $effect re-syncs on nav
	let nodeName = $state<string>(initial?.nodeName ?? '');
	// svelte-ignore state_referenced_locally
	let supportEmail = $state<string>(initial?.supportEmail ?? '');
	// svelte-ignore state_referenced_locally
	let welcomeHeadline = $state<string>(initial?.welcomeHeadline ?? '');
	// svelte-ignore state_referenced_locally
	let welcomeBody = $state<string>(initial?.welcomeBody ?? '');
	// svelte-ignore state_referenced_locally
	let brandLogoUrl = $state<string>(initial?.brandLogoUrl ?? '');
	// svelte-ignore state_referenced_locally
	let brandPrimaryColor = $state<string>(initial?.brandPrimaryColor ?? '#6366F1');
	let saving = $state(false);
	let message = $state<{ kind: 'success' | 'error'; text: string } | null>(null);

	$effect(() => {
		if (initial) {
			nodeName = initial.nodeName ?? '';
			supportEmail = initial.supportEmail ?? '';
			welcomeHeadline = initial.welcomeHeadline ?? '';
			welcomeBody = initial.welcomeBody ?? '';
			brandLogoUrl = initial.brandLogoUrl ?? '';
			brandPrimaryColor = initial.brandPrimaryColor ?? '#6366F1';
		}
	});

	async function save() {
		saving = true;
		message = null;
		try {
			const res = await fetch('/api/admin/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nodeName: nodeName || null,
					supportEmail: supportEmail || null,
					welcomeHeadline: welcomeHeadline || null,
					welcomeBody: welcomeBody || null,
					brandLogoUrl: brandLogoUrl || null,
					brandPrimaryColor: brandPrimaryColor || null
				})
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
			} else
				message = {
					kind: 'success',
					text: body.changed?.length ? `Saved (${body.changed.join(', ')})` : 'No changes'
				};
		} catch (err) {
			message = { kind: 'error', text: err instanceof Error ? err.message : String(err) };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Branding — NANDA Admin</title></svelte:head>

<div class="p-4 grid lg:grid-cols-[1fr,360px] gap-4">
	<div class="space-y-4">
		<BaseWidget title="Node Identity">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Node Name</span>
					<input
						type="text"
						bind:value={nodeName}
						placeholder="ACME NANDA Node"
						class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Support Email</span>
					<input
						type="email"
						bind:value={supportEmail}
						placeholder="support@example.com"
						class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text"
					/>
				</label>
			</div>
		</BaseWidget>

		<BaseWidget title="Welcome Copy">
			<div class="space-y-3">
				<label class="block text-sm">
					<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Headline</span>
					<input
						type="text"
						bind:value={welcomeHeadline}
						class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Body</span>
					<textarea
						bind:value={welcomeBody}
						rows="4"
						class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text"
					></textarea>
				</label>
			</div>
		</BaseWidget>

		<BaseWidget title="Brand Visuals">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="block text-sm">
					<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Logo URL</span>
					<input
						type="url"
						bind:value={brandLogoUrl}
						placeholder="https://…/logo.svg"
						class="mt-1 w-full px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text font-mono text-xs"
					/>
				</label>
				<label class="block text-sm">
					<span class="text-xs uppercase tracking-wide text-nanda-text-dim">Primary Color</span>
					<div class="mt-1 flex gap-2">
						<input
							type="color"
							bind:value={brandPrimaryColor}
							class="h-10 w-14 rounded cursor-pointer"
						/>
						<input
							type="text"
							bind:value={brandPrimaryColor}
							class="flex-1 px-3 py-2 rounded-lg bg-nanda-bg-elevated border border-nanda-border text-nanda-text font-mono text-xs"
						/>
					</div>
				</label>
			</div>
		</BaseWidget>

		<div class="flex items-center justify-between gap-3">
			<div>
				{#if message}
					<p
						class="flex items-center gap-1.5 text-sm"
						class:text-green-400={message.kind === 'success'}
						class:text-red-400={message.kind === 'error'}
					>
						{#if message.kind === 'success'}<CircleCheck class="h-4 w-4" />{:else}<CircleAlert
								class="h-4 w-4"
							/>{/if}
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
	</div>

	<aside>
		<BaseWidget title="Live Preview">
			<div
				class="p-5 rounded-lg border border-nanda-border"
				style="background: linear-gradient(135deg, {brandPrimaryColor}11, transparent);"
			>
				<div class="flex items-center gap-2 mb-3">
					{#if brandLogoUrl}
						<img src={brandLogoUrl} alt="logo" class="h-8 w-8 rounded" />
					{:else}
						<div class="h-8 w-8 rounded" style="background: {brandPrimaryColor};"></div>
					{/if}
					<p class="text-sm font-semibold text-nanda-text">{nodeName || 'Your Node'}</p>
				</div>
				<h2 class="text-lg font-bold text-nanda-text">{welcomeHeadline || 'Welcome'}</h2>
				<p class="mt-1 text-xs text-nanda-text-muted whitespace-pre-wrap">
					{welcomeBody || 'Body copy shown on the welcome gate appears here.'}
				</p>
				<div class="mt-3 inline-flex items-center gap-1.5 text-[11px] text-nanda-text-dim">
					<Palette class="h-3 w-3" /> Primary {brandPrimaryColor}
				</div>
			</div>
		</BaseWidget>
	</aside>
</div>
