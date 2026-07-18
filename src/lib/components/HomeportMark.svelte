<script lang="ts">
	/** Homeport brand mark (lighthouse). Sizes match the previous logo footprint. */
	const { size = 'md' }: { size?: 'sm' | 'md' | 'lg' } = $props();

	const sizes = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: 'h-7 w-7' } as const;
</script>

<img src="/brand/homeport-mark.svg" alt="" class={sizes[size]} width="64" height="64" />
