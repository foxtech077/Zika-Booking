<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import { getRecentlyViewed } from '$lib/account-api';
	import { getLocalRecentlyViewed, type LocalViewedListing } from '$lib/recently-viewed';
	import { listingHref } from '$lib/listing-meta';
	import { currencySymbol } from '$lib/utils';
	import ListingImage from '$lib/components/ListingImage.svelte';

	interface StripItem {
		id: string;
		title: string;
		category: string;
		location: string;
		price: number | null;
		currency: string;
		photo: string | null;
	}

	let items = $state<StripItem[]>([]);
	let loaded = $state(false);

	onMount(() => {
		void (async () => {
			try {
				if (auth.isAuthenticated) {
					const list = await getRecentlyViewed();
					items = list
						.filter((x) => x.listing)
						.slice(0, 4)
						.map((x) => {
							const l = x.listing!;
							return {
								id: l.id,
								title: l.title,
								category: l.category,
								location: [l.city, l.countryCode].filter(Boolean).join(', '),
								price: l.nightlyRate,
								currency: l.currency ?? 'KES',
								photo: l.primaryPhotoUrl
							};
						});
				} else {
					items = getLocalRecentlyViewed()
						.slice(0, 4)
						.map((l: LocalViewedListing) => ({
							id: l.id,
							title: l.name,
							category: l.category,
							location: [l.town, l.country].filter(Boolean).join(', '),
							price: l.pricePerNight,
							currency: l.currency,
							photo: l.primaryPhotoUrl
						}));
				}
			} catch {
				// non-fatal — hide the strip
			} finally {
				loaded = true;
			}
		})();
	});

	function categoryLabel(cat: string | null | undefined): string {
		if (cat === 'car') return 'Car';
		if (cat === 'apartment') return 'Home';
		if (cat === 'hotel') return 'Hotel';
		return 'Listing';
	}
</script>

{#if loaded && items.length > 0}
	<section class="border-y border-slate-200/60 bg-white py-16">
		<div class="mx-auto max-w-7xl px-4 sm:px-6">
			<div class="mb-8 flex items-end justify-between">
				<div>
					<p class="mb-2 text-[10px] font-semibold tracking-[0.3em] text-[#1D8D2B] uppercase">
						Recently Viewed
					</p>
					<h2 class="font-serif text-3xl text-slate-900 md:text-4xl">Pick up where you left off</h2>
				</div>
				{#if auth.isAuthenticated}
					<a
						href="/recently-viewed"
						class="text-sm font-semibold text-[#1D8D2B] transition hover:underline"
					>
						View all →
					</a>
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each items as item (item.id)}
					<div
						role="link"
						tabindex="0"
						onclick={() => void goto(listingHref(item.category, item.id))}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								void goto(listingHref(item.category, item.id));
							}
						}}
						class="group cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#1D8D2B]/40 hover:shadow-md"
					>
						<div class="relative h-40 overflow-hidden">
							<ListingImage
								src={item.photo}
								alt={item.title}
								category={(item.category as 'hotel' | 'apartment' | 'car') ?? 'hotel'}
								class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
							/>
							<span
								class="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-700 uppercase backdrop-blur-sm"
							>
								{categoryLabel(item.category)}
							</span>
						</div>
						<div class="p-4">
							<h3 class="truncate text-sm font-bold text-slate-900">{item.title}</h3>
							<p class="mt-0.5 truncate text-xs text-slate-500">{item.location || '—'}</p>
							<p class="mt-2 text-sm font-bold text-slate-900">
								{item.price != null
									? `${currencySymbol(item.currency)}${Number(item.price).toLocaleString()}/night`
									: '—'}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}
