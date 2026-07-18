<!-- src/routes/auth/verified/+page.svelte -->
<!-- Safety net: the server load function always redirects (303) after
     promoting tokens to session cookies.  This client page renders only
     if the server redirect somehow fails (e.g. browser extension
     interference) and performs a hard redirect as a last resort. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { CircleCheckBig } from 'lucide-svelte';

	onMount(() => {
		// Fallback redirect if server redirect didn't work
		window.location.href = '/admin';
	});
</script>

<svelte:head>
	<title>Email Verified — Homeport</title>
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="nanda-card w-full max-w-md text-center">
		<div class="space-y-4">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nanda-success/20"
			>
				<CircleCheckBig class="h-8 w-8 text-nanda-success" />
			</div>
			<h1 class="text-2xl font-bold text-nanda-success">Email Verified!</h1>
			<p class="text-sm text-nanda-text-muted">Redirecting you now...</p>
			<div
				class="h-4 w-4 mx-auto animate-spin rounded-full border-2 border-nanda-primary/30 border-t-nanda-primary"
			></div>
		</div>
	</div>
</div>
