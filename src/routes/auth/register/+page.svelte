<script lang="ts">
	import { validateEmail } from '$lib/utils/validation';

	// ==========================================================================
	// STATE
	// ==========================================================================

	// Form state
	let email = $state('');
	let loading = $state(false);
	let success = $state(false);
	let error = $state('');

	// Validation state
	let emailError = $state('');
	let emailTouched = $state(false);
	let isFormValid = $state(false);

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
	// REGISTRATION
	// ==========================================================================

	async function handleSubmit(event: Event) {
		event.preventDefault();
		emailTouched = true;
		validateForm();

		if (!isFormValid) return;

		loading = true;
		error = '';
		success = false;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim() })
			});

			const result = (await response.json()) as {
				code?: number;
				message?: string;
				success?: boolean;
				error?: string | { message?: string; issues?: Array<{ message: string }> };
			};

			if (response.ok && result.success) {
				success = true;
			} else if (result.error) {
				if (
					typeof result.error === 'object' &&
					result.error.issues &&
					result.error.issues.length > 0
				) {
					error = result.error.issues[0].message || 'Registration failed';
				} else if (typeof result.error === 'string') {
					error = result.error;
				} else if (typeof result.error === 'object' && result.error.message) {
					error = result.error.message;
				} else {
					error = 'Registration failed';
				}
			} else {
				error = result.message || 'Registration failed';
			}
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Create Account — Homeport</title>
	<meta name="description" content="Create your Homeport admin account" />
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="w-full max-w-md">
		<div class="nanda-card">
			<div class="space-y-6">
				<!-- Header -->
				<div class="space-y-2 text-center">
					<h1 class="text-2xl font-bold text-nanda-text">Create Account</h1>
					<p class="text-sm text-nanda-text-muted">Enter your email to create your account</p>
				</div>

				<!-- Error Message -->
				{#if error}
					<div class="rounded-xl border border-nanda-danger/20 bg-nanda-danger/10 px-4 py-3">
						<p class="text-sm text-red-200">{error}</p>
					</div>
				{/if}

				<!-- Success Message -->
				{#if success}
					<div class="space-y-4">
						<div
							class="rounded-xl border border-nanda-success/20 bg-nanda-success/10 px-4 py-3 space-y-2"
						>
							<p class="text-sm text-emerald-200">
								Registration successful! Please check your email to verify your account.
							</p>
							<p class="text-xs text-emerald-300/70">
								Once verified, you can <a href="/auth" class="underline font-medium">sign in</a> to access
								the admin dashboard.
							</p>
						</div>

						<button
							class="nanda-btn-secondary w-full"
							onclick={() => (window.location.href = '/auth')}
						>
							Sign In
						</button>
					</div>
				{:else}
					<!-- Registration Form -->
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
								Creating Account...
							{:else}
								Create Account
							{/if}
						</button>

						{#if !isFormValid && emailTouched}
							<p class="text-center text-xs text-nanda-danger" role="alert">
								Please fix the errors above before submitting.
							</p>
						{/if}
					</form>

					<!-- Login Link -->
					<div class="text-center">
						<p class="text-sm text-nanda-text-dim">
							Already have an account?
							<a href="/auth" class="font-medium text-nanda-accent hover:text-nanda-accent-300">
								Sign in here
							</a>
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
