<script lang="ts">
	import { onMount } from 'svelte';
	import { getFavourites, removeFavourite, type FavouriteListing } from '$lib/account-api';
	import { currencySymbol } from '$lib/utils';
	import { listingHref } from '$lib/listing-meta';
	import ListingImage from '$lib/components/ListingImage.svelte';
	import { goto } from '$app/navigation';

	let favourites = $state<FavouriteListing[]>([]);
	let loading = $state(true);
	let error = $state(false);
	let removingId = $state<string | null>(null);

	const count = $derived(favourites.length);

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				favourites = await getFavourites();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function handleRemove(f: FavouriteListing): void {
		removingId = f.listingId;
		void (async () => {
			try {
				await removeFavourite(f.listingId);
				favourites = favourites.filter((x) => x.listingId !== f.listingId);
			} catch {
				// keep it — the API call failed
			} finally {
				removingId = null;
			}
		})();
	}

	const listingId = $derived((f: FavouriteListing) => f.listing?.id ?? f.listingId);

	const category = $derived((f: FavouriteListing) => {
		const c = f.listing?.category?.toLowerCase();
		if (c === 'car' || c === 'apartment' || c === 'hotel') return c;
		return 'hotel' as const;
	});

	function categoryLabel(category: string | null | undefined): string {
		const c = category?.toLowerCase() ?? '';
		if (c === 'car') return 'Car Rental';
		if (c === 'apartment') return 'Home';
		if (c === 'hotel') return 'Hotel';
		return 'Listing';
	}

	function locationOf(f: FavouriteListing): string {
		const l = f.listing;
		if (!l) return '';
		return [l.city, l.countryCode].filter(Boolean).join(', ');
	}

	function priceOf(f: FavouriteListing): string {
		const l = f.listing;
		if (!l) return '';
		const currency = l.localizedCurrency ?? l.currency;
		const amount = l.localizedNightlyRate ?? l.nightlyRate;
		return `${currencySymbol(currency)}${Number(amount ?? 0).toLocaleString()}`;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
			<svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
				/>
			</svg>
		</div>
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">My Wishlist</h1>
			<p class="mt-1 text-sm text-slate-500">
				{count} saved listing{count !== 1 ? 's' : ''}
			</p>
		</div>
	</div>

	{#if loading}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each [1, 2, 3, 4] as i (i)}
				<div
					class="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
				>
					<div class="h-44 bg-slate-100"></div>
					<div class="space-y-2 p-4">
						<div class="h-4 w-3/4 rounded bg-slate-100"></div>
						<div class="h-3 w-1/2 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">There was a problem loading your wishlist.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if favourites.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-400"
			>
				<svg
					class="h-8 w-8"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-bold text-slate-800">Your wishlist is empty</h3>
			<p class="mx-auto mt-2 max-w-sm text-sm text-slate-500">
				Tap the heart on any listing to save it here for later.
			</p>
			<a
				href="/"
				class="mt-6 inline-block rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
			>
				Explore Listings
			</a>
		</div>
	{:else}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each favourites as f (f.listingId)}
				<div
					class="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
					role="link"
					tabindex="0"
					onclick={() => void goto(listingHref(category(f), listingId(f)))}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							void goto(listingHref(category(f), listingId(f)));
						}
					}}
				>
					<div class="relative h-44 w-full overflow-hidden">
						<ListingImage
							src={f.listing?.primaryPhotoUrl}
							alt={f.listing?.title ?? 'Listing'}
							category={category(f)}
							class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
						/>
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								handleRemove(f);
							}}
							disabled={removingId === f.listingId}
							class="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-60"
							aria-label="Remove from wishlist"
						>
							<svg
								class="h-3.5 w-3.5 fill-current text-red-500"
								fill="currentColor"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
								/>
							</svg>
						</button>
					</div>
					<div class="p-4">
						<p
							class="mb-1.5 truncate text-[10px] font-bold tracking-wider text-slate-500 uppercase"
						>
							{locationOf(f)}
						</p>
						<h3
							class="mb-2 line-clamp-1 text-sm font-bold text-slate-900 group-hover:text-[#024622]"
						>
							{f.listing?.title}
						</h3>
						<div class="flex items-center justify-between">
							<p class="text-sm font-bold text-slate-800">
								{priceOf(f)}
								<span class="text-[10px] font-medium text-slate-400">
									/{category(f) === 'car' ? 'day' : 'night'}
								</span>
							</p>
							<span
								class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
							>
								{categoryLabel(f.listing?.category)}
							</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
