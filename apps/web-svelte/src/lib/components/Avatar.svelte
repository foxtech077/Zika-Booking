<script lang="ts">
	import { getInitials } from '$lib/utils';
	import ShimmerImage from './ShimmerImage.svelte';

	const COLORS = [
		'bg-green-500',
		'bg-violet-500',
		'bg-emerald-500',
		'bg-amber-500',
		'bg-rose-500',
		'bg-cyan-500',
		'bg-pink-500',
		'bg-indigo-500'
	];

	const SIZES = {
		xs: 'w-6 h-6 text-xs',
		sm: 'w-8 h-8 text-xs',
		md: 'w-10 h-10 text-sm',
		lg: 'w-12 h-12 text-base',
		xl: 'w-16 h-16 text-lg'
	} as const;

	function getColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return COLORS[Math.abs(hash) % COLORS.length]!;
	}

	let {
		name = '',
		src = null,
		size = 'md',
		class: className = ''
	}: {
		name?: string;
		src?: string | null;
		size?: keyof typeof SIZES;
		class?: string;
	} = $props();
</script>

{#if src}
	<ShimmerImage {src} alt={name} class="{SIZES[size]} rounded-full object-cover {className}" />
{:else}
	<div
		class="flex items-center justify-center rounded-full font-semibold text-white select-none {getColor(
			name
		)} {SIZES[size]} {className}"
	>
		{getInitials(name)}
	</div>
{/if}
