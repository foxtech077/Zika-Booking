<script lang="ts">
	import { goto } from '$app/navigation';
	import DateRangePicker from './DateRangePicker.svelte';
	import { todayString, cn } from '$lib/utils';
	import { location } from '$lib/stores/location.svelte';
	import { geocodeDestination, type ListingCategory } from '$lib/listing-api';

	interface NominatimResult {
		display_name: string;
	}

	let {
		apiSuggestions = []
	}: {
		// Town/listing-name suggestions (e.g. harvested from the current page's
		// listings), blended with Nominatim results like apps/web does.
		apiSuggestions?: string[];
	} = $props();

	const CATEGORIES: { key: ListingCategory; label: string }[] = [
		{ key: 'hotel', label: 'Hotels' },
		{ key: 'apartment', label: 'Home' },
		{ key: 'car', label: 'Cars' }
	];

	let searchCategory = $state<ListingCategory>('hotel');
	let searchDestination = $state('');
	let checkIn = $state('');
	let checkOut = $state('');
	let pickupDate = $state('');
	let returnDate = $state('');
	let adults = $state(2);
	let children = $state(0);
	let rooms = $state(1);
	let showGuestPicker = $state(false);
	let searching = $state(false);
	let showSuggestions = $state(false);
	let nominatimResults = $state<NominatimResult[]>([]);
	let nominatimTimer: ReturnType<typeof setTimeout> | undefined;

	function handleDestinationInput(value: string): void {
		searchDestination = value;
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
		searchDestination = name;
		showSuggestions = false;
		nominatimResults = [];
	}

	// Listing/town suggestions from the current page's data, filtered by what
	// the user has typed so far (used when Nominatim returns nothing).
	const filteredApiSuggestions = $derived(
		apiSuggestions.filter((s) => s.toLowerCase().includes(searchDestination.trim().toLowerCase()))
	);

	const searchGuests = $derived(adults + children);

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();

		if (!searchDestination.trim()) {
			alert('Please enter a destination to search.');
			return;
		}

		const todayStr = todayString();
		if (searchCategory !== 'car') {
			if (checkIn && checkIn < todayStr) {
				alert('Check-in date cannot be in the past.');
				return;
			}
			if (checkIn && checkOut && checkOut < checkIn) {
				alert('Check-out date must be after your check-in date.');
				return;
			}
		} else {
			if (pickupDate && pickupDate < todayStr) {
				alert('Pickup date cannot be in the past.');
				return;
			}
			if (pickupDate && returnDate && returnDate < pickupDate) {
				alert('Return date must be after your pickup date.');
				return;
			}
		}

		searching = true;
		showGuestPicker = false;

		// Resolve the typed destination so a real place unlocks the backend's
		// "nearby" fallback, while an unresolved/junk term stays text-only and
		// returns no results (never the whole category).
		const { lat, lng, resolved } = await geocodeDestination(searchDestination.trim());

		const parts: string[] = [];
		parts.push(`category=${encodeURIComponent(searchCategory)}`);
		parts.push(`q=${encodeURIComponent(searchDestination.trim())}`);
		parts.push(`place_resolved=${resolved ? 'true' : 'false'}`);
		if (resolved) {
			parts.push(`lat=${lat}`);
			parts.push(`lng=${lng}`);
		}

		if (searchCategory === 'car') {
			if (pickupDate) parts.push(`pickup=${encodeURIComponent(pickupDate)}`);
			if (returnDate) parts.push(`return=${encodeURIComponent(returnDate)}`);
		} else {
			if (checkIn) parts.push(`checkin=${encodeURIComponent(checkIn)}`);
			if (checkOut) parts.push(`checkout=${encodeURIComponent(checkOut)}`);
		}

		if (searchGuests > 1) parts.push(`guests=${searchGuests}`);
		parts.push(`adults=${adults}`);
		parts.push(`children=${children}`);
		parts.push(`rooms=${rooms}`);

		const coords = location.coords;
		if (coords && !resolved) {
			parts.push(`lat=${coords.lat}`);
			parts.push(`lng=${coords.lng}`);
			parts.push(`radius_km=100`);
		}

		await goto(`/search?${parts.join('&')}`);
	}
</script>

{#snippet catIcon(key: ListingCategory)}
	{#if key === 'hotel'}
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
		/>
	{:else if key === 'apartment'}
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
		/>
	{:else}
		<path
			d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
		/>
		<circle cx="7" cy="17" r="2" />
		<path d="M9 17h6" />
		<circle cx="17" cy="17" r="2" />
	{/if}
{/snippet}

<div class="mb-3 flex items-center justify-center gap-2">
	{#each CATEGORIES as cat (cat.key)}
		<button
			type="button"
			onclick={() => (searchCategory = cat.key)}
			class={cn(
				'flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition',
				searchCategory === cat.key
					? 'border-white bg-white text-[#0c2614] shadow-md'
					: 'border-white/30 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25'
			)}
		>
			<svg
				class="h-3.5 w-3.5"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				viewBox="0 0 24 24"
			>
				{@render catIcon(cat.key)}
			</svg>
			{cat.label}
		</button>
	{/each}
</div>

<form onsubmit={handleSubmit}>
	<div
		class="relative flex flex-col items-stretch overflow-visible rounded-2xl bg-white shadow-[0_12px_40px_-10px_rgba(0,0,0,0.4)] ring-1 ring-black/5 md:flex-row"
	>
		<!-- Destination -->
		<div class="relative min-w-0 flex-[2]">
			<div class="flex items-center gap-2 border-slate-200 px-5 py-4 md:border-r">
				<svg
					class="h-4 w-4 shrink-0 text-slate-400"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<div class="min-w-0 flex-1">
					<p class="mb-0.5 text-[9px] font-bold tracking-widest text-slate-400 uppercase">
						Where to?
					</p>
					<input
						type="text"
						required
						placeholder="Destination"
						value={searchDestination}
						oninput={(e) => handleDestinationInput((e.currentTarget as HTMLInputElement).value)}
						onfocus={() => (showSuggestions = true)}
						onblur={() =>
							setTimeout(() => {
								showSuggestions = false;
								nominatimResults = [];
							}, 220)}
						class="w-full border-none bg-transparent text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none"
					/>
				</div>
			</div>

			{#if showSuggestions && (nominatimResults.length > 0 || filteredApiSuggestions.length > 0)}
				<div
					class="absolute top-full right-0 left-0 z-50 mt-2 max-h-56 overflow-hidden overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
				>
					{#if nominatimResults.length > 0}
						{#each nominatimResults as r, i (i)}
							<button
								type="button"
								onmousedown={() =>
									selectSuggestion(r.display_name.split(',').slice(0, 2).join(',').trim())}
								class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-[#0c2614] hover:text-white"
							>
								<svg
									class="h-3.5 w-3.5 shrink-0 opacity-60"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								<span class="truncate">{r.display_name.split(',').slice(0, 3).join(', ')}</span>
							</button>
						{/each}
					{:else}
						{#each filteredApiSuggestions as s (s)}
							<button
								type="button"
								onmousedown={() => selectSuggestion(s)}
								class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-[#0c2614] hover:text-white"
							>
								<svg
									class="h-3.5 w-3.5 shrink-0 opacity-60"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								<span class="truncate">{s}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Date fields -->
		<div
			class="relative flex min-w-[220px] flex-1 items-center gap-2 border-slate-200 px-5 py-4 md:border-r"
		>
			{#if searchCategory === 'car'}
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
					variant="searchBar"
					class="w-full"
				/>
			{:else}
				<DateRangePicker
					label="Check-in – Check-out"
					startDate={checkIn}
					endDate={checkOut}
					onChange={(start, end) => {
						checkIn = start;
						checkOut = end;
					}}
					minDate={todayString()}
					variant="searchBar"
					class="w-full"
				/>
			{/if}
		</div>

		<!-- Guests -->
		{#if searchCategory !== 'car'}
			<div
				class="relative flex min-w-0 flex-1 items-center gap-2 border-slate-200 px-5 py-4 md:border-r"
			>
				<svg
					class="h-4 w-4 shrink-0 text-slate-400"
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
				<button
					type="button"
					onclick={() => (showGuestPicker = !showGuestPicker)}
					class="min-w-0 flex-1 text-left"
				>
					<p class="mb-0.5 text-[9px] font-bold tracking-widest text-slate-400 uppercase">Guests</p>
					<p class="truncate text-sm font-semibold text-slate-800">
						{adults} Adult{adults !== 1 ? 's' : ''}{children > 0
							? `, ${children} Child${children !== 1 ? 'ren' : ''}`
							: ''}
					</p>
				</button>

				{#if showGuestPicker}
					<div
						class="absolute top-full left-0 z-50 mt-2 w-72 space-y-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
					>
						<div class="flex items-center justify-between border-b border-slate-100 py-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">Adults</p>
								<p class="text-[10px] text-slate-400">Age 13+</p>
							</div>
							<div class="flex items-center gap-3">
								<button
									type="button"
									onclick={() => (adults = Math.max(1, adults - 1))}
									disabled={adults <= 1}
									class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-lg font-light text-slate-600 hover:bg-slate-50 disabled:opacity-30"
									>−</button
								>
								<span class="w-5 text-center text-sm font-bold text-slate-900">{adults}</span>
								<button
									type="button"
									onclick={() => (adults = Math.min(16, adults + 1))}
									class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-lg font-light text-slate-600 hover:bg-slate-50"
									>+</button
								>
							</div>
						</div>
						<div class="flex items-center justify-between border-b border-slate-100 py-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">Children</p>
								<p class="text-[10px] text-slate-400">Ages 2–12</p>
							</div>
							<div class="flex items-center gap-3">
								<button
									type="button"
									onclick={() => (children = Math.max(0, children - 1))}
									disabled={children <= 0}
									class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-lg font-light text-slate-600 hover:bg-slate-50 disabled:opacity-30"
									>−</button
								>
								<span class="w-5 text-center text-sm font-bold text-slate-900">{children}</span>
								<button
									type="button"
									onclick={() => (children = Math.min(10, children + 1))}
									class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-lg font-light text-slate-600 hover:bg-slate-50"
									>+</button
								>
							</div>
						</div>
						<div class="flex items-center justify-between py-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">Rooms</p>
								<p class="text-[10px] text-slate-400">Number of rooms</p>
							</div>
							<div class="flex items-center gap-3">
								<button
									type="button"
									onclick={() => (rooms = Math.max(1, rooms - 1))}
									disabled={rooms <= 1}
									class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-lg font-light text-slate-600 hover:bg-slate-50 disabled:opacity-30"
									>−</button
								>
								<span class="w-5 text-center text-sm font-bold text-slate-900">{rooms}</span>
								<button
									type="button"
									onclick={() => (rooms = Math.min(8, rooms + 1))}
									class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-lg font-light text-slate-600 hover:bg-slate-50"
									>+</button
								>
							</div>
						</div>
						<button
							type="button"
							onclick={() => (showGuestPicker = false)}
							class="mt-2 w-full rounded-xl bg-[#0c2614] py-2 text-xs font-bold text-white"
							>Done</button
						>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Explore Now -->
		<div class="flex shrink-0 items-center p-2">
			<button
				type="submit"
				disabled={searching}
				class="flex h-full w-full items-center justify-center gap-2 rounded-xl bg-[#1D8D2B] px-6 py-3 text-sm font-bold whitespace-nowrap text-white transition hover:bg-[#16852a] disabled:opacity-60 md:w-auto"
			>
				{#if searching}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
					></div>
					Searching
				{:else}
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
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					Explore Now
				{/if}
			</button>
		</div>
	</div>
</form>
