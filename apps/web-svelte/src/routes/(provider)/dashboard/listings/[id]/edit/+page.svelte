<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		getProviderListing,
		updateListing,
		activateListing,
		geocodeAddress,
		getRoomTypes,
		createRoomType,
		updateRoomType,
		deleteRoomType,
		type ProviderListingDetail,
		type ProviderRoomType
	} from '$lib/provider-api';
	import PhotoUploader from '$lib/components/PhotoUploader.svelte';
	import { cn } from '$lib/utils';

	const id = $derived(String(page.params.id ?? ''));

	let listing = $state<ProviderListingDetail | null>(null);
	let loading = $state(true);
	let error = $state(false);

	let title = $state('');
	let description = $state('');
	let town = $state('');
	let country = $state('');
	let address = $state('');
	let price = $state('');
	let currency = $state('KES');
	let minStay = $state('1');
	let checkinTime = $state('14:00');
	let checkoutTime = $state('11:00');
	let cancellationPolicy = $state('flexible');
	let instantBooking = $state(false);
	let geocodeMsg = $state('');
	let savedLatLng = $state<{ lat?: number; lng?: number }>({});
	let saving = $state(false);
	let saveMsg = $state('');
	let saveError = $state('');

	// Amenities — grouped by the API's category buckets.
	const AMENITY_GROUPS: { category: string; keys: string[] }[] = [
		{ category: 'Connectivity', keys: ['Wi-Fi', 'Free parking', 'Breakfast included'] },
		{ category: 'Food & Drink', keys: ['Kitchen', 'BBQ', 'Bar'] },
		{ category: 'Wellness', keys: ['Pool', 'Gym', 'Spa', 'Hot tub'] },
		{ category: 'Comfort', keys: ['Air conditioning', 'Heating', 'Fireplace', 'Washer', 'Dryer'] },
		{ category: 'Services', keys: ['Housekeeping', 'Airport transfer', '24/7 front desk'] }
	];
	let selectedAmenities = $state<string[]>([]);

	// Room types (hotels only)
	let roomTypes = $state<ProviderRoomType[]>([]);
	let rtName = $state('');
	let rtType = $state('standard');
	let rtPrice = $state('');
	let rtUnits = $state('1');
	let rtGuests = $state('');
	let rtBusy = $state(false);
	let rtMsg = $state('');
	let rtError = $state('');
	const ROOM_TYPE_OPTIONS = [
		'standard', 'superior', 'deluxe', 'suite', 'junior_suite',
		'studio', 'family_room', 'presidential_suite'
	];

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const l = await getProviderListing(id);
				if (!l) {
					error = true;
					return;
				}
				listing = l;
				title = l.name ?? '';

				// Load amenities, room types
				selectedAmenities = [...l.amenities];
				if (l.category === 'hotel') {
					void getRoomTypes(id).then((rts) => {
						roomTypes = rts;
					});
				}

				description = l.description ?? '';
				town = l.town ?? '';
				country = l.country ?? '';
				price = l.pricePerNight ? String(l.pricePerNight) : '';
				currency = l.currency ?? 'KES';
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	async function handleSave(): Promise<void> {
		saving = true;
		saveMsg = '';
		saveError = '';
		// Group the selected flat amenity keys into the API's category buckets.
		const amenities: Record<string, string[]> = {};
		for (const group of AMENITY_GROUPS) {
			const picked = selectedAmenities.filter((a) => group.keys.includes(a));
			if (picked.length) amenities[group.category] = picked;
		}
		try {
			await updateListing(id, {
				listingTitle: title.trim(),
				description: description.trim() || undefined,
				town: town.trim() || undefined,
				country: country.trim() ? country.trim().toUpperCase() : undefined,
				address: address.trim() || undefined,
				...(price ? { pricePerNight: Number(price) } : {}),
				currency: currency.trim().toUpperCase() || undefined,
				...(minStay ? { minStayNights: Number(minStay) } : {}),
				checkinTime,
				checkoutTime,
				cancellationPolicy,
				instantBooking,
				amenities,
				...(savedLatLng.lat != null ? { lat: savedLatLng.lat } : {}),
				...(savedLatLng.lng != null ? { lng: savedLatLng.lng } : {})
			});
			saveMsg = 'Saved successfully.';
		} catch {
			saveError = 'Could not save the listing. Please try again.';
		} finally {
			saving = false;
		}
	}

	async function handleGeocode(): Promise<void> {
		geocodeMsg = 'Geocoding…';
		try {
			const res = await geocodeAddress(address.trim());
			if (res.lat != null && res.lng != null) {
				savedLatLng = res;
				geocodeMsg = `Coordinates set: ${res.lat.toFixed(4)}, ${res.lng.toFixed(4)}`;
			} else {
				geocodeMsg = 'Could not resolve this address.';
			}
		} catch {
			geocodeMsg = 'Could not resolve this address.';
		}
	}

	function toggleAmenity(key: string): void {
		selectedAmenities = selectedAmenities.includes(key)
			? selectedAmenities.filter((a) => a !== key)
			: [...selectedAmenities, key];
	}

	async function handleAddRoomType(): Promise<void> {
		if (!rtName.trim() || !rtPrice.trim()) {
			rtError = 'Room name and price are required.';
			return;
		}
		rtBusy = true;
		rtError = '';
		rtMsg = '';
		try {
			await createRoomType(id, {
				name: rtName.trim(),
				roomType: rtType,
				pricePerNight: Number(rtPrice),
				...(rtUnits ? { unitCount: Number(rtUnits) } : {}),
				...(rtGuests ? { maxGuests: Number(rtGuests) } : {})
			});
			rtName = '';
			rtPrice = '';
			rtUnits = '1';
			rtGuests = '';
			rtMsg = 'Room type added.';
			roomTypes = await getRoomTypes(id);
		} catch {
			rtError = 'Could not add the room type.';
		} finally {
			rtBusy = false;
		}
	}

	async function handleUpdateRoomType(rt: ProviderRoomType, price: string): Promise<void> {
		try {
			await updateRoomType(id, rt.id, { pricePerNight: Number(price) });
			rtMsg = 'Room type updated.';
			roomTypes = await getRoomTypes(id);
		} catch {
			rtError = 'Could not update the room type.';
		}
	}

	async function handleDeleteRoomType(rtId: string): Promise<void> {
		if (!confirm('Delete this room type?')) return;
		try {
			await deleteRoomType(id, rtId);
			roomTypes = roomTypes.filter((r) => r.id !== rtId);
			rtMsg = 'Room type deleted.';
		} catch {
			rtError = 'Could not delete the room type.';
		}
	}

	async function handleActivate(): Promise<void> {
		saving = true;
		saveError = '';
		try {
			await activateListing(id);
			await load();
			saveMsg = 'Listing activated.';
		} catch {
			saveError = 'Could not activate the listing. Please check the details.';
		} finally {
			saving = false;
		}
	}

	const inputCls =
		'w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none';
	const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Edit listing</h1>
			<p class="mt-1 text-sm text-slate-500">Fill in the core details for your listing.</p>
		</div>
		<a href="/dashboard/listings" class="text-sm font-semibold text-slate-400 hover:text-[#0c2614]">
			← Back to listings
		</a>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-14 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error || !listing}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load this listing.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else}
		{#if saveMsg}
			<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
				{saveMsg}
			</div>
		{/if}
		{#if saveError}
			<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
				{saveError}
			</div>
		{/if}

		<div class="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
			<div>
				<label for="l-name" class={labelCls}>Title</label>
				<input id="l-name" bind:value={title} placeholder="e.g. Serenity Beach House" class={inputCls} />
			</div>
			<div>
				<label for="l-desc" class={labelCls}>Description</label>
				<textarea
					id="l-desc"
					bind:value={description}
					rows="4"
					maxlength="1000"
					placeholder="Describe your property…"
					class={cn(inputCls, 'resize-none')}
				></textarea>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="l-town" class={labelCls}>Town / City</label>
					<input id="l-town" bind:value={town} placeholder="e.g. Mombasa" class={inputCls} />
				</div>
				<div>
					<label for="l-country" class={labelCls}>Country (2-letter code)</label>
					<input
						id="l-country"
						bind:value={country}
						placeholder="e.g. KE"
						maxlength="2"
						class={inputCls}
					/>
				</div>
			</div>
			<div>
				<label for="l-address" class={labelCls}>Address</label>
				<div class="flex gap-2">
					<input id="l-address" bind:value={address} placeholder="Street address" class={inputCls} />
					<button
						type="button"
						onclick={() => void handleGeocode()}
						class="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
					>
						Geocode
					</button>
				</div>
				{#if geocodeMsg}
					<p class="mt-1 text-xs text-slate-400">{geocodeMsg}</p>
				{/if}
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<label for="l-price" class={labelCls}>Price per {listing.category === 'car' ? 'day' : 'night'}</label>
					<input id="l-price" type="number" min="0" bind:value={price} placeholder="0" class={inputCls} />
				</div>
				<div>
					<label for="l-currency" class={labelCls}>Currency</label>
					<input id="l-currency" bind:value={currency} placeholder="KES" maxlength="3" class={inputCls} />
				</div>
				<div>
					<label for="l-minstay" class={labelCls}>Minimum stay (nights)</label>
					<input id="l-minstay" type="number" min="1" bind:value={minStay} class={inputCls} />
				</div>
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<label for="l-checkin" class={labelCls}>Check-in time</label>
					<input id="l-checkin" type="time" bind:value={checkinTime} class={inputCls} />
				</div>
				<div>
					<label for="l-checkout" class={labelCls}>Check-out time</label>
					<input id="l-checkout" type="time" bind:value={checkoutTime} class={inputCls} />
				</div>
				<div>
					<label for="l-cancel" class={labelCls}>Cancellation policy</label>
					<select id="l-cancel" bind:value={cancellationPolicy} class={inputCls}>
						<option value="flexible">Flexible</option>
						<option value="moderate">Moderate</option>
						<option value="strict">Strict</option>
					</select>
				</div>
			</div>

			<div>
				<label class="flex items-center gap-2 text-sm font-medium text-slate-700">
					<input type="checkbox" bind:checked={instantBooking} class="h-4 w-4 accent-[#1D8D2B]" />
					Instant booking (no approval needed)
				</label>
			</div>

			<!-- Photos -->
			<div class="border-t border-slate-100 pt-4">
				<h3 class="mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">Photos</h3>
				<PhotoUploader listingId={id} photos={listing.photos} onChange={() => void load()} />
			</div>

			<!-- Amenities -->
			<div class="border-t border-slate-100 pt-4">
				<h3 class="mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">Amenities</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					{#each AMENITY_GROUPS as group (group.category)}
						<div>
							<p class="mb-1.5 text-xs font-semibold text-slate-500">{group.category}</p>
							<div class="flex flex-wrap gap-1.5">
								{#each group.keys as key (key)}
									<button
										type="button"
										onclick={() => toggleAmenity(key)}
										class={cn(
											'rounded-full border px-3 py-1 text-xs font-semibold transition',
											selectedAmenities.includes(key)
												? 'border-[#1D8D2B] bg-[#1D8D2B]/10 text-[#0c2614]'
												: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
										)}
									>
										{key}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>

			{#if listing.category === 'hotel'}
				<!-- Room types -->
				<div class="border-t border-slate-100 pt-4">
					<h3 class="mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">Room types</h3>
					{#if rtMsg}
						<p class="mb-2 text-xs font-semibold text-emerald-700">{rtMsg}</p>
					{/if}
					{#if rtError}
						<p class="mb-2 text-xs font-semibold text-red-600">{rtError}</p>
					{/if}
					<div class="space-y-2">
						{#each roomTypes as rt (rt.id)}
							<div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
								<div>
									<p class="text-sm font-semibold text-slate-800">{rt.name}</p>
									<p class="text-xs text-slate-400 capitalize">
										{rt.roomType.replace(/_/g, ' ')}{rt.maxGuests ? ` · up to ${rt.maxGuests} guests` : ''}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<input
										type="number"
										min="0"
										value={rt.pricePerNight}
										placeholder="Price"
										class="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
										onchange={(e) =>
											void handleUpdateRoomType(rt, (e.currentTarget as HTMLInputElement).value)}
									/>
									<button
										type="button"
										onclick={() => void handleDeleteRoomType(rt.id)}
										class="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
									>
										✕
									</button>
								</div>
							</div>
						{/each}
					</div>
					<div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
						<input bind:value={rtName} placeholder="Room name" class={inputCls} />
						<select bind:value={rtType} class={inputCls}>
							{#each ROOM_TYPE_OPTIONS as o (o)}
								<option value={o}>{o.replace(/_/g, ' ')}</option>
							{/each}
						</select>
						<input type="number" min="0" bind:value={rtPrice} placeholder="Price" class={inputCls} />
						<input type="number" min="1" bind:value={rtUnits} placeholder="Units" class={inputCls} />
						<input type="number" min="1" bind:value={rtGuests} placeholder="Max guests" class={inputCls} />
						<button
							type="button"
							onclick={() => void handleAddRoomType()}
							disabled={rtBusy}
							class="rounded-xl bg-[#1D8D2B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15803d] disabled:opacity-50"
						>
							{rtBusy ? '…' : 'Add'}
						</button>
					</div>
				</div>
			{/if}

			<div class="flex flex-wrap gap-3 pt-2">
				<button
					type="button"
					onclick={() => void handleSave()}
					disabled={saving}
					class="rounded-xl bg-[#0c2614] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#081b0d] disabled:opacity-60"
				>
					{saving ? 'Saving…' : 'Save changes'}
				</button>
				<button
					type="button"
					onclick={() => void handleActivate()}
					disabled={saving}
					class="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
				>
					Activate listing
				</button>
			</div>
		</div>
	{/if}
</div>
