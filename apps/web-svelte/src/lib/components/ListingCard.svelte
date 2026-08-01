<script lang="ts">
	import type { PublicListing, PublicListingDetail } from '$lib/listing-api';
	import { currencySymbol } from '$lib/utils';
	import ListingImage from './ListingImage.svelte';

	let { listing }: { listing: PublicListing & Partial<PublicListingDetail> } = $props();

	const isCar = $derived(listing.category === 'car');
	const unit = $derived(isCar ? 'day' : 'night');
	const location = $derived([listing.town, listing.country].filter(Boolean).join(', '));
	let favOverride = $state<boolean | null>(null);
	const isFav = $derived(favOverride ?? listing.isFavourited ?? false);

	const basePrice = $derived(
		listing.mrpPrice && listing.mrpPrice > listing.pricePerNight
			? listing.mrpPrice
			: listing.pricePerNight
	);
	const discountPct = $derived(
		basePrice > listing.pricePerNight
			? Math.round(((basePrice - listing.pricePerNight) / basePrice) * 100)
			: 0
	);

	const localizedRate = $derived(
		isCar
			? (listing.localizedDailyRate ?? listing.localizedNightlyRate)
			: listing.localizedNightlyRate
	);
	const showLocalized = $derived(
		!!localizedRate &&
			localizedRate > 0 &&
			!!listing.localizedCurrency &&
			listing.localizedCurrency !== listing.currency
	);
	const localizedLabel = $derived(
		showLocalized && localizedRate && listing.localizedCurrency
			? `~${currencySymbol(listing.localizedCurrency)}${localizedRate.toLocaleString()}`
			: ''
	);
</script>

<a
	href={`/listings/${listing.id}`}
	class="group relative block cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-[#1D8D2B] hover:shadow-xl"
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
				{#if discountPct > 0}
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

		<button
			type="button"
			onclick={(e) => {
				e.preventDefault();
				favOverride = !isFav;
			}}
			class="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition hover:bg-white"
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
	</div>

	<div class="p-4">
		<div class="mb-1.5 flex items-center justify-between">
			<p class="truncate text-[10px] font-bold tracking-wider text-slate-500 uppercase">
				{location}
			</p>
			<div class="ml-2 shrink-0 text-right">
				{#if basePrice > listing.pricePerNight}
					<p class="text-[9px] leading-none text-slate-400 line-through">
						{currencySymbol(listing.currency)}{basePrice.toLocaleString()}
					</p>
				{/if}
				{#if localizedLabel}
					<p class="text-sm font-bold text-slate-800">
						{localizedLabel}
						<span class="text-[10px] font-medium text-slate-400">/{unit}</span>
					</p>
					<p class="text-[10px] font-medium text-slate-400">
						{currencySymbol(listing.currency)}
						{listing.pricePerNight > 0 ? listing.pricePerNight.toLocaleString() : '—'}/{unit}
					</p>
				{:else}
					<p class="text-sm font-bold text-slate-800">
						{currencySymbol(listing.currency)}
						{listing.pricePerNight > 0 ? listing.pricePerNight.toLocaleString() : '—'}
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
