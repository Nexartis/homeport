<script lang="ts">
	import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';
	// lucide-svelte uses class-style components; use typeof for the icon prop
	const {
		label,
		value,
		subtitle = '',
		trend,
		trendValue,
		icon: Icon,
		class: className = ''
	}: {
		label: string;
		value: number | string;
		subtitle?: string;
		trend?: 'up' | 'down' | 'flat';
		trendValue?: string;
		icon?: typeof TrendingUp;
		class?: string;
	} = $props();

	const trendConfig = {
		up: { color: 'text-nanda-success', component: TrendingUp },
		down: { color: 'text-nanda-danger', component: TrendingDown },
		flat: { color: 'text-nanda-text-dim', component: Minus }
	} as const;
</script>

<div
	class="rounded-xl border border-nanda-border bg-nanda-bg-surface p-4 transition-all hover:border-nanda-border-hover hover:shadow-glow-primary {className}"
>
	<div class="flex items-start justify-between">
		<div class="space-y-1">
			<p class="text-xs font-medium text-nanda-text-muted">{label}</p>
			<p class="text-2xl font-bold text-nanda-text font-mono">
				{typeof value === 'number' ? value.toLocaleString() : value}
			</p>
			{#if subtitle}
				<p class="text-[11px] text-nanda-text-dim">{subtitle}</p>
			{/if}
		</div>
		<div class="flex flex-col items-end gap-2">
			{#if Icon}
				<Icon class="h-5 w-5 text-nanda-primary-400" />
			{/if}
			{#if trend && trendValue}
				{@const cfg = trendConfig[trend]}
				<div class="flex items-center gap-1 text-xs font-medium {cfg.color}">
					<cfg.component class="h-3 w-3" />
					<span>{trendValue}</span>
				</div>
			{/if}
		</div>
	</div>
</div>
