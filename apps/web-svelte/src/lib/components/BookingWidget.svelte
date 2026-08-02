<script lang="ts">
	import { goto } from '$app/navigation';
	import { LISTING_API_URL } from '$lib/config';
	import {
		fetchListingAvailability,
		isRangeAvailable,
		type PublicListingDetail
	} from '$lib/listing-api';
	import { computePriceBreakdown, getTaxRate, nightsBetween } from '$lib/pricing';
	import { currencySymbol } from '$lib/utils';
	import DateRangePicker from './DateRangePicker.svelte';

	let { listing }: { listing: PublicListingDetail } = $props();

	const isCar = $derived(listing.category === 'car');
	const unit = $derived(isCar ? 'day' : 'night');

	const cheapestRoom = $derived(
		listing.category === 'hotel' && listing.roomTypes && listing.roomTypes.length > 0
			? listing.roomTypes.reduce((min, rt) => {
					const minLocal = min.localizedPricePerNight ?? min.pricePerNight;
					const rtLocal = rt.localizedPricePerNight ?? rt.pricePerNight;
					return rtLocal < minLocal ? rt : min;
				})
			: null
	);
	/* True when the API returned prices converted into a different currency,
	   so shown amounts are an estimate against the actual (base) price. */
	const converted = $derived(
		!!listing.localizedCurrency && listing.localizedCurrency !== listing.currency
	);
	const rate = $derived(
		converted
			? (cheapestRoom?.localizedPricePerNight ??
					listing.localizedNightlyRate ??
					listing.localizedDailyRate ??
					cheapestRoom?.pricePerNight ??
					listing.pricePerNight)
			: (cheapestRoom?.pricePerNight ?? listing.pricePerNight)
	);
	const sym = $derived(currencySymbol(listing.localizedCurrency ?? listing.currency));
	const baseSym = $derived(currencySymbol(listing.currency));
	const baseRate = $derived(cheapestRoom?.pricePerNight ?? listing.pricePerNight);
	const securityDeposit = $derived(
		listing.localizedSecurityDeposit ?? listing.securityDeposit ?? 0
	);
	const securityDepositBase = $derived(listing.securityDeposit ?? 0);
	const deliveryFee = $derived(listing.localizedDeliveryFee ?? listing.deliveryFee ?? 0);
	const deliveryFeeBase = $derived(listing.deliveryFee ?? 0);

	const promoPct = $derived(
		listing.promoBadge?.labelText
			? parseFloat(listing.promoBadge.labelText.replace(/[^0-9.]/g, '')) || 0
			: 0
	);
	const promoLabel = $derived(
		promoPct > 0 ? (listing.promoBadge?.labelText ?? `${promoPct}% OFF`) : ''
	);
	/* Discounted per-unit rate shown in the header (original stays as the base). */
	const displayRate = $derived(
		promoPct > 0 ? Number((rate * (1 - promoPct / 100)).toFixed(2)) : rate
	);

	let checkIn = $state('');
	let checkOut = $state('');
	let guests = $state(2);
	let deliveryRequested = $state(false);
	let availData = $state<
		| { unavailableRanges: { start: string; end: string }[]; roomTypeAvailability?: unknown[] }
		| null
		| undefined
	>(undefined);

	/* Promo discount in currency units for the breakdown (applied to the base amount). */
	const promotionDiscount = $derived(
		checkIn && checkOut && promoPct > 0
			? Number((rate * nightsBetween(checkIn, checkOut) * (promoPct / 100)).toFixed(2))
			: 0
	);

	const breakdown = $derived.by(() =>
		checkIn && checkOut
			? computePriceBreakdown({
					pricePerNight: rate,
					checkIn,
					checkOut,
					commissionRate: listing.commissionRate,
					taxRate: getTaxRate(listing.country),
					category: listing.category,
					deliveryFee: deliveryRequested ? deliveryFee : 0,
					securityDeposit,
					driverProvided: listing.driverProvided,
					promotionDiscount
				})
			: null
	);

	const selectedRanges = $derived.by(() => {
		if (!availData) return null;
		if (cheapestRoom?.id && Array.isArray(availData.roomTypeAvailability)) {
			const rt = (
				availData.roomTypeAvailability as {
					roomTypeId: string;
					unavailableRanges: { start: string; end: string }[];
				}[]
			).find((r) => r.roomTypeId === cheapestRoom.id);
			if (rt) return rt.unavailableRanges;
		}
		return availData.unavailableRanges ?? [];
	});

	const availStatus = $derived<'idle' | 'checking' | 'available' | 'unavailable'>(
		!checkIn || !checkOut
			? 'idle'
			: availData === undefined
				? 'checking'
				: availData === null
					? 'idle'
					: isRangeAvailable(selectedRanges, checkIn, checkOut)
						? 'available'
						: 'unavailable'
	);

	$effect(() => {
		if (!checkIn || !checkOut) {
			availData = undefined;
			return;
		}
		let cancelled = false;
		availData = undefined;
		void fetchListingAvailability(fetch, listing.id, LISTING_API_URL, checkIn, checkOut)
			.then((data) => {
				if (!cancelled) availData = data ?? null;
			})
			.catch(() => {
				if (!cancelled) availData = null;
			});
		return () => {
			cancelled = true;
		};
	});

	function continueToBooking(): void {
		if (!checkIn || !checkOut || availStatus === 'unavailable' || availStatus === 'checking')
			return;
		const params = new URLSearchParams({
			listingId: listing.id,
			start: checkIn,
			end: checkOut,
			guests: String(guests),
			nights: String(breakdown?.nights ?? 0),
			currency: listing.localizedCurrency ?? listing.currency,
			...(cheapestRoom?.id ? { roomTypeId: cheapestRoom.id } : {})
		});
		void goto(`/booking/review?${params.toString()}`);
	}
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="flex flex-wrap items-baseline gap-2">
				<p class="text-2xl font-extrabold text-slate-900">
					{#if converted}<span class="text-sm font-medium text-slate-400">~</span>{/if}
					{sym}{displayRate > 0 ? displayRate.toLocaleString() : '—'}
					{#if promoPct > 0}
						<span class="ml-1 text-sm font-semibold text-slate-400 line-through">
							{sym}{rate.toLocaleString()}
						</span>
					{/if}
				</p>
			</div>
			<p class="mt-0.5 text-xs font-medium text-slate-400">/ {unit}</p>
			{#if converted}
				<p class="mt-0.5 text-[11px] font-medium text-slate-400">
					≈ {baseSym}{baseRate.toLocaleString()}
					{listing.currency}/{unit}
				</p>
			{/if}
		</div>
		{#if listing.minStayNights > 1}
			<p class="shrink-0 text-[10px] font-semibold text-slate-400">
				Min {listing.minStayNights}
				{unit}s
			</p>
		{/if}
	</div>

	{#if promoPct > 0}
		<div
			class="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"
		>
			<span class="shrink-0 text-base">🏷️</span>
			<div class="min-w-0 flex-1">
				<p class="text-[10px] font-bold tracking-wider text-emerald-700 uppercase">Best Offer</p>
			</div>
			<span
				class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-emerald-700"
			>
				{promoLabel}
			</span>
		</div>
	{/if}

	{#if cheapestRoom}
		<p class="mt-3 text-[11px] font-medium text-slate-400">
			{cheapestRoom.name}{cheapestRoom.maxGuests ? ` · up to ${cheapestRoom.maxGuests} guests` : ''}
		</p>
	{/if}

	{#if isCar && listing.driverProvided}
		<div
			class="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800"
		>
			<span class="shrink-0">🧑‍✈️</span>
			<span
				><strong>Driver included:</strong> a driver is provided with this vehicle — no security deposit
				is required.</span
			>
		</div>
	{:else if isCar && listing.securityDeposit != null && listing.securityDeposit > 0}
		<div
			class="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-slate-600"
		>
			<span class="shrink-0 font-bold text-amber-600">🔒</span>
			<span
				><strong>Security deposit:</strong>
				{#if converted}<span>~ </span>{/if}
				{sym}{(securityDeposit ?? 0).toLocaleString()}
				{#if converted && securityDepositBase > 0}
					({baseSym}{(securityDepositBase ?? 0).toLocaleString()})
				{/if}
				— collected at booking.</span
			>
		</div>
	{/if}

	<div class="mt-4 space-y-3">
		<DateRangePicker
			startDate={checkIn}
			endDate={checkOut}
			{isCar}
			variant="field"
			onChange={(s, e) => {
				checkIn = s;
				checkOut = e;
			}}
		/>

		{#if isCar && listing.deliveryAvailable}
			<div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
				<label class="flex cursor-pointer items-center justify-between gap-2 select-none">
					<div>
						<p class="text-sm font-semibold text-slate-800">Request vehicle delivery</p>
						<p class="mt-0.5 text-xs text-slate-400">
							{#if deliveryFee > 0}
								{#if converted}<span>~ </span>{/if}
								{sym}{deliveryFee.toLocaleString()} delivery fee
								{#if converted && deliveryFeeBase > 0}
									({baseSym}{(deliveryFeeBase ?? 0).toLocaleString()})
								{/if}
								· within
								{listing.deliveryRadiusKm ?? '—'} km
							{:else}
								Free delivery · within {listing.deliveryRadiusKm ?? '—'} km
							{/if}
						</p>
					</div>
					<input
						type="checkbox"
						bind:checked={deliveryRequested}
						class="rounded border-slate-300 text-[#1D8D2B] focus:ring-[#1D8D2B]"
					/>
				</label>
			</div>
		{/if}

		<div>
			<span class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
				Guests
			</span>
			<div
				class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
			>
				<button
					type="button"
					onclick={() => (guests = Math.max(1, guests - 1))}
					class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-[#1D8D2B] hover:text-[#1D8D2B]"
					aria-label="Decrease guests">−</button
				>
				<span class="text-sm font-semibold text-slate-800">{guests}</span>
				<button
					type="button"
					onclick={() => (guests = Math.min(listing.maxGuests ?? 20, guests + 1))}
					class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-[#1D8D2B] hover:text-[#1D8D2B]"
					aria-label="Increase guests">+</button
				>
			</div>
		</div>
	</div>

	{#if availStatus === 'checking'}
		<p class="mt-3 text-xs font-medium text-slate-400">Checking availability…</p>
	{:else if availStatus === 'unavailable'}
		<p
			class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
		>
			These dates aren't available for this {listing.category === 'car' ? 'vehicle' : 'property'}.
		</p>
	{/if}

	{#if breakdown}
		<div class="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
			<div class="flex justify-between">
				<span>
					{sym}{rate.toLocaleString()} × {breakdown.nights}
					{unit}{breakdown.nights > 1 ? 's' : ''}
				</span>
				<span>{sym}{breakdown.baseAmount.toLocaleString()}</span>
			</div>
			{#if breakdown.promotionDiscount > 0}
				<div class="flex justify-between font-semibold text-emerald-600">
					<span>Promotional discount ({promoLabel})</span>
					<span>−{sym}{breakdown.promotionDiscount.toLocaleString()}</span>
				</div>
			{/if}
			{#if listing.commissionRate}
				<div class="flex justify-between">
					<span>Service fee ({Math.round(listing.commissionRate * 100)}%)</span>
					<span>{sym}{breakdown.serviceFee.toLocaleString()}</span>
				</div>
			{/if}
			{#if breakdown.taxAmount > 0}
				<div class="flex justify-between">
					<span>Taxes ({Math.round(getTaxRate(listing.country) * 100)}%)</span>
					<span>{sym}{breakdown.taxAmount.toLocaleString()}</span>
				</div>
			{/if}
			{#if breakdown.deliveryFee > 0}
				<div class="flex justify-between">
					<span>Delivery fee</span>
					<span>{sym}{breakdown.deliveryFee.toLocaleString()}</span>
				</div>
			{/if}
			{#if breakdown.securityDeposit > 0}
				<div class="flex justify-between text-slate-600">
					<span>Security deposit</span>
					<span>{sym}{breakdown.securityDeposit.toLocaleString()}</span>
				</div>
			{/if}
			<div
				class="mt-1 flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900"
			>
				<span>Total</span>
				<span>{sym}{breakdown.total.toLocaleString()}</span>
			</div>
		</div>
	{/if}

	<button
		type="button"
		onclick={continueToBooking}
		disabled={!checkIn || !checkOut || availStatus === 'unavailable' || availStatus === 'checking'}
		class="mt-5 w-full rounded-xl bg-[#1D8D2B] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#16852a] disabled:cursor-not-allowed disabled:opacity-50"
	>
		Continue to booking
	</button>
	<p class="mt-2 text-center text-[10px] text-slate-400">You won't be charged yet.</p>
</div>
