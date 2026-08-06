<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { navigating, page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { cn, todayString } from '$lib/utils';
	import { location } from '$lib/stores/location.svelte';
	import { loadFavourites } from '$lib/stores/favourites.svelte';
	import { LISTING_API_URL, DEFAULT_COORDS } from '$lib/config';
	import { searchStateFromUrl, type ListingsData } from '$lib/load-listings';
	import {
		searchListingsDetail,
		buildSearchApiParams,
		geocodeDestination,
		type ListingCategory,
		type PublicListingDetail
	} from '$lib/listing-api';
	import {
		PAGE_SIZE,
		CATEGORY_META,
		categoryHref,
		listingHref,
		SORT_OPTIONS,
		DEFAULT_FILTERS,
		countActiveFilters,
		type FilterState
	} from '$lib/listing-meta';
	import ListingCard from './ListingCard.svelte';
	import ListingsFilterPanel from './ListingsFilterPanel.svelte';
	import PromoBanner from './PromoBanner.svelte';
	import DateRangePicker from './DateRangePicker.svelte';

	interface NominatimResult {
		display_name: string;
	}

	let {
		category,
		initial,
		seedParams
	}: {
		category: ListingCategory;
		initial: ListingsData;
		seedParams: URLSearchParams;
	} = $props();

	const isNavigating = $derived(
		navigating !== null &&
			navigating.to !== null &&
			['/search', '/hotels', '/apartments', '/cars'].includes(navigating.to.url.pathname)
	);
	const meta = $derived(CATEGORY_META[category]);
	const isCar = $derived(category === 'car');

	onMount(() => {
		// Load the signed-in user's favourites so the result-card hearts
		// reflect what's already saved (the SSR search load can't carry the
		// auth token). Idempotent per user.
		void loadFavourites();
	});

	let filters = $state<FilterState>(DEFAULT_FILTERS);
	let sort = $state('recommended');
	let query = $state('');
	let checkIn = $state('');
	let checkOut = $state('');
	let pickupDate = $state('');
	let returnDate = $state('');
	let guests = $state(2);
	let showFilterPanel = $state(false);
	let loadingMore = $state(false);
	let appended = $state<PublicListingDetail[]>([]);
	let showMap = $state(false);
	let hoveredId = $state<string | null>(null);
	let MapComponent = $state<typeof import('./ListingMap.svelte').default | null>(null);

	$effect(() => {
		if (!browser) return;
		let cancelled = false;
		void import('./ListingMap.svelte').then((mod) => {
			if (!cancelled) MapComponent = mod.default;
		});
		return () => {
			cancelled = true;
		};
	});

	let showSuggestions = $state(false);
	let nominatimResults = $state<NominatimResult[]>([]);
	let nominatimTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const sp = seedParams;
		filters = filtersFromParams(sp);
		sort = sp.get('sort') ?? 'recommended';
		query = sp.get('q') ?? sp.get('destination') ?? '';
		checkIn = sp.get('checkin') ?? '';
		checkOut = sp.get('checkout') ?? '';
		pickupDate = sp.get('pickup') ?? '';
		returnDate = sp.get('return') ?? '';
		guests = Number(sp.get('guests') ?? 2) || 2;
	});

	$effect(() => {
		void initial;
		appended = [];
	});

	const allResults = $derived([...initial.results, ...appended]);
	const hasMore = $derived(allResults.length < initial.totalCount);
	const activeFilterCount = $derived(countActiveFilters(filters));

	// Client-side text gate, mirroring apps/web: for an unresolved destination
	// only listings whose name/town/country/address/description (plus car
	// make/model) contain the search term are rendered, regardless of what the
	// backend text/radius query returned.
	const isTextQuery = $derived(query.trim().length > 0);
	const placeResolved = $derived(seedParams.get('place_resolved') === 'true');
	const displayResults = $derived.by(() => {
		if (!isTextQuery || placeResolved) return allResults;
		const term = query.trim().toLowerCase();
		return allResults.filter((l) => {
			const fields: (string | null | undefined)[] = [
				l.name,
				l.town,
				l.country,
				l.address,
				l.description
			];
			if (l.category === 'car') fields.push(l.carMake, l.carModel);
			return fields.some((f) => f && f.toLowerCase().includes(term));
		});
	});

	function filtersFromParams(sp: URLSearchParams): FilterState {
		const f = { ...DEFAULT_FILTERS };
		const n = (k: string): number | null => {
			const v = Number(sp.get(k) ?? 0);
			return v > 0 ? v : null;
		};
		const max = Number(sp.get('price_max') ?? 0);
		f.priceMax = max > 0 && max < 500000 ? max : 500000;
		f.rating = n('rating');
		f.amenities = (sp.get('amenities') ?? '').split(',').filter(Boolean);
		f.cancellation = sp.get('cancellation') ?? '';
		f.minStay = n('min_stay');
		f.transmission = sp.get('transmission') ?? '';
		f.fuelType = sp.get('fuel') ?? '';
		f.carCategory = sp.get('car_category') ?? '';
		f.seats = n('seats');
		f.minDriverAge = n('min_age');
		f.bedrooms = n('bedrooms');
		f.bathrooms = n('bathrooms');
		f.smokingAllowed = sp.get('smoking_allowed') === 'true';
		f.petsAllowed = sp.get('pets_allowed') === 'true';
		f.longStayDiscount = sp.get('long_stay_discount') === 'true';
		f.airportPickup = sp.get('airport_pickup') === 'true';
		f.deliveryAvailable = sp.get('delivery') === 'true';
		return f;
	}

	function paramsFromState(): URLSearchParams {
		const p = new SvelteURLSearchParams();
		const sp = seedParams;
		for (const k of ['lat', 'lng', 'radius_km', 'adults', 'children', 'rooms']) {
			const v = sp.get(k);
			if (v) p.set(k, v);
		}
		const q = query.trim();
		if (q) {
			p.set('q', q);
			const pr = sp.get('place_resolved');
			if (pr) p.set('place_resolved', pr);
		}
		if (sort) p.set('sort', sort);
		if (checkIn) p.set('checkin', checkIn);
		if (checkOut) p.set('checkout', checkOut);
		if (pickupDate) p.set('pickup', pickupDate);
		if (returnDate) p.set('return', returnDate);
		if (guests > 1) p.set('guests', String(guests));
		if (filters.priceMax < 500000) p.set('price_max', String(filters.priceMax));
		if (filters.rating) p.set('rating', String(filters.rating));
		if (filters.amenities.length) p.set('amenities', filters.amenities.join(','));
		if (filters.cancellation) p.set('cancellation', filters.cancellation);
		if (filters.minStay) p.set('min_stay', String(filters.minStay));
		if (filters.transmission) p.set('transmission', filters.transmission);
		if (filters.fuelType) p.set('fuel', filters.fuelType);
		if (filters.carCategory) p.set('car_category', filters.carCategory);
		if (filters.seats) p.set('seats', String(filters.seats));
		if (filters.minDriverAge) p.set('min_age', String(filters.minDriverAge));
		if (filters.bedrooms) p.set('bedrooms', String(filters.bedrooms));
		if (filters.bathrooms) p.set('bathrooms', String(filters.bathrooms));
		if (filters.smokingAllowed) p.set('smoking_allowed', 'true');
		if (filters.petsAllowed) p.set('pets_allowed', 'true');
		if (filters.longStayDiscount) p.set('long_stay_discount', 'true');
		if (filters.airportPickup) p.set('airport_pickup', 'true');
		if (filters.deliveryAvailable) p.set('delivery', 'true');
		return p;
	}

	function buildUrl(cat: ListingCategory, p: URLSearchParams): string {
		const path =
			cat === category && page.url.pathname !== '/search' ? page.url.pathname : categoryHref(cat);
		if (path === '/search') p.set('category', cat);
		return `${path}?${p.toString()}`;
	}

	async function handleSearch(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		showSuggestions = false;
		showFilterPanel = false;
		const p = paramsFromState();
		const q = query.trim();
		if (q) {
			// Resolve the typed destination so a real place unlocks the backend's
			// "nearby" fallback, while an unresolved/junk term stays text-only and
			// returns no results (never the whole category).
			const { lat, lng, resolved } = await geocodeDestination(q);
			p.set('q', q);
			p.set('place_resolved', resolved ? 'true' : 'false');
			if (resolved) {
				p.set('lat', String(lat));
				p.set('lng', String(lng));
			} else {
				p.delete('lat');
				p.delete('lng');
			}
		}
		await goto(buildUrl(category, p));
	}

	function handleClearSearch(): void {
		query = '';
		showSuggestions = false;
		nominatimResults = [];
		goto(buildUrl(category, paramsFromState()));
	}

	function handleSort(e: Event): void {
		const v = (e.currentTarget as HTMLSelectElement).value;
		sort = v;
		goto(buildUrl(category, paramsFromState()));
	}

	function applyFilters(): void {
		showFilterPanel = false;
		goto(buildUrl(category, paramsFromState()));
	}

	function resetFilters(): void {
		showFilterPanel = false;
		filters = { ...DEFAULT_FILTERS };
		goto(buildUrl(category, paramsFromState()));
	}

	function handleDestinationInput(value: string): void {
		query = value;
		showSuggestions = true;
		if (nominatimTimer) clearTimeout(nominatimTimer);
		if (value.trim().length >= 2) {
			nominatimTimer = setTimeout(async () => {
				try {
					const r = await fetch(
						`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&addressdetails=0`,
						{ headers: { 'Accept-Language': 'en', 'User-Agent': 'Kainook/1.0' } }
					);
					const data = await r.json();
					nominatimResults = Array.isArray(data) ? data : [];
				} catch {
					nominatimResults = [];
				}
			}, 320);
		} else {
			nominatimResults = [];
		}
	}

	function selectSuggestion(name: string): void {
		query = name;
		showSuggestions = false;
		nominatimResults = [];
	}

	async function loadMore(): Promise<void> {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const coords = location.coords ?? DEFAULT_COORDS;
			const url = new URL(page.url.href);
			const state = searchStateFromUrl(
				url,
				category,
				coords,
				allResults.length,
				PAGE_SIZE,
				location.country?.currency ?? undefined
			);
			const { results } = await searchListingsDetail(
				fetch,
				buildSearchApiParams(state),
				LISTING_API_URL
			);
			appended = [...appended, ...results];
		} catch {
			// keep current list; user can retry
		} finally {
			loadingMore = false;
		}
	}
</script>

<!-- Category-customized search bar -->
<div class="border-b border-slate-100 bg-white shadow-sm">
	<form onsubmit={handleSearch} class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
			<!-- Destination / Pickup Location -->
			<div class="relative md:col-span-2">
				<label
					class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase"
					for="listing-destination"
				>
					{isCar ? 'Pickup Location' : 'Destination'}
				</label>
				<div
					class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors focus-within:border-[#1D8D2B] hover:border-slate-400"
				>
					<svg
						class="h-3.5 w-3.5 shrink-0 text-slate-400"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						id="listing-destination"
						type="text"
						value={query}
						oninput={(e) => handleDestinationInput((e.currentTarget as HTMLInputElement).value)}
						onfocus={() => (showSuggestions = true)}
						onblur={() =>
							setTimeout(() => {
								showSuggestions = false;
								nominatimResults = [];
							}, 150)}
						placeholder={isCar ? 'City, airport, address…' : 'City, country or property…'}
						class="min-w-0 flex-1 border-none bg-transparent text-xs font-medium text-slate-800 placeholder-slate-400 outline-none"
					/>
					{#if query}
						<button
							type="button"
							onclick={handleClearSearch}
							class="shrink-0 text-slate-300 transition hover:text-slate-500"
							aria-label="Clear search"
						>
							<svg
								class="h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>

				{#if showSuggestions && nominatimResults.length > 0}
					<div
						class="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
					>
						{#each nominatimResults as r, i (i)}
							<button
								type="button"
								onmousedown={() =>
									selectSuggestion(r.display_name.split(',').slice(0, 2).join(',').trim())}
								class="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors last:border-0 hover:bg-slate-50"
							>
								<span class="text-xs">📍</span>
								<span class="truncate">{r.display_name.split(',').slice(0, 3).join(', ')}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Dates -->
			{#if isCar}
				<div class="md:col-span-2">
					<DateRangePicker
						label="Rental Dates"
						isCar
						startDate={pickupDate}
						endDate={returnDate}
						onChange={(start, end) => {
							pickupDate = start;
							returnDate = end;
						}}
						minDate={todayString()}
						variant="field"
						class="w-full"
					/>
				</div>
			{:else}
				<div class="md:col-span-2">
					<DateRangePicker
						label="Check-in – Check-out"
						startDate={checkIn}
						endDate={checkOut}
						onChange={(start, end) => {
							checkIn = start;
							checkOut = end;
						}}
						minDate={todayString()}
						variant="field"
						class="w-full"
					/>
				</div>
			{/if}

			<!-- Guests / Search -->
			{#if isCar}
				<div class="flex items-end">
					<button
						type="submit"
						class="w-full rounded-xl bg-[#1D8D2B] py-[11px] text-sm font-bold text-white shadow-sm transition hover:bg-[#16852a]"
					>
						Search Cars
					</button>
				</div>
			{:else}
				<div>
					<label
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase"
						for="listing-guests"
					>
						Guests
					</label>
					<div
						class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors focus-within:border-[#1D8D2B] hover:border-slate-400"
					>
						<svg
							class="h-3.5 w-3.5 shrink-0 text-slate-400"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						<input
							id="listing-guests"
							type="number"
							min="1"
							max="20"
							value={guests}
							oninput={(e) =>
								(guests = Math.max(
									1,
									Math.min(20, Number((e.currentTarget as HTMLInputElement).value || 1))
								))}
							class="w-12 min-w-0 flex-1 border-none bg-transparent text-xs font-medium text-slate-800 outline-none"
						/>
						<span class="shrink-0 text-xs text-slate-400">Guest{guests !== 1 ? 's' : ''}</span>
					</div>
				</div>
			{/if}
		</div>

		{#if !isCar}
			<div class="mt-3 flex justify-end">
				<button
					type="submit"
					class="rounded-xl bg-[#1D8D2B] px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#16852a]"
				>
					Search {meta.label}
				</button>
			</div>
		{/if}
	</form>
</div>

<div
	class={cn(
		'px-4 py-6 sm:px-6 lg:px-8',
		showMap ? 'mx-auto w-full max-w-none' : 'mx-auto max-w-7xl'
	)}
>
	<div class="lg:flex lg:gap-8 xl:gap-12 2xl:gap-16">
		<!-- Desktop filter sidebar -->
		<aside class="hidden shrink-0 lg:block lg:w-72 xl:w-80">
			<div
				class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5"
			>
				<div class="mb-5 flex items-center gap-2">
					<svg
						class="h-4 w-4 shrink-0 text-slate-600"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
						/>
					</svg>
					<h2 class="text-base font-bold text-slate-900">Refine Results</h2>
					{#if activeFilterCount > 0}
						<span
							class="ml-auto rounded-full bg-[#0c2614] px-2 py-0.5 text-[10px] font-bold text-white"
						>
							{activeFilterCount}
						</span>
					{/if}
				</div>
				<ListingsFilterPanel
					{category}
					{filters}
					onChange={(patch) => (filters = { ...filters, ...patch })}
					onApply={applyFilters}
					onReset={resetFilters}
				/>
			</div>
		</aside>

		<!-- Main results -->
		<div class="min-w-0 flex-1">
			<!-- Heading + toolbar -->
			<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 class="font-serif text-3xl font-bold text-slate-900 sm:text-4xl">{meta.title}</h1>
					<p class="mt-1 text-sm text-slate-500">
						{initial.totalCount > 0
							? `${initial.totalCount.toLocaleString()} ${meta.plural} available`
							: meta.subtitle}
					</p>
				</div>

				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => (showMap = !showMap)}
						class={cn(
							'hidden items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition lg:flex',
							showMap
								? 'border-[#0c2614] bg-[#0c2614] text-white'
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
						)}
					>
						<svg
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
							/>
						</svg>
						{showMap ? 'Hide Map' : 'Show Map'}
					</button>

					<button
						type="button"
						onclick={() => (showFilterPanel = true)}
						class={cn(
							'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition lg:hidden',
							activeFilterCount > 0
								? 'border-[#0c2614] bg-[#0c2614] text-white'
								: 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
						)}
					>
						<svg
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
							/>
						</svg>
						Filters
						{#if activeFilterCount > 0}
							<span
								class="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1D8D2B] px-1 text-[9px] font-bold"
							>
								{activeFilterCount}
							</span>
						{/if}
					</button>

					<select
						value={sort}
						onchange={handleSort}
						class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition focus:border-[#1D8D2B] focus:outline-none"
					>
						{#each SORT_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>

			{#if initial.error}
				<div
					class="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800"
				>
					<span class="text-sm">⚠</span>
					{initial.error} Showing cached or empty results.
				</div>
			{/if}

			{#if initial.promotion}
				<div class="mb-6">
					<PromoBanner promotion={initial.promotion} />
				</div>
			{/if}

			<!-- Results -->
			<div class="relative">
				<div class={cn('flex', showMap ? 'gap-5' : '')}>
					{#if showMap}
						<div
							class="sticky top-[140px] hidden h-[calc(100vh-210px)] w-[45%] shrink-0 overflow-hidden rounded-3xl border border-slate-200 shadow-md lg:block"
						>
							{#if MapComponent}
								<MapComponent
									listings={displayResults}
									{hoveredId}
									onHover={(id: string | null) => (hoveredId = id)}
									onSelect={(id: string) => {
										const item = displayResults.find((l) => l.id === id);
										if (item) void goto(listingHref(item.category, id));
									}}
								/>
							{:else}
								<div
									class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl bg-slate-100"
								>
									<div
										class="h-6 w-6 animate-spin rounded-full border-4 border-[#0B1E3F] border-t-transparent"
									></div>
									<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
										Loading map…
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class={cn('min-w-0 flex-1', showMap ? 'overflow-y-auto' : '')}>
						{#if displayResults.length > 0}
							<div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
								{#each displayResults as listing (listing.id)}
									<ListingCard
										{listing}
										hovered={hoveredId === listing.id}
										onmouseenter={() => (hoveredId = listing.id)}
										onmouseleave={() => (hoveredId = null)}
									/>
								{/each}
							</div>
						{:else if !initial.error}
							<div
								class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-20 text-center"
							>
								<div
									class="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-3xl"
								>
									🔍
								</div>
								<h3 class="text-lg font-bold text-slate-900">
									{query.trim()
										? `No results found for "${query.trim()}"`
										: `No ${meta.plural} found`}
								</h3>
								<p class="max-w-xs text-xs leading-relaxed text-slate-400">
									{query.trim()
										? 'No listings match your search. Try a different location or property name.'
										: 'Try adjusting your filters, changing dates, or searching a broader location.'}
								</p>
								{#if activeFilterCount > 0}
									<button
										type="button"
										onclick={resetFilters}
										class="mt-2 rounded-xl bg-[#0c2614] px-6 py-2.5 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-[#1D8D2B]"
									>
										Clear all filters
									</button>
								{/if}
							</div>
						{/if}

						<!-- Load more -->
						{#if hasMore}
							<div class="mt-10 text-center">
								<button
									type="button"
									onclick={loadMore}
									disabled={loadingMore}
									class="inline-flex items-center gap-2 rounded-full border border-[#0c2614] px-8 py-3 text-sm font-semibold text-[#0c2614] transition hover:bg-[#0c2614] hover:text-white disabled:opacity-50"
								>
									{#if loadingMore}
										<span
											class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
										></span>
										Loading…
									{:else}
										Load More {meta.label}
										<svg
											class="h-4 w-4"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
										</svg>
									{/if}
								</button>
								<p class="mt-2 text-xs text-slate-400">
									Showing {displayResults.length} of {initial.totalCount.toLocaleString()}
								</p>
							</div>
						{/if}

						{#if allResults.length === 0 && initial.totalCount === 0 && initial.error}
							<div class="mt-4 text-center text-xs text-slate-400">
								The listing service is currently unreachable. Please try again shortly.
							</div>
						{/if}

						{#if isNavigating}
							<div
								class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-[2px]"
							>
								<div class="flex flex-col items-center gap-3">
									<div
										class="h-8 w-8 animate-spin rounded-full border-4 border-[#1D8D2B]/20 border-t-[#1D8D2B]"
									></div>
									<p class="text-xs font-semibold text-slate-600">Loading listings…</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Floating filter drawer (mobile only) -->
{#if showFilterPanel}
	<div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
		<button
			type="button"
			class="absolute inset-0 block h-full w-full bg-black/40"
			aria-label="Close filters"
			onclick={() => (showFilterPanel = false)}
		></button>
		<div class="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<div class="flex items-center gap-2">
					<h2 class="text-sm font-bold text-slate-900">Filter Results</h2>
					{#if activeFilterCount > 0}
						<span class="rounded-full bg-[#0c2614] px-2 py-0.5 text-[10px] font-bold text-white">
							{activeFilterCount}
						</span>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => (showFilterPanel = false)}
					class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition hover:bg-slate-200"
					aria-label="Close filters"
				>
					<svg
						class="h-4 w-4 text-slate-600"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto px-5 py-4">
				<ListingsFilterPanel
					{category}
					{filters}
					onChange={(patch) => (filters = { ...filters, ...patch })}
					onApply={applyFilters}
					onReset={resetFilters}
				/>
			</div>
		</div>
	</div>
{/if}
