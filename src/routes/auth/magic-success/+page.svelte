<!--
	Magic Link Success Page
	
	Shown after a magic link click in a different browser/tab.
	Displays success state and auto-closes or redirects.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Check, Lock } from 'lucide-svelte';

	let status = $state('');
	let message = $state('');
	let subtitle = $state('');

	onMount(() => {
		status = page.url.searchParams.get('status') || '';
		const redirectTo = page.url.searchParams.get('redirect') || '';

		if (status === 'magic_complete') {
			message = 'Magic Link Confirmed!';
			subtitle = 'This window will close shortly.';

			// Auto-close after 3 seconds if this is a popup/new tab
			setTimeout(() => {
				if (window.opener || window.history.length === 1) {
					window.close();
				}
			}, 3000);
		} else if (status === 'authenticated') {
			if (redirectTo === 'admin') {
				message = 'Authentication Complete!';
				subtitle = 'You are now signed in. Redirecting to admin...';

				// NANDA: redirect to /admin (not /dashboard)
				setTimeout(() => {
					window.location.href = '/admin';
				}, 1000);
			} else {
				message = 'Authentication Complete!';
				subtitle = 'You are now signed in. You can close this window.';

				setTimeout(() => {
					if (window.opener || window.history.length === 1) {
						window.close();
					}
				}, 2000);
			}
		} else {
			message = 'Processing Sign-In Link...';
			subtitle = 'Please wait while we process your authentication...';
		}
	});
</script>

<svelte:head>
	<title>Authentication — Homeport</title>
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="w-full max-w-md">
		<div class="nanda-card">
			<div class="space-y-6 text-center">
				{#if status === 'magic_complete'}
					<!-- Success State -->
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nanda-success/20"
					>
						<Check class="h-8 w-8 text-nanda-success" />
					</div>
					<h1 class="text-2xl font-bold text-nanda-success">{message}</h1>
					<div class="space-y-2">
						<p class="text-sm text-nanda-text-muted">{subtitle}</p>
						<p class="text-xs text-nanda-text-dim">
							You can now return to your original browser tab where you started the login process.
						</p>
					</div>
					<button class="nanda-btn-primary w-full" onclick={() => window.close()}>
						Close Window
					</button>
				{:else if status === 'authenticated'}
					<!-- Authenticated State -->
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nanda-primary/20"
					>
						<Lock class="h-8 w-8 text-nanda-primary" />
					</div>
					<h1 class="text-2xl font-bold text-nanda-text">{message}</h1>
					<p class="text-sm text-nanda-text-muted">{subtitle}</p>
					<button
						class="nanda-btn-primary w-full"
						onclick={() => (window.location.href = '/admin')}
					>
						Go to Admin
					</button>
				{:else}
					<!-- Loading State -->
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nanda-bg-elevated"
					>
						<div
							class="h-8 w-8 animate-spin rounded-full border-2 border-nanda-primary/30 border-t-nanda-primary"
						></div>
					</div>
					<h1 class="text-2xl font-bold text-nanda-text">{message}</h1>
					<p class="text-sm text-nanda-text-muted">{subtitle}</p>
				{/if}
			</div>
		</div>
	</div>
</div>
