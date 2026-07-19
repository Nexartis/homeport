<script lang="ts">
	import { Mail, MessageSquare, Building2, Code, ExternalLink } from 'lucide-svelte';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Contact | Homeport</title>
	<meta
		name="description"
		content="Get in touch with the Homeport team. Enterprise inquiries, developer support, or partnership requests."
	/>
	<meta property="og:title" content="Contact | Homeport" />
	<meta property="og:image" content="{page.data.registryUrl}/og/contact.png" />
	<meta
		property="og:description"
		content="Get in touch with the Homeport team. Enterprise inquiries, developer support, or partnership requests."
	/>
</svelte:head>

<!-- Hero -->
<section class="relative overflow-hidden py-20 pb-16 text-center">
	<div class="absolute inset-0 bg-gradient-to-b from-nanda-accent/[0.08] to-transparent"></div>
	<div class="relative z-10 mx-auto max-w-[1100px] px-4">
		<h1 class="text-[clamp(2rem,5vw,3.2rem)] font-extrabold mb-4 gradient-text">Let's Talk</h1>
		<p class="text-lg text-nanda-text-muted max-w-xl mx-auto">
			Whether you're building on the NANDA protocol, interested in enterprise infrastructure, or
			need developer support — we'd love to hear from you.
		</p>
	</div>
</section>

<!-- Contact Options -->
<section class="py-16">
	<div class="mx-auto max-w-4xl px-4">
		<div class="grid gap-6 md:grid-cols-2">
			<!-- Enterprise / Sales -->
			<div class="nanda-card p-8">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-nanda-primary/10 mb-4">
					<Building2 class="h-6 w-6 text-nanda-primary" />
				</div>
				<h2 class="text-xl font-bold text-nanda-text mb-2">Enterprise & Sales</h2>
				<p class="text-sm text-nanda-text-muted mb-6">
					Looking for dedicated NANDA Node infrastructure, custom SLAs, or a demo for your
					organization?
				</p>
				<a href="mailto:enterprise@nexartis.com" class="nanda-btn-primary w-full justify-center">
					<Mail class="h-4 w-4" />
					enterprise@nexartis.com
				</a>
			</div>

			<!-- Developer Support -->
			<div class="nanda-card p-8">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-nanda-accent/10 mb-4">
					<Code class="h-6 w-6 text-nanda-accent" />
				</div>
				<h2 class="text-xl font-bold text-nanda-text mb-2">Developer Support</h2>
				<p class="text-sm text-nanda-text-muted mb-6">
					Need help with the NANDA API, have a bug report, or want to contribute to the open
					protocol?
				</p>
				<a
					href="https://github.com/Nexartis"
					target="_blank"
					rel="noopener noreferrer"
					class="nanda-btn-secondary w-full justify-center"
				>
					<ExternalLink class="h-4 w-4" />
					GitHub Issues
				</a>
			</div>

			<!-- General -->
			<div class="nanda-card p-8 md:col-span-2">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 mb-4">
					<MessageSquare class="h-6 w-6 text-amber-400" />
				</div>
				<h2 class="text-xl font-bold text-nanda-text mb-2">General Inquiries</h2>
				<p class="text-sm text-nanda-text-muted mb-6">
					Have a question, feedback, or just want to say hello? Drop us a line.
				</p>
				<a href="mailto:hello@nexartis.com" class="nanda-btn-secondary w-full justify-center">
					<Mail class="h-4 w-4" />
					hello@nexartis.com
				</a>
			</div>
		</div>
	</div>
</section>
