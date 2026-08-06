<script lang="ts">
	import type { PublicListing, PublicListingDetail } from '$lib/listing-api';
	import { cn } from '$lib/utils';
	import { formatMoney, resolvePlatformCurrency } from '$lib/currency-display';
	import { listingHref } from '$lib/listing-meta';
	import { auth } from '$lib/stores/auth.svelte';
	import { addFavourite, removeFavourite } from '$lib/account-api';
	import ListingImage from './ListingImage.svelte';

	let {
		listing,
		hovered = false,
		onmouseenter = () => {},
		onmouseleave = () => {}
	}: {
		listing: PublicListing & Partial<PublicListingDetail>;
		hovered?: boolean;
		onmouseenter?: () => void;
		onmouseleave?: () => void;
	} = $props();

	const isCar = $derived(listing.category === 'car');
	const unit = $derived(isCar ? 'day' : 'night');
	const location = $derived([listing.town, listing.country].filter(Boolean).join(', '));
	let favOverride = $state<boolean | null>(null);
	let favPending = $state(false);
	const isFav = $derived(favOverride ?? listing.isFavourited ?? false);

	async function toggleFav(): Promise<void> {
		if (!canFavourite || favPending) return;
		const next = !isFav;
		favOverride = next;
		favPending = true;
		try {
			if (next) await addFavourite(listing.id);
			else await removeFavourite(listing.id);
		} catch {
			// Roll back the optimistic update on failure.
			favOverride = !next;
		} finally {
			favPending = false;
		}
	}
	// Favourites are tied to an account — hide the heart for guests and
	// anonymous checkout sessions.
	const canFavourite = $derived(auth.isAuthenticated);

	const promoPct = $derived(
		listing.promoBadge?.labelText
			? parseFloat(listing.promoBadge.labelText.replace(/[^0-9.]/g, '')) || 0
			: 0
	);
	const promoColour = $derived(listing.promoBadge?.labelColour || '#C84B2F');
	const rawPrice = $derived(listing.pricePerNight);
	const basePrice = $derived(
		promoPct > 0
			? rawPrice
			: listing.mrpPrice && listing.mrpPrice > listing.pricePerNight
				? listing.mrpPrice
				: listing.pricePerNight
	);
	const displayPrice = $derived(
		promoPct > 0 ? Number((rawPrice * (1 - promoPct / 100)).toFixed(2)) : listing.pricePerNight
	);
	const discountPct = $derived(
		basePrice > displayPrice ? Math.round(((basePrice - displayPrice) / basePrice) * 100) : 0
	);
	const promoLabel = $derived(
		promoPct > 0 ? (listing.promoBadge?.labelText ?? `${promoPct}% OFF`) : ''
	);

	const localizedRate = $derived(
		isCar
			? (listing.localizedDailyRate ?? listing.localizedNightlyRate)
			: listing.localizedNightlyRate
	);
	const promoLocalizedRate = $derived(
		promoPct > 0 && localizedRate ? Number((localizedRate * (1 - promoPct / 100)).toFixed(2)) : null
	);
	/** True when the API returned a converted price in the guest's display currency. */
	const hasLocalized = $derived(
		!!listing.localizedCurrency &&
			listing.localizedCurrency !== listing.currency &&
			(promoLocalizedRate ?? localizedRate) != null &&
			(promoLocalizedRate ?? localizedRate)! > 0
	);
	const displayCode = $derived(listing.localizedCurrency ?? listing.currency);
	const platformCode = $derived(resolvePlatformCurrency(listing.country));
	/** The displayed amount is an estimate only when a display→charge conversion exists. */
	const estimate = $derived(displayCode !== platformCode);
</script>

<a
	href={listingHref(listing.category, listing.id)}
	{onmouseenter}
	{onmouseleave}
	class={cn(
		'group relative block cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl',
		hovered
			? 'border-[#1D8D2B] ring-2 ring-[#1D8D2B]/60'
			: 'border-slate-200 hover:border-[#1D8D2B]'
	)}
>
	<div class="relative h-44 w-full overflow-hidden">
		<ListingImage
			src={listing.primaryPhotoUrl}
			alt={listing.name}
			category={listing.category}
			class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
		/>

		{#if listing.isAccredited || listing.instantBooking || discountPct > 0 || (!isCar && (listing.minStayNights ?? 1) > 1)}
			<div class="absolute top-3 left-3 z-10 flex flex-col gap-1">
				{#if listing.isAccredited}
					<span
						class="flex items-center gap-1 rounded-full bg-[#1D8D2B]/90 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur-sm"
					>
						<svg
							class="h-2.5 w-2.5"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
						Verified
					</span>
				{/if}
				{#if listing.instantBooking}
					<span
						class="rounded-full bg-[#1D8D2B]/90 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur-sm"
					>
						Instant Book
					</span>
				{/if}
				{#if promoLabel}
					<span
						class="rounded-full px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur-sm"
						style={`background-color:${promoColour}`}
					>
						{promoLabel}
					</span>
				{:else if discountPct > 0}
					<span
						class="rounded-full bg-[#C84B2F] px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur-sm"
					>
						{discountPct}% OFF
					</span>
				{/if}
				{#if !isCar && (listing.minStayNights ?? 1) > 1}
					<span
						class="rounded-full bg-slate-800/80 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur-sm"
					>
						Min {listing.minStayNights} nights
					</span>
				{/if}
			</div>
		{/if}

		{#if canFavourite}
			<button
				type="button"
				onclick={(e) => {
					e.preventDefault();
					void toggleFav();
				}}
				disabled={favPending}
				class="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-60"
				aria-label={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
			>
				<svg
					class={isFav ? 'h-3.5 w-3.5 fill-current text-red-500' : 'h-3.5 w-3.5 text-slate-500'}
					fill="none"
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
		{/if}
	</div>

	<div class="p-4">
		<div class="mb-1.5 flex items-center justify-between">
			<p class="truncate text-[10px] font-bold tracking-wider text-slate-500 uppercase">
				{location}
			</p>
			<div class="ml-2 shrink-0 text-right">
				{#if basePrice > displayPrice}
					<p class="text-[9px] leading-none text-slate-400 line-through">
						{formatMoney(basePrice, listing.currency)}
					</p>
				{/if}
				{#if hasLocalized}
					<p class="text-sm font-bold text-slate-800">
						{formatMoney(promoLocalizedRate ?? localizedRate, displayCode, { approx: estimate })}
						<span class="text-[10px] font-medium text-slate-400">/{unit}</span>
					</p>
					<p class="text-[10px] font-medium text-slate-400">
						{formatMoney(displayPrice, listing.currency, { equiv: true })}/{unit}
					</p>
				{:else}
					<p class="text-sm font-bold text-slate-800">
						{formatMoney(displayPrice, displayCode, { approx: estimate })}
						<span class="text-[10px] font-medium text-slate-400">/{unit}</span>
					</p>
				{/if}
			</div>
		</div>
		<h3
			class="mb-2 line-clamp-1 text-sm leading-snug font-bold text-slate-900 transition group-hover:text-[#024622]"
		>
			{listing.name}
		</h3>
		<div class="flex items-center justify-between">
			<p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
				{#if isCar}
					{#if listing.carMake}
						<span class="capitalize">
							{listing.carMake}{listing.carModel ? ` ${listing.carModel}` : ''}{listing.carYear
								? ` ${listing.carYear}`
								: ''}
						</span>
					{/if}
					{#if listing.seats}<span>{listing.seats} Seats</span>{/if}
					{#if listing.transmission}<span class="capitalize">{listing.transmission}</span>{/if}
					{#if listing.fuelType}<span class="capitalize">{listing.fuelType}</span>{/if}
				{:else}
					{#if listing.bedrooms}<span
							>{listing.bedrooms} Bed{listing.bedrooms !== 1 ? 's' : ''}</span
						>{/if}
					{#if listing.bathrooms}<span
							>{listing.bathrooms} Bath{listing.bathrooms !== 1 ? 's' : ''}</span
						>{/if}
					{#if listing.maxGuests}<span
							>{listing.maxGuests} Guest{listing.maxGuests !== 1 ? 's' : ''}</span
						>{/if}
				{/if}
			</p>
			<span
				class="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0c2614] transition group-hover:text-[#1D8D2B]"
			>
				{#if listing.starRating}
					<span class="flex items-center gap-0.5">
						<span class="text-amber-400">★</span>{listing.starRating}
					</span>
				{/if}
				Explore <span class="text-base leading-none">›</span>
			</span>
		</div>
	</div>
</a>
