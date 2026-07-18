<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import 'swagger-ui-dist/swagger-ui.css';

	let containerElement: HTMLElement | undefined;
	let spec: Record<string, unknown> | undefined = $state();
	let loading = $state(true);

	const currentOrigin = $derived(page.url.origin);

	const specWithServer = $derived(
		spec
			? {
					...spec,
					servers: [
						{
							url: currentOrigin,
							description: dev ? 'Development server' : 'Production server'
						}
					]
				}
			: undefined
	);

	async function initializeSwaggerUI() {
		if (!containerElement) return;
		try {
			try {
				const virtualSpec = await import('virtual:openapi-spec');
				spec = virtualSpec?.default ?? virtualSpec;
			} catch {
				try {
					const res = await fetch('/openapi.json');
					if (res.ok) spec = await res.json();
					else
						spec = {
							openapi: '3.0.0',
							info: { title: 'NANDA Node API', version: '1.0.0' },
							paths: {}
						};
				} catch {
					spec = {
						openapi: '3.0.0',
						info: { title: 'NANDA Node API', version: '1.0.0' },
						paths: {}
					};
				}
			}

			const swaggerModule = await import('swagger-ui-dist');
			const SwaggerUIBundle =
				swaggerModule.SwaggerUIBundle ?? swaggerModule.default?.SwaggerUIBundle;
			const SwaggerUIStandalonePreset =
				swaggerModule.SwaggerUIStandalonePreset ?? swaggerModule.default?.SwaggerUIStandalonePreset;

			if (typeof SwaggerUIBundle !== 'function' || !SwaggerUIBundle.presets?.apis) {
				throw new Error(
					'SwaggerUIBundle failed to load — swagger-ui-dist may be missing or corrupted'
				);
			}

			const presets = [SwaggerUIBundle.presets.apis];
			if (SwaggerUIStandalonePreset) presets.push(SwaggerUIStandalonePreset);

			// Activate Swagger UI's built-in dark-mode selectors
			document.documentElement.classList.add('dark-mode');

			SwaggerUIBundle({
				spec: specWithServer,
				domNode: containerElement,
				deepLinking: true,
				presets
			});
		} catch (error) {
			console.error('Failed to initialize Swagger UI:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		initializeSwaggerUI();
	});
</script>

<svelte:head>
	<title>API Reference — Homeport</title>
	<meta name="description" content="Interactive OpenAPI documentation for the Homeport REST API." />
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-api.png" />
</svelte:head>

<div class="prose">
	<h1>API Reference</h1>
	<p>Interactive OpenAPI documentation generated from endpoint annotations.</p>
</div>

{#if loading}
	<div class="flex items-center justify-center py-20 text-nanda-text-muted">
		<span class="animate-pulse">Loading API documentation…</span>
	</div>
{/if}

<div class="swagger-container rounded-xl border border-nanda-border overflow-hidden mt-6">
	<div id="swagger-ui-container" bind:this={containerElement}></div>
</div>

<div class="mt-8 text-center text-xs text-nanda-text-dim">
	<a href="/docs/a2a" class="hover:text-nanda-text-muted">A2A Protocol</a> ·
	<a href="/docs/federation" class="hover:text-nanda-text-muted">Federation</a> ·
	<a href="/docs/trust" class="hover:text-nanda-text-muted">Trust &amp; Security</a>
</div>

<div class="prose mt-8">
	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/developer-api-keys">Developer API Keys</a> — authentication, rate limits, and
		scopes for the API ·
		<a href="/blog/nanda-a2a-mcp">NANDA Meets A2A &amp; MCP</a> — how the REST API, A2A, and MCP endpoints
		fit together
	</div>
</div>

<style>
	.swagger-container {
		min-height: 400px;
	}

	/* ===== NANDA dark-mode overrides for Swagger UI ===== */

	/* Hide default top bar */
	:global(.swagger-ui .topbar) {
		display: none;
	}

	/* Root background & text — map to NANDA surface */
	:global(html.dark-mode .swagger-ui) {
		background: transparent;
		color: var(--color-nanda-text);
	}

	/* Info section */
	:global(html.dark-mode .swagger-ui .info .title),
	:global(html.dark-mode .swagger-ui .info h1),
	:global(html.dark-mode .swagger-ui .info h2),
	:global(html.dark-mode .swagger-ui .info h3) {
		color: var(--color-nanda-text);
	}
	:global(html.dark-mode .swagger-ui .info .base-url),
	:global(html.dark-mode .swagger-ui .info li),
	:global(html.dark-mode .swagger-ui .info p),
	:global(html.dark-mode .swagger-ui .info table) {
		color: var(--color-nanda-text-muted);
	}
	:global(html.dark-mode .swagger-ui .info a) {
		color: var(--color-nanda-accent);
	}
	:global(html.dark-mode .swagger-ui .info .title small) {
		background: var(--color-nanda-bg-surface);
	}
	:global(html.dark-mode .swagger-ui .info .title small.version-stamp) {
		background: var(--color-nanda-primary-500);
	}

	/* Scheme container (server selector) */
	:global(html.dark-mode .swagger-ui .scheme-container) {
		background: var(--color-nanda-bg-surface);
		box-shadow: none;
		border-bottom: 1px solid var(--color-nanda-border);
	}
	:global(
		html.dark-mode .swagger-ui .scheme-container .schemes > .schemes-server-container > label
	) {
		color: var(--color-nanda-text-muted);
	}
	:global(html.dark-mode .swagger-ui .scheme-container .btn.authorize) {
		border-color: var(--color-nanda-accent);
		color: var(--color-nanda-accent);
	}
	:global(html.dark-mode .swagger-ui .scheme-container .btn.authorize svg) {
		fill: var(--color-nanda-accent);
	}

	/* Inputs & selects */
	:global(html.dark-mode .swagger-ui input) {
		background: var(--color-nanda-bg);
		border-color: var(--color-nanda-border);
		color: var(--color-nanda-text);
	}
	:global(html.dark-mode .swagger-ui select) {
		background-color: var(--color-nanda-bg);
		border-color: var(--color-nanda-border);
		color: var(--color-nanda-text);
	}
	:global(html.dark-mode .swagger-ui textarea) {
		background: var(--color-nanda-bg);
		border-color: var(--color-nanda-border);
		color: var(--color-nanda-text);
	}

	/* Operation tag headings */
	:global(html.dark-mode .swagger-ui .opblock-tag) {
		border-bottom-color: var(--color-nanda-border);
		color: var(--color-nanda-text);
	}
	:global(html.dark-mode .swagger-ui .opblock-tag small) {
		color: var(--color-nanda-text-muted);
	}
	:global(html.dark-mode .swagger-ui .opblock-tag a.link) {
		color: var(--color-nanda-accent);
	}

	/* Operation blocks — tint with NANDA surface */
	:global(html.dark-mode .swagger-ui .opblock.opblock-get) {
		background: color-mix(in srgb, #55a1ff 6%, var(--color-nanda-bg-surface));
		border-color: color-mix(in srgb, #55a1ff 20%, var(--color-nanda-border));
	}
	:global(html.dark-mode .swagger-ui .opblock.opblock-post) {
		background: color-mix(in srgb, #00b572 6%, var(--color-nanda-bg-surface));
		border-color: color-mix(in srgb, #00b572 20%, var(--color-nanda-border));
	}
	:global(html.dark-mode .swagger-ui .opblock.opblock-put) {
		background: color-mix(in srgb, #ff7d35 6%, var(--color-nanda-bg-surface));
		border-color: color-mix(in srgb, #ff7d35 20%, var(--color-nanda-border));
	}
	:global(html.dark-mode .swagger-ui .opblock.opblock-delete) {
		background: color-mix(in srgb, #eb6156 6%, var(--color-nanda-bg-surface));
		border-color: color-mix(in srgb, #eb6156 20%, var(--color-nanda-border));
	}
	:global(html.dark-mode .swagger-ui .opblock.opblock-patch) {
		background: color-mix(in srgb, #03b7bf 6%, var(--color-nanda-bg-surface));
		border-color: color-mix(in srgb, #03b7bf 20%, var(--color-nanda-border));
	}

	/* Section headers inside operations */
	:global(html.dark-mode .swagger-ui .opblock .opblock-section-header) {
		background: var(--color-nanda-bg-surface);
		box-shadow: none;
	}

	/* Code blocks & microlight syntax */
	:global(html.dark-mode .swagger-ui .opblock .highlight-code pre.microlight),
	:global(html.dark-mode .swagger-ui .opblock pre.microlight) {
		background: var(--color-nanda-bg) !important;
		color: var(--color-nanda-text) !important;
		border-radius: 0.5rem;
	}

	/* Execute & action buttons */
	:global(html.dark-mode .swagger-ui .opblock .btn.execute) {
		background: var(--color-nanda-primary-500);
		border-color: var(--color-nanda-primary-500);
		color: #fff;
	}
	:global(html.dark-mode .swagger-ui .opblock .btn.btn-clear) {
		border-color: var(--color-nanda-text-dim);
		color: var(--color-nanda-text-dim);
	}

	/* Models section */
	:global(html.dark-mode .swagger-ui section.models),
	:global(html.dark-mode .swagger-ui section.models h4) {
		border-color: var(--color-nanda-border);
	}
	:global(html.dark-mode .swagger-ui section.models h4 span) {
		color: var(--color-nanda-text);
	}
	:global(html.dark-mode .swagger-ui section.models .model-container),
	:global(html.dark-mode .swagger-ui .model-box) {
		background: var(--color-nanda-bg-surface);
	}

	/* Copy & download buttons */
	:global(html.dark-mode .swagger-ui .copy-to-clipboard),
	:global(html.dark-mode .swagger-ui .download-contents) {
		background: var(--color-nanda-bg-surface);
		color: var(--color-nanda-text);
	}

	/* Markdown inside Swagger */
	:global(html.dark-mode .swagger-ui .markdown code),
	:global(html.dark-mode .swagger-ui .renderedMarkdown code) {
		background: var(--color-nanda-bg);
		color: var(--color-nanda-accent);
	}

	/* Dialog / modal */
	:global(html.dark-mode .swagger-ui .dialog-ux .modal-ux) {
		background-color: var(--color-nanda-bg-surface);
		border: 1px solid var(--color-nanda-border);
		color: var(--color-nanda-text);
	}
	:global(html.dark-mode .swagger-ui .dialog-ux .modal-ux-header) {
		border-color: var(--color-nanda-border);
	}

	/* Loading spinner */
	:global(html.dark-mode .swagger-ui .loading-container .loading:after) {
		color: var(--color-nanda-text-muted);
	}

	/* JSON schema 2020-12 blocks */
	:global(html.dark-mode .swagger-ui .json-schema-2020-12),
	:global(html.dark-mode .swagger-ui .json-schema-2020-12 button) {
		background: var(--color-nanda-bg-surface);
	}

	/* Scrollbar styling inside swagger for consistency */
	:global(.swagger-container .swagger-ui ::-webkit-scrollbar) {
		width: 6px;
		height: 6px;
	}
	:global(.swagger-container .swagger-ui ::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.swagger-container .swagger-ui ::-webkit-scrollbar-thumb) {
		background: var(--color-nanda-border);
		border-radius: 3px;
	}
</style>
