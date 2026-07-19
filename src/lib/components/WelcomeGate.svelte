<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShieldCheck, Mail, Send, LoaderCircle } from 'lucide-svelte';
	import type { WelcomeGateCopy } from '$lib/config/welcome-gate-copy';
	import type { AuthMode } from '$lib/services/node-settings/types';

	interface Props {
		/** Wrapped page content — always rendered beneath the cover. */
		children: Snippet;
		/** When false the component renders children directly with no cover. */
		enabled?: boolean;
		/** Resolved copy (defaults merged with operator overrides). */
		copy: WelcomeGateCopy;
		/** Current node auth mode — drives CTA visibility. */
		authMode: AuthMode;
		/** Whether the waitlist submit CTA should be offered (invite mode only). */
		waitlistEnabled: boolean;
		nodeName?: string | null;
		brandLogoUrl?: string | null;
		brandPrimaryColor?: string | null;
	}

	const {
		children,
		enabled = true,
		copy,
		authMode,
		waitlistEnabled,
		nodeName = null,
		brandLogoUrl = null,
		brandPrimaryColor = null
	}: Props = $props();

	// `open` mode is public-public — never gate.
	const coverActive = $derived(enabled && (authMode === 'solo' || authMode === 'invite'));

	const showWaitlistCta = $derived(coverActive && authMode === 'invite' && waitlistEnabled);

	// Local UI state — SSR safe (only mutated on client click handlers).
	type View = 'idle' | 'form' | 'submitting' | 'success' | 'error';
	let view = $state<View>('idle');
	let email = $state('');
	let note = $state('');
	let errorMsg = $state('');

	// Inline brand primary-color override via CSS custom property.
	const brandStyle = $derived(
		brandPrimaryColor ? `--welcome-gate-accent: ${brandPrimaryColor};` : ''
	);

	function isValidEmail(raw: string): boolean {
		const trimmed = raw.trim();
		if (!trimmed || /\s/.test(trimmed)) return false;
		return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
	}

	async function submitWaitlist(e: Event) {
		e.preventDefault();
		if (view === 'submitting') return;
		errorMsg = '';
		if (!isValidEmail(email)) {
			errorMsg = 'Please enter a valid email address.';
			return;
		}
		view = 'submitting';
		try {
			const res = await fetch('/api/public/waitlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: email.trim().toLowerCase(),
					note: note.trim() || undefined
				})
			});
			if (res.status === 404) {
				errorMsg = 'The waitlist is not accepting requests right now.';
				view = 'error';
				return;
			}
			if (res.status === 429) {
				errorMsg = 'Too many requests — please try again later.';
				view = 'error';
				return;
			}
			if (!res.ok) {
				errorMsg = 'Something went wrong. Please try again.';
				view = 'error';
				return;
			}
			view = 'success';
		} catch {
			errorMsg = 'Network error — please try again.';
			view = 'error';
		}
	}

	function openForm() {
		view = 'form';
		errorMsg = '';
	}
</script>

<div class="relative" style={brandStyle}>
	<div class="welcome-content {coverActive ? 'pointer-events-none' : ''}">
		{@render children()}
	</div>

	{#if coverActive}
		<div class="welcome-overlay fixed inset-0 z-[9999] overflow-y-auto">
			<div class="welcome-backdrop absolute inset-0"></div>
			<div class="relative flex min-h-full items-center justify-center p-6">
				<div class="welcome-panel w-full max-w-md">
					<div class="flex flex-col items-center text-center">
						{#if brandLogoUrl}
							<img
								src={brandLogoUrl}
								alt={nodeName ?? 'Node logo'}
								class="h-12 w-auto mb-4"
								loading="lazy"
							/>
						{:else}
							<div class="welcome-icon mb-4">
								<ShieldCheck size={28} />
							</div>
						{/if}

						{#if view === 'success'}
							<h1 class="welcome-headline">{copy.waitlistSuccessHeadline}</h1>
							<p class="welcome-body">{copy.waitlistSuccessBody}</p>
						{:else}
							<h1 class="welcome-headline">{copy.headline}</h1>
							<p class="welcome-body">{copy.body}</p>
						{/if}
					</div>

					{#if view !== 'success'}
						<div class="mt-6 flex flex-col gap-3">
							{#if view === 'form' || view === 'submitting'}
								<form onsubmit={submitWaitlist} class="flex flex-col gap-3">
									<label class="welcome-field">
										<span class="welcome-field-label">Email</span>
										<input
											type="email"
											bind:value={email}
											placeholder="you@example.com"
											autocomplete="email"
											required
											class="welcome-input"
										/>
									</label>
									<label class="welcome-field">
										<span class="welcome-field-label">Note (optional)</span>
										<textarea
											bind:value={note}
											rows="2"
											maxlength="500"
											placeholder="Anything we should know?"
											class="welcome-input welcome-textarea"
										></textarea>
									</label>
									{#if errorMsg}
										<p class="welcome-error">{errorMsg}</p>
									{/if}
									<button
										type="submit"
										disabled={view === 'submitting'}
										class="welcome-btn welcome-btn-primary"
									>
										{#if view === 'submitting'}
											<LoaderCircle size={16} class="welcome-spin" />
										{:else}
											<Send size={16} />
										{/if}
										<span>Submit request</span>
									</button>
									<button
										type="button"
										onclick={() => (view = 'idle')}
										class="welcome-btn welcome-btn-ghost"
									>
										Cancel
									</button>
								</form>
							{:else}
								<a href="/auth" class="welcome-btn welcome-btn-primary">
									<ShieldCheck size={16} />
									<span>{copy.loginCta}</span>
								</a>

								{#if showWaitlistCta}
									<button
										type="button"
										onclick={openForm}
										class="welcome-btn welcome-btn-secondary"
									>
										<Mail size={16} />
										<span>{copy.waitlistCta}</span>
									</button>
								{/if}

								{#if view === 'error' && errorMsg}
									<p class="welcome-error">{errorMsg}</p>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(:root) {
		--welcome-gate-accent: var(--nanda-accent-500, #6942e6);
	}

	.welcome-overlay {
		color: var(--nanda-text, #f5f5f7);
	}

	.welcome-backdrop {
		background:
			radial-gradient(circle at 20% 20%, rgba(105, 66, 230, 0.18), transparent 50%),
			radial-gradient(circle at 80% 80%, rgba(12, 211, 218, 0.12), transparent 55%), #0b0b10;
		backdrop-filter: blur(18px);
	}

	.welcome-panel {
		position: relative;
		border-radius: 1rem;
		padding: 2rem;
		background: rgba(19, 19, 26, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
		pointer-events: auto;
	}

	.welcome-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(105, 66, 230, 0.12);
		border: 1px solid rgba(105, 66, 230, 0.35);
		color: var(--welcome-gate-accent);
	}

	.welcome-headline {
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1.2;
		margin: 0 0 0.5rem 0;
		color: #f9fafb;
	}

	.welcome-body {
		font-size: 0.95rem;
		line-height: 1.55;
		color: #d1d5db;
		margin: 0;
	}

	.welcome-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		text-align: left;
	}

	.welcome-field-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #9ca3af;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.welcome-input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border-radius: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(15, 15, 22, 0.85);
		color: #fafafa;
		font-size: 0.875rem;
		outline: none;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.welcome-input::placeholder {
		color: rgba(148, 163, 184, 0.6);
	}

	.welcome-input:focus {
		border-color: var(--welcome-gate-accent);
		box-shadow: 0 0 0 3px rgba(105, 66, 230, 0.2);
	}

	.welcome-textarea {
		resize: vertical;
		min-height: 60px;
	}

	.welcome-error {
		margin: 0;
		font-size: 0.8125rem;
		color: #f87171;
	}

	.welcome-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		font-size: 0.9rem;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			opacity 0.15s,
			transform 0.1s;
	}

	.welcome-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.welcome-btn-primary {
		background: var(--welcome-gate-accent);
		color: #ffffff;
	}

	.welcome-btn-primary:hover:not(:disabled) {
		filter: brightness(1.08);
		transform: translateY(-1px);
	}

	.welcome-btn-secondary {
		background: transparent;
		color: #e5e7eb;
		border-color: rgba(255, 255, 255, 0.14);
	}

	.welcome-btn-secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.04);
	}

	.welcome-btn-ghost {
		background: transparent;
		color: #9ca3af;
	}

	.welcome-btn-ghost:hover:not(:disabled) {
		color: #e5e7eb;
	}

	:global(.welcome-spin) {
		animation: welcome-spin 0.9s linear infinite;
	}

	@keyframes welcome-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
