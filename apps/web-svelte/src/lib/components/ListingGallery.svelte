<script lang="ts">
	import type { ListingPhoto } from '$lib/listing-api';
	import { LISTING_IMAGE_FALLBACK } from '$lib/config';

	let {
		photos,
		alt
	}: {
		photos: ListingPhoto[];
		alt: string;
	} = $props();

	const urls = $derived(photos.map((p) => p.cdnUrl).filter(Boolean) as string[]);
</script>

<div class="overflow-hidden rounded-2xl border border-slate-200">
	{#if urls.length === 0}
		<img src={LISTING_IMAGE_FALLBACK} {alt} class="h-72 w-full object-cover sm:h-96" />
	{:else if urls.length === 1}
		<img src={urls[0]} {alt} class="h-72 w-full object-cover sm:h-96" loading="eager" />
	{:else}
		<div class="grid grid-cols-2 gap-1 md:h-[440px] md:grid-cols-4 md:grid-rows-2">
			<img
				src={urls[0]}
				{alt}
				class="col-span-2 row-span-2 h-64 w-full object-cover md:h-full"
				loading="eager"
			/>
			{#each urls.slice(1, 5) as url, i (url)}
				<img
					src={url}
					alt={`${alt} (${i + 2})`}
					class="h-32 w-full object-cover md:h-full"
					loading="lazy"
				/>
			{/each}
		</div>
	{/if}
</div>
