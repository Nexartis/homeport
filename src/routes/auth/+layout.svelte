<!--
	Auth Layout — NANDA Node

	Minimal pass-through layout. The root `+layout.svelte` already provides the
	dark `bg-nanda-bg` background, the top navigation, and the footer. Each auth
	page (/auth, /auth/register, /auth/verified, /auth/magic-success) is self-
	contained and supplies its own `flex min-h-[80vh] items-center justify-center`
	wrapper plus `nanda-card` styling.

	This file exists so the `cube-sentinel-v1` scaffold installer preserves it
	on Pegasus deploy (scaffold files are install-once when absent, preserved
	when present) and does not overwrite NANDA with its generic white-card
	default.

	Do not add wrappers, backgrounds, cards, or navigation here — that would
	fight the per-page styling and the root layout chrome.
-->
<script lang="ts">
	const { children } = $props();
</script>

{@render children()}
