<script lang="ts">
	import { browser } from '$app/environment';
	import { cn } from '$lib/utils';

	let {
		src,
		alt,
		loading = 'lazy',
		class: cls
	}: {
		src?: string | null | undefined;
		alt: string;
		loading?: 'lazy' | 'eager';
		class?: string;
	} = $props();

	let loaded = $state(false);
	let failed = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);

	// Reset when the source changes (e.g. gallery swaps or filtering).
	$effect(() => {
		void src;
		loaded = false;
		failed = false;
	});

	// Skip the shimmer for images already in the cache (e.g. on back-navigation
	// or rehydration), where the load event may already have fired. A broken
	// cached image (complete but no pixels) counts as failed so the alt-text
	// never shows.
	$effect(() => {
		if (!browser || !imgEl || loaded || failed) return;
		if (imgEl.complete) {
			if (imgEl.naturalWidth > 0) loaded = true;
			else failed = true;
		}
	});

	function handleLoad(): void {
		loaded = true;
	}

	function handleError(): void {
		failed = true;
	}
</script>

{#if src}
	<!-- The wrapper carries the caller's sizing/positioning classes and shows
	     the shimmer until the image paints. The <img> itself stays invisible
	     (opacity 0) so no alt-text flashes over the placeholder, and failed
	     images keep a neutral slate instead of the broken-image icon + alt. -->
	<div class={cn('overflow-hidden bg-slate-200', cls, !loaded && !failed && 'shimmer')}>
		<img
			bind:this={imgEl}
			{src}
			{alt}
			{loading}
			onload={handleLoad}
			onerror={handleError}
			class={cn(
				'block h-full w-full object-cover transition-opacity duration-300',
				loaded ? 'opacity-100' : 'opacity-0'
			)}
		/>
	</div>
{/if}
