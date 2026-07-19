<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { validateEmail } from '$lib/utils/validation';
	import { CircleCheckBig, RefreshCw } from 'lucide-svelte';

	// ==========================================================================
	// PROPS & STATE
	// ==========================================================================

	// URL params are read directly from `page.url.searchParams` so the login UI
	// does not depend on /auth/+page.server.ts (which is owned by the sentinel
	// SDK and overwritten on every Pegasus deploy). `isSingleOwner` is read
	// from the root layout's server load — see src/routes/+layout.server.ts.
	const isSingleOwner = $derived<boolean>(Boolean(page.data.isSingleOwner));
	const urlError = $derived(page.url.searchParams.get('error'));
	const urlSuccess = $derived(page.url.searchParams.get('success'));
	const urlReason = $derived(page.url.searchParams.get('reason'));
	const urlRedirectTo = $derived(page.url.searchParams.get('redirect'));

	// Form state
	let email = $state('');
	let rememberMe = $state(true);
	let emailTouched = $state(false);
	let emailError = $state('');
	let isFormValid = $state(false);

	// UI state
	let loading = $state(false);
	let loginSent = $state(false);
	let polling = $state(false);
	let error = $state('');
	let successMessage = $state('');
	let statusMessage = $state('');

	// Polling state
	let pollingAttempts = $state(0);
	let pollInterval: ReturnType<typeof setTimeout> | null = null;
	let autoCloseSeconds = $state(5);
	const MAX_POLLING_ATTEMPTS = 150; // 5 minutes (150 × 2 seconds)

	// ==========================================================================
	// LIFECYCLE
	// ==========================================================================

	$effect(() => {
		if (!browser) return;
		if (urlSuccess) {
			const successParam = decodeURIComponent(urlSuccess);
			if (successParam === 'magic_link_clicked') {
				successMessage = 'Magic link verified!';
				startAutoCloseCountdown();
			}
		} else if (urlError) {
			error = decodeURIComponent(urlError);
		} else if (urlReason === 'session_expired') {
			error = 'Your session has expired. Please log in again.';
		} else if (urlReason === 'unauthorized') {
			error = 'Please log in to access this page.';
		} else if (urlReason === 'not_invited') {
			error =
				"This email isn't on the invite list yet. Ask an admin to invite you, or contact support.";
		} else if (urlReason === 'revoked') {
			error = 'Your access has been revoked. Contact an admin if you think this is a mistake.';
		} else if (urlReason === 'waitlisted') {
			error = "You're on the waitlist. We'll email you when your spot opens up.";
		} else if (urlReason === 'invite_expired') {
			error = 'Your invitation has expired. Ask an admin to resend it.';
		} else if (urlReason === 'solo_mode') {
			error =
				'This node is running in single-owner mode. Only the site owner can sign in right now.';
		}

		return () => {
			stopPolling();
		};
	});

	// ==========================================================================
	// VALIDATION (inline — no external validation library in NANDA)
	// ==========================================================================

	function validateForm() {
		const result = validateEmail(email);
		emailError = result.emailError;
		isFormValid = result.isFormValid;
	}

	function handleEmailBlur() {
		emailTouched = true;
		validateForm();
	}

	function handleEmailInput() {
		if (emailTouched) validateForm();
		if (error) error = '';
	}

	// ==========================================================================
	// AUTHENTICATION
	// ==========================================================================

	async function handleSubmit(event: Event) {
		event.preventDefault();
		emailTouched = true;
		validateForm();

		if (!isFormValid) return;

		loading = true;
		error = '';

		try {
			const body: { email: string; rememberMe: boolean; redirectTo?: string } = {
				email: email.trim(),
				rememberMe
			};
			// Forward the requested redirect so the SDK writes the
			// `login_redirect_to` cookie and `resolveRedirect` can honour it.
			if (urlRedirectTo && urlRedirectTo.startsWith('/') && !urlRedirectTo.startsWith('//')) {
				body.redirectTo = urlRedirectTo;
			}
			const response = await fetch('/api/auth/start-login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			// If the SDK's `onBeforeLogin` rejected with a 303 to a branded
			// `/auth?reason=...` destination, `fetch` will transparently follow
			// the redirect. Detect that and navigate the browser so the reason
			// banner is surfaced to the user.
			if (response.redirected) {
				const target = new URL(response.url);
				if (target.pathname.startsWith('/auth')) {
					window.location.href = target.pathname + target.search;
					return;
				}
			}

			const result = (await response.json()) as {
				success?: boolean;
				error?: string;
				message?: string;
			};

			if (result.success) {
				loginSent = true;
				polling = true;
				statusMessage = result.message || 'Check your email for a sign-in link!';
				startPolling();
			} else {
				error = result.error || 'Failed to send magic link';
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	// ==========================================================================
	// POLLING
	// ==========================================================================

	async function startPolling() {
		pollingAttempts = 0;
		polling = true;
		statusMessage = 'Waiting for you to click the magic link...';

		const poll = async () => {
			if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
				error = 'Login timeout. Please try again.';
				stopPolling();
				return;
			}

			pollingAttempts++;

			try {
				const response = await fetch('/api/auth/poll', { method: 'POST' });
				const result = (await response.json()) as { status: string; redirectTo?: string };

				if (result.status === 'completed') {
					statusMessage = 'Magic link clicked! Completing sign-in...';
					stopPolling();
					setTimeout(() => {
						const safeRedirect =
							urlRedirectTo && urlRedirectTo.startsWith('/') && !urlRedirectTo.startsWith('//')
								? urlRedirectTo
								: '/admin';
						window.location.href = result.redirectTo || safeRedirect;
					}, 1000);
					return;
				} else if (result.status === 'pending') {
					updatePollingStatusMessage();
				} else if (result.status === 'expired') {
					error = 'Login session expired. Please try again.';
					stopPolling();
					return;
				}
			} catch {
				console.error('Polling error');
			}

			pollInterval = setTimeout(poll, 2000);
		};

		poll();
	}

	function stopPolling() {
		polling = false;
		if (pollInterval) {
			clearTimeout(pollInterval);
			pollInterval = null;
		}
	}

	function updatePollingStatusMessage() {
		const minutes = Math.floor((pollingAttempts * 2) / 60);
		const seconds = (pollingAttempts * 2) % 60;
		if (minutes > 0) {
			statusMessage = `Waiting for magic link click... (${minutes}m ${seconds}s)`;
		} else {
			statusMessage = `Waiting for magic link click... (${seconds}s)`;
		}
	}

	function resetForm() {
		loginSent = false;
		polling = false;
		error = '';
		statusMessage = '';
		pollingAttempts = 0;
		stopPolling();
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	function startAutoCloseCountdown() {
		const countdownInterval = setInterval(() => {
			autoCloseSeconds--;
			if (autoCloseSeconds <= 0) {
				clearInterval(countdownInterval);
				window.close();
			}
		}, 1000);
	}
</script>

<svelte:head>
	<title>Sign In — Homeport</title>
	<meta name="description" content="Sign in to the Homeport admin dashboard" />
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="w-full max-w-md space-y-6">
		<!-- Success Message (Magic Link Verified in another tab) -->
		{#if successMessage}
			<div class="nanda-card border-nanda-success/20">
				<div class="space-y-4 text-center">
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-nanda-success/20"
					>
						<CircleCheckBig class="h-8 w-8 text-nanda-success" />
					</div>
					<h2 class="text-2xl font-bold text-nanda-success">{successMessage}</h2>
					<p class="text-sm text-nanda-text-muted">
						You can now return to your original browser window.
					</p>
					<p class="text-xs text-nanda-text-dim">
						This window will close automatically in <strong class="text-nanda-text"
							>{autoCloseSeconds}</strong
						> seconds.
					</p>
					<button class="nanda-btn-secondary" onclick={() => window.close()}> Close Window </button>
				</div>
			</div>
		{/if}

		<!-- Main Login Card -->
		{#if !successMessage}
			<div class="nanda-card">
				<div class="space-y-6">
					<!-- Header -->
					<div class="space-y-2 text-center">
						<h1 class="text-2xl font-bold text-nanda-text">
							Sign <span class="gradient-text">In</span>
						</h1>
						<p class="text-sm text-nanda-text-muted">
							Enter your email to receive a secure sign-in link
						</p>
					</div>

					<!-- Error Message -->
					{#if error && !loginSent}
						<div class="rounded-xl border border-nanda-danger/20 bg-nanda-danger/10 px-4 py-3">
							<p class="text-sm text-red-200">{error}</p>
						</div>
					{/if}

					<!-- Email Sent Status -->
					{#if loginSent}
						<div class="space-y-4">
							<div
								class="rounded-xl border border-nanda-primary/20 bg-nanda-primary/10 px-4 py-4 text-center"
							>
								<h2 class="mb-2 text-lg font-semibold text-nanda-text">Check Your Email</h2>
								<p class="text-sm text-nanda-text-muted">
									We've sent a magic link to <strong class="text-nanda-accent">{email}</strong>.
								</p>
								<p class="mt-1 text-xs text-nanda-text-dim">
									Click the link in your email to complete sign-in.
								</p>
							</div>

							<!-- Polling Status -->
							{#if polling}
								<div class="rounded-xl border border-nanda-border bg-nanda-bg-elevated px-4 py-3">
									<div class="flex items-center justify-center gap-3">
										<div
											class="h-4 w-4 animate-spin rounded-full border-2 border-nanda-primary/30 border-t-nanda-primary"
										></div>
										<p class="text-sm text-nanda-text-muted">{statusMessage}</p>
									</div>
									<p class="mt-2 text-center text-xs text-nanda-text-dim">
										Checking every 2 seconds...
									</p>
								</div>
							{/if}

							<!-- Polling Error -->
							{#if error}
								<div class="rounded-xl border border-nanda-danger/20 bg-nanda-danger/10 px-4 py-3">
									<p class="mb-2 text-sm text-red-200">{error}</p>
									<button
										onclick={resetForm}
										class="mx-auto flex items-center gap-1 text-sm font-medium text-nanda-accent hover:text-nanda-accent-300"
									>
										<RefreshCw class="h-4 w-4" />
										Try Again
									</button>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Login Form -->
					{#if !loginSent}
						<form onsubmit={handleSubmit} class="space-y-4">
							<!-- Email Input -->
							<div class="space-y-2">
								<label for="email" class="block text-sm font-medium text-nanda-text-muted">
									Email Address
								</label>
								<input
									type="email"
									id="email"
									bind:value={email}
									onblur={handleEmailBlur}
									oninput={handleEmailInput}
									disabled={loading}
									required
									placeholder="name@company.com"
									class="w-full rounded-lg border px-4 py-2.5 text-nanda-text placeholder:text-nanda-text-dim transition-colors focus:outline-none focus:ring-1 {emailError &&
									emailTouched
										? 'border-nanda-danger/50 bg-nanda-bg-elevated focus:border-nanda-danger focus:ring-nanda-danger/50'
										: 'border-nanda-border bg-nanda-bg-elevated focus:border-nanda-primary-400 focus:ring-nanda-primary-400/50'}"
									aria-describedby={emailError ? 'email-error' : undefined}
								/>
								{#if emailError && emailTouched}
									<p id="email-error" class="text-xs text-nanda-danger" role="alert">
										{emailError}
									</p>
								{/if}
							</div>

							<!-- Remember Me -->
							<div class="flex items-center gap-2">
								<input
									type="checkbox"
									id="rememberMe"
									bind:checked={rememberMe}
									disabled={loading}
									class="h-4 w-4 rounded border-nanda-border bg-nanda-bg-elevated text-nanda-primary focus:ring-2 focus:ring-nanda-primary-400 focus:ring-offset-0"
								/>
								<label for="rememberMe" class="text-sm text-nanda-text-dim">
									Keep me signed in for 7 days
								</label>
							</div>

							<!-- Submit Button -->
							<button
								type="submit"
								disabled={loading || (!isFormValid && emailTouched)}
								class="nanda-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{#if loading}
									<div
										class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
									></div>
									Sending Link...
								{:else}
									Send Sign-In Link
								{/if}
							</button>

							{#if !isFormValid && emailTouched}
								<p class="text-center text-xs text-nanda-danger" role="alert">
									Please fix the errors above before submitting.
								</p>
							{/if}
						</form>

						<!-- Register Link (hidden in single-owner / Pegasus mode) -->
						{#if !isSingleOwner}
							<div class="text-center">
								<p class="text-sm text-nanda-text-dim">
									Don't have an account?
									<a
										href="/auth/register"
										class="font-medium text-nanda-accent hover:text-nanda-accent-300"
									>
										Register here
									</a>
								</p>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
