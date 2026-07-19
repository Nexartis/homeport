<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import { marqueeNodes, type ShowcaseNode } from './showcase-data';

	type Props = { nodes?: ShowcaseNode[] };
	const { nodes = marqueeNodes }: Props = $props();

	// Duplicate the track so the CSS keyframe translateX(-50%) loops seamlessly.
	const track = $derived([...nodes, ...nodes]);
</script>

<section
	class="marquee-wrap border-y border-nanda-border/40 bg-nanda-bg-elevated/20"
	aria-label="Nodes built on Homeport"
>
	<div class="mx-auto max-w-[1100px] px-4 py-3">
		<p class="text-[10.5px] uppercase tracking-[0.18em] text-nanda-text-dim font-semibold mb-2">
			Built on Homeport · NANDA hackathon fleet
		</p>
	</div>
	<div class="marquee" tabindex="-1">
		<ul class="marquee-track">
			{#each track as node, i (i)}
				<li class="marquee-item">
					<a
						href="https://{node.domain}"
						target="_blank"
						rel="noopener noreferrer"
						class="marquee-card"
						aria-label="{node.name} — {node.tag} (opens in a new tab)"
						aria-hidden={i >= nodes.length ? 'true' : undefined}
						tabindex={i >= nodes.length ? -1 : 0}
					>
						{#if node.image}
							<img
								src={node.image}
								alt={node.imageAlt ?? ''}
								width="56"
								height="56"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<span
								class="marquee-glyph"
								style="background:hsl({node.hue ?? 220} 55% 22%);color:hsl({node.hue ??
									220} 90% 82%)"
								aria-hidden="true">{node.glyph ?? node.name.slice(0, 2)}</span
							>
						{/if}
						<span class="marquee-text">
							<span class="marquee-name">
								{node.name}
								<ExternalLink class="h-3 w-3 opacity-60" aria-hidden="true" />
							</span>
							<span class="marquee-tag">{node.tag}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.marquee-wrap {
		/* subtle edge fade so cards ghost in/out instead of clipping */
		--fade: 48px;
	}

	.marquee {
		overflow: hidden;
		-webkit-mask-image: linear-gradient(
			to right,
			transparent,
			#000 var(--fade),
			#000 calc(100% - var(--fade)),
			transparent
		);
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 var(--fade),
			#000 calc(100% - var(--fade)),
			transparent
		);
		padding-bottom: 0.75rem;
	}

	.marquee-track {
		display: flex;
		gap: 0.75rem;
		width: max-content;
		list-style: none;
		margin: 0;
		padding: 0.5rem 0.75rem;
		animation: marquee-scroll 60s linear infinite;
	}

	.marquee:hover .marquee-track,
	.marquee:focus-within .marquee-track {
		animation-play-state: paused;
	}

	.marquee-item {
		flex: 0 0 auto;
	}

	.marquee-card {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0.75rem 0.5rem 0.5rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(37, 37, 48, 0.6);
		background: rgba(26, 26, 36, 0.5);
		text-decoration: none;
		transition:
			border-color 120ms ease,
			transform 120ms ease;
		max-width: 260px;
	}

	.marquee-card:hover,
	.marquee-card:focus-visible {
		border-color: #71717a;
		transform: translateY(-1px);
		outline: none;
	}
	.marquee-card:focus-visible {
		box-shadow: 0 0 0 2px rgba(105, 66, 230, 0.5);
	}

	.marquee-card img,
	.marquee-glyph {
		width: 56px;
		height: 56px;
		border-radius: 0.5rem;
		object-fit: cover;
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9rem;
		letter-spacing: 0.06em;
	}

	.marquee-text {
		display: inline-flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.marquee-name {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #fafafa;
		white-space: nowrap;
	}
	.marquee-tag {
		font-size: 0.7rem;
		color: #94a3b8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@keyframes marquee-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marquee {
			overflow-x: auto;
			-webkit-mask-image: none;
			mask-image: none;
		}
		.marquee-track {
			animation: none;
			width: auto;
		}
	}
</style>
