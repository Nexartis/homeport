<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { Menu, X, LogOut, ArrowLeft } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import WelcomeGate from '$lib/components/WelcomeGate.svelte';
	import HomeportMark from '$lib/components/HomeportMark.svelte';
	import { adminQuickAccessItems, isActiveRoute as isActive } from '$lib/config/nav';
	import { resolveCopy } from '$lib/config/welcome-gate-copy';

	const { data, children }: { data: LayoutData; children: Snippet } = $props();

	const user = $derived(data.user);
	const environment = $derived(data.environment);
	const isAdmin = $derived(data.isAdmin ?? false);
	let mobileMenuOpen = $state(false);
	let userMenuOpen = $state(false);

	// The WelcomeGate is a UI overlay only — real access control for protected
	// routes lives in `src/hooks.server.ts` (PROTECTED_ROUTES → 302/401) and
	// per-route load/action guards. Public marketing / NANDA read routes
	// (`/`, `/docs`, `/lookup`, `/search`, `/list`, `/resolve`, `/stats`,
	// `/health`, `/agentfacts/*`, `/agents`, `/about`, `/blog`, `/research`,
	// `/privacy`, `/terms`, `/.well-known/*`, …) must always render, so the
	// gate is scoped to an explicit allowlist of protected/owner surfaces.
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const gatedPathPrefixes = ['/admin', '/register', '/developers', '/owner-preferences'];
	const isGatedRoute = $derived(
		gatedPathPrefixes.some((prefix) => page.url.pathname.startsWith(prefix))
	);

	const settings = $derived(data.settings);
	const welcomeCopy = $derived(
		resolveCopy({
			welcomeHeadline: settings.welcomeHeadline,
			welcomeBody: settings.welcomeBody,
			authMode: settings.authMode,
			waitlistEnabled: settings.waitlistEnabled
		})
	);
	const welcomeGateEnabled = $derived(
		isGatedRoute &&
			!data.welcomeAck?.valid &&
			!user?.isAuthenticated &&
			settings.authMode !== 'open'
	);

	const navLinks = [
		{ href: '/agents', label: 'Explore' },
		{ href: '/docs', label: 'Docs' },
		{ href: '/blog', label: 'Learn' },
		{ href: '/about', label: 'About' }
	];

	/** Derive user initials from email */
	const userInitials = $derived.by(() => {
		const email = user?.email ?? '';
		const local = email.split('@')[0] ?? '';
		const parts = local.split(/[._\-+]/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return local.slice(0, 2).toUpperCase();
	});

	function isActiveRoute(href: string) {
		return isActive(page.url.pathname, href);
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	function handleGlobalClick(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (userMenuOpen && !target.closest('.user-menu-wrapper')) {
			userMenuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleGlobalClick} />

<WelcomeGate
	enabled={welcomeGateEnabled}
	copy={welcomeCopy}
	authMode={settings.authMode}
	waitlistEnabled={settings.waitlistEnabled}
	nodeName={settings.nodeName}
	brandLogoUrl={settings.brandLogoUrl}
	brandPrimaryColor={settings.brandPrimaryColor}
>
	<div class="min-h-screen bg-nanda-bg text-nanda-text flex flex-col">
		<!-- Navigation -->
		<nav
			class="border-b border-nanda-border/60 bg-nanda-bg/80 backdrop-blur-sm sticky top-0 z-50"
			aria-label="Primary"
		>
			<div class="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4">
				<!-- LEFT ZONE: Brand + Nav links -->
				<div class="flex items-center gap-1">
					<!-- Brand: Homeport (links home) -->
					<a
						href="/"
						class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 -ml-2 mr-4 transition-colors hover:bg-nanda-bg-muted group"
						aria-label="Homeport — home"
					>
						<HomeportMark size="lg" />
						<span
							class="hidden sm:inline text-sm font-bold tracking-wide text-nanda-text group-hover:text-white transition-colors leading-tight"
							>Homeport</span
						>
					</a>

					<!-- Nav links (desktop) -->
					<div class="hidden md:flex items-center gap-0.5">
						{#if isAdminRoute}
							<a
								href="/"
								class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
							>
								<ArrowLeft class="h-3.5 w-3.5" />
								Back to site
							</a>
						{:else}
							{#each navLinks as link}
								<a
									href={link.href}
									class="px-3 py-1.5 text-sm rounded-lg transition-colors {isActiveRoute(link.href)
										? 'text-white bg-nanda-bg-muted'
										: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
									>{link.label}</a
								>
							{/each}
							<a
								href="/contact"
								class="ml-2 px-3 py-1.5 text-sm rounded-lg border border-nanda-border/60 transition-colors {isActiveRoute(
									'/contact'
								)
									? 'text-white bg-nanda-bg-muted border-nanda-primary-500/40'
									: 'text-nanda-text-muted hover:text-nanda-text hover:border-nanda-text-dim hover:bg-nanda-bg-muted'}"
								>Get Involved</a
							>
						{/if}
					</div>
				</div>

				<!-- RIGHT ZONE: User avatar + mobile toggle -->
				<div class="flex items-center gap-2">
					{#if user?.isAuthenticated}
						<!-- Desktop: Avatar / initials button -->
						<div class="user-menu-wrapper relative hidden md:block">
							<button
								class="flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-colors {userMenuOpen
									? 'ring-2 ring-nanda-primary-500/50'
									: ''} {isAdmin
									? 'bg-nanda-primary-500/20 text-nanda-primary-400 hover:bg-nanda-primary-500/30'
									: 'bg-nanda-bg-elevated text-nanda-text-muted hover:bg-nanda-bg-muted hover:text-nanda-text'}"
								onclick={() => (userMenuOpen = !userMenuOpen)}
								aria-label="Account menu"
							>
								{userInitials}
							</button>
							{#if userMenuOpen}
								<div
									class="absolute right-0 top-full mt-2 w-56 rounded-xl border border-nanda-border bg-nanda-bg-elevated shadow-lg shadow-black/20 z-50"
									transition:slide={{ duration: 150 }}
								>
									<div class="px-3 py-2.5 border-b border-nanda-border">
										<p class="text-xs text-nanda-text-muted truncate">{user.email}</p>
										{#if isAdmin}
											<span
												class="inline-block mt-1 rounded-full bg-nanda-primary-500/20 px-1.5 py-0.5 text-[10px] font-medium text-nanda-primary-400 leading-none"
												>admin</span
											>
										{/if}
									</div>
									<!-- Developer section (all authenticated users) -->
									<div class="py-1.5">
										<a
											href="/developers/dashboard"
											class="flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors {isActiveRoute(
												'/developers/dashboard'
											)
												? 'text-nanda-primary-400 bg-nanda-primary-500/10'
												: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
											onclick={() => (userMenuOpen = false)}
										>
											API Keys
										</a>
									</div>
									<!-- Admin section (admin users only) -->
									{#if isAdmin}
										<div class="border-t border-nanda-border py-1.5">
											<a
												href="/admin"
												class="flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium transition-colors {isActiveRoute(
													'/admin'
												)
													? 'text-nanda-primary-400 bg-nanda-primary-500/10'
													: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
												onclick={() => (userMenuOpen = false)}
											>
												Admin Dashboard
											</a>
											{#each adminQuickAccessItems as item}
												<a
													href={item.href}
													class="flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors {isActiveRoute(
														item.href
													)
														? 'text-nanda-primary-400 bg-nanda-primary-500/10'
														: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
													onclick={() => (userMenuOpen = false)}
												>
													<item.icon class="h-3.5 w-3.5" />
													{item.label}
												</a>
											{/each}
										</div>
									{/if}
									<div class="border-t border-nanda-border py-1.5">
										<form method="POST" action="/api/auth/logout">
											<button
												type="submit"
												class="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
											>
												<LogOut class="h-3.5 w-3.5" />
												Log out
											</button>
										</form>
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<a
							href="/auth"
							class="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-nanda-border px-3 py-1.5 text-xs font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
						>
							Sign In
						</a>
					{/if}
					<!-- Mobile hamburger -->
					<button
						class="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
						aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
						aria-expanded={mobileMenuOpen}
					>
						{#if mobileMenuOpen}
							<X class="h-5 w-5" />
						{:else}
							<Menu class="h-5 w-5" />
						{/if}
					</button>
				</div>
			</div>

			<!-- Mobile menu -->
			{#if mobileMenuOpen}
				<div class="md:hidden border-t border-nanda-border/60" transition:slide={{ duration: 200 }}>
					<div class="px-4 py-4 space-y-1">
						{#if isAdminRoute}
							<a
								href="/"
								class="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors"
								onclick={closeMobileMenu}
							>
								<ArrowLeft class="h-3.5 w-3.5" />
								Back to site
							</a>
						{:else}
							{#each navLinks as link}
								<a
									href={link.href}
									class="block rounded-lg px-3 py-2.5 text-sm transition-colors {isActiveRoute(
										link.href
									)
										? 'text-white bg-nanda-bg-muted'
										: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
									onclick={closeMobileMenu}>{link.label}</a
								>
							{/each}
							<a
								href="/contact"
								class="block rounded-lg px-3 py-2.5 text-sm transition-colors {isActiveRoute(
									'/contact'
								)
									? 'text-white bg-nanda-bg-muted'
									: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
								onclick={closeMobileMenu}>Get Involved</a
							>
						{/if}
					</div>
					{#if user?.isAuthenticated}
						<!-- Developer links (all auth users) -->
						<div class="px-4 pb-2 border-t border-nanda-border/60 pt-2">
							<a
								href="/developers/dashboard"
								class="block rounded-lg px-3 py-2 text-sm transition-colors {isActiveRoute(
									'/developers/dashboard'
								)
									? 'text-nanda-primary-400 bg-nanda-primary-500/10'
									: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
								onclick={closeMobileMenu}>API Keys</a
							>
						</div>
						{#if isAdmin}
							<div class="px-4 pb-2 border-t border-nanda-border/60 pt-2">
								<a
									href="/admin"
									class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors {isActiveRoute(
										'/admin'
									)
										? 'text-nanda-primary-400 bg-nanda-primary-500/10'
										: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
									onclick={closeMobileMenu}>Admin Dashboard</a
								>
								{#each adminQuickAccessItems as item}
									<a
										href={item.href}
										class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors {isActiveRoute(
											item.href
										)
											? 'text-nanda-primary-400 bg-nanda-primary-500/10'
											: 'text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted'}"
										onclick={closeMobileMenu}
									>
										<item.icon class="h-3.5 w-3.5" />
										{item.label}
									</a>
								{/each}
							</div>
						{/if}
						<div class="px-4 pb-4 pt-2 border-t border-nanda-border/60">
							<form method="POST" action="/api/auth/logout">
								<button
									type="submit"
									class="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
								>
									<LogOut class="h-3.5 w-3.5" />
									Log out
								</button>
							</form>
						</div>
					{:else}
						<div class="px-4 pb-4 pt-2 border-t border-nanda-border/60">
							<a
								href="/auth"
								class="flex items-center justify-center rounded-lg border border-nanda-border px-3 py-2 text-xs font-medium text-nanda-text-muted hover:text-nanda-text hover:bg-nanda-bg-muted transition-colors w-full"
								onclick={closeMobileMenu}
							>
								Sign In
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</nav>

		<!-- Main content -->
		<main class="flex-1">
			{@render children()}
		</main>

		<!-- Footer (hidden on admin pages — admin layout has its own chrome) -->
		{#if !isAdminRoute}
			<footer class="border-t border-nanda-border/60 bg-nanda-bg">
				<div class="mx-auto max-w-[1100px] px-4 py-12">
					<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
						<!-- Brand -->
						<div class="flex flex-col gap-3">
							<div class="flex items-center gap-2">
								<HomeportMark />
								<span class="text-sm font-bold text-nanda-text">Homeport</span>
							</div>
							<p class="text-xs text-nanda-text-dim max-w-xs">
								An open-source, self-hostable NANDA node — trust and discovery infrastructure for AI
								agents. Built by Nexartis.
							</p>
							{#if environment !== 'production'}
								<div class="flex items-center gap-2 text-[10px] text-nanda-text-dim">
									<span class="font-mono uppercase tracking-wider">{environment}</span>
								</div>
							{/if}
						</div>

						<!-- Docs -->
						<div class="flex flex-col gap-3">
							<h3 class="text-xs font-semibold text-nanda-text uppercase tracking-wider">Docs</h3>
							<div class="flex flex-col gap-2 text-sm text-nanda-text-dim">
								<a href="/docs" class="hover:text-nanda-text-muted transition-colors"
									>Documentation</a
								>
								<a href="/docs/api" class="hover:text-nanda-text-muted transition-colors"
									>API Reference</a
								>
								<a href="/agents" class="hover:text-nanda-text-muted transition-colors"
									>Agent Registry</a
								>
								<a href="/developers" class="hover:text-nanda-text-muted transition-colors"
									>Developer Portal</a
								>
							</div>
						</div>

						<!-- Learn -->
						<div class="flex flex-col gap-3">
							<h3 class="text-xs font-semibold text-nanda-text uppercase tracking-wider">Learn</h3>
							<div class="flex flex-col gap-2 text-sm text-nanda-text-dim">
								<a href="/blog" class="hover:text-nanda-text-muted transition-colors">Blog</a>
								<a href="/research" class="hover:text-nanda-text-muted transition-colors"
									>Research</a
								>
								<a href="/series/agentic-web" class="hover:text-nanda-text-muted transition-colors"
									>The Agentic Web</a
								>
								<a href="/case-studies" class="hover:text-nanda-text-muted transition-colors"
									>Case Studies</a
								>
							</div>
						</div>

						<!-- Connect -->
						<div class="flex flex-col gap-3">
							<h3 class="text-xs font-semibold text-nanda-text uppercase tracking-wider">
								Connect
							</h3>
							<div class="flex flex-col gap-2 text-sm text-nanda-text-dim">
								<a href="/contact" class="hover:text-nanda-text-muted transition-colors"
									>Get Involved</a
								>
								<a href="/about" class="hover:text-nanda-text-muted transition-colors">About</a>
								<a
									href="https://nexartis.com"
									target="_blank"
									rel="noopener"
									class="hover:text-nanda-text-muted transition-colors">Nexartis ↗</a
								>
								<a
									href="https://github.com/Nexartis"
									target="_blank"
									rel="noopener"
									class="hover:text-nanda-text-muted transition-colors">GitHub ↗</a
								>
							</div>
						</div>
					</div>

					<!-- Bottom bar -->
					<div
						class="mt-8 pt-6 border-t border-nanda-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-nanda-text-dim"
					>
						<p>© {new Date().getFullYear()} Nexartis. All rights reserved.</p>
						<div class="flex items-center gap-4">
							<a href="/privacy" class="hover:text-nanda-text-muted transition-colors">Privacy</a>
							<a href="/terms" class="hover:text-nanda-text-muted transition-colors">Terms</a>
						</div>
					</div>
				</div>
			</footer>
		{/if}
	</div>
</WelcomeGate>
