<!--
  Unauthorized / Access Denied Page — NANDA branded

  Displayed when a user is authenticated but lacks the required role for a
  route protected by requireRole() / requireAnyRole() in the sentinel guards.
  Pegasus/sentinel routes under-privileged users here by default.

  This file is listed in cube-sentinel-v1's scaffoldFiles → it is preserved
  on every redeploy once the NANDA-owned version is present. A generic
  theme-neutral fallback lives in cube-sentinel-v1 and is only installed
  when this file is absent.
-->
<script lang="ts">
	import { ShieldOff, ArrowLeft } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Access Denied — Homeport</title>
	<meta name="description" content="You don't have permission to view this page" />
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="w-full max-w-md">
		<div class="nanda-card text-center">
			<div class="space-y-6">
				<div
					class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nanda-danger/20"
				>
					<ShieldOff class="h-8 w-8 text-nanda-danger" />
				</div>

				<div class="space-y-2">
					<h1 class="text-2xl font-bold text-nanda-text">
						Access <span class="gradient-text">Denied</span>
					</h1>
					<p class="text-sm text-nanda-text-muted">You don't have permission to view this page.</p>
					<p class="text-xs text-nanda-text-dim">
						If you believe this is an error, contact the site administrator.
					</p>
				</div>

				<div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
					<a href="/" class="nanda-btn-primary inline-flex items-center gap-2">
						<ArrowLeft class="h-4 w-4" />
						Back to Home
					</a>
					<a href="/auth" class="nanda-btn-secondary">Sign in as another user</a>
				</div>
			</div>
		</div>
	</div>
</div>
