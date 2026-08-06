<script lang="ts">
	import { goto } from '$app/navigation';
	import { LISTING_API_URL } from '$lib/config';
	import {
		fetchListingAvailability,
		isRangeAvailable,
		type PublicListingDetail
	} from '$lib/listing-api';
	import { computePriceBreakdown, getTaxRate, nightsBetween } from '$lib/pricing';
	import {
		formatMoney,
		eurMoney,
		resolvePlatformCurrency,
		withChargeBuffer
	} from '$lib/currency-display';
	import { convertFx } from '$lib/payment-api';
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
	/** The chosen room type (defaults to the cheapest), driving price + booking. */
	let selectedRoomId = $state<string | null>(null);
	$effect(() => {
		if (!selectedRoomId && cheapestRoom?.id) selectedRoomId = cheapestRoom.id;
	});
	const selectedRoom = $derived(
		(listing.roomTypes ?? []).find((rt) => rt.id === selectedRoomId) ?? cheapestRoom
	);
	/** True when the API returned prices converted into the guest's display currency. */
	const hasLocalized = $derived(
		!!listing.localizedCurrency && listing.localizedCurrency !== listing.currency
	);
	const displayCode = $derived(listing.localizedCurrency ?? listing.currency);
	const platformCode = $derived(resolvePlatformCurrency(listing.country));
	/** Display-currency amounts are estimates only when a display→charge conversion exists. */
	const estimate = $derived(displayCode !== platformCode);
	/** Show the base/platform meta line when any currency conversion is in play. */
	const showMeta = $derived(hasLocalized || estimate);
	/** The itemized breakdown is shown in the host's currency; its lines are
	 *  estimates only when that currency is also the guest's display currency
	 *  AND a conversion to the platform charge exists. */
	const lineEstimate = $derived(estimate && listing.currency === displayCode);

	/** Per-unit rate shown in the headline (display currency when available). */
	const localizedRate = $derived(
		hasLocalized
			? (selectedRoom?.localizedPricePerNight ??
					listing.localizedNightlyRate ??
					listing.localizedDailyRate)
			: null
	);
	/** Per-unit rate in the host's listed (base) currency — the fee breakdown. */
	const baseRate = $derived(selectedRoom?.pricePerNight ?? listing.pricePerNight);
	const effectiveRate = $derived(hasLocalized ? (localizedRate ?? baseRate) : baseRate);

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
		promoPct > 0 ? Number((effectiveRate * (1 - promoPct / 100)).toFixed(2)) : effectiveRate
	);

	let checkIn = $state('');
	let checkOut = $state('');
	let adults = $state(2);
	let children = $state(0);
	let deliveryRequested = $state(false);
	let availData = $state<
		| { unavailableRanges: { start: string; end: string }[]; roomTypeAvailability?: unknown[] }
		| null
		| undefined
	>(undefined);

	/* Promo discount in currency units for the breakdown (applied to the base
	   amount in the host's listed currency). */
	const promotionDiscount = $derived(
		checkIn && checkOut && promoPct > 0
			? Number((baseRate * nightsBetween(checkIn, checkOut) * (promoPct / 100)).toFixed(2))
			: 0
	);

	/* The itemized fee breakdown is always shown in the host's listed (base)
	   currency — the guest's display currency is only a headline estimate. */
	const breakdown = $derived.by(() =>
		checkIn && checkOut
			? computePriceBreakdown({
					pricePerNight: baseRate,
					checkIn,
					checkOut,
					commissionRate: listing.commissionRate,
					taxRate: getTaxRate(listing.country),
					category: listing.category,
					deliveryFee: deliveryRequested ? Number(listing.deliveryFee ?? 0) : 0,
					securityDeposit: Number(listing.securityDeposit ?? 0),
					driverProvided: listing.driverProvided,
					promotionDiscount
				})
			: null
	);

	/* Buffered estimate of the per-night platform charge (EUR/XAF), fetched once
	   per listing so the PDP meta line matches the checkout's final charge. */
	let platformNightlyRate = $state<number | null>(null);
	$effect(() => {
		if (!showMeta || !baseRate || platformCode === listing.currency) {
			platformNightlyRate = platformCode === listing.currency ? baseRate : null;
			return;
		}
		let cancelled = false;
		void convertFx(baseRate, listing.currency, platformCode)
			.then((res) => {
				if (cancelled) return;
				const raw = res?.converted;
				platformNightlyRate =
					raw != null && Number.isFinite(Number(raw))
						? withChargeBuffer(Number(raw), platformCode)
						: null;
			})
			.catch(() => {
				if (!cancelled) platformNightlyRate = null;
			});
		return () => {
			cancelled = true;
		};
	});

	/* Buffered total charge in the platform currency (EUR/XAF) for the selected
	   dates — shown in the breakdown so the guest always sees what they'll
	   actually be charged, never labelled as an estimate. */
	let platformTotal = $state<number | null>(null);
	$effect(() => {
		if (!estimate || !breakdown || breakdown.total <= 0) {
			platformTotal = null;
			return;
		}
		let cancelled = false;
		void convertFx(breakdown.total, listing.currency, platformCode)
			.then((res) => {
				if (cancelled) return;
				const raw = res?.converted;
				platformTotal =
					raw != null && Number.isFinite(Number(raw))
						? withChargeBuffer(Number(raw), platformCode)
						: null;
			})
			.catch(() => {
				if (!cancelled) platformTotal = null;
			});
		return () => {
			cancelled = true;
		};
	});

	/* Total converted to the guest's display currency for the priority summary
	   row (a reference — the charge itself is always in the platform currency). */
	let localTotal = $state<number | null>(null);
	$effect(() => {
		if (!breakdown || breakdown.total <= 0) {
			localTotal = null;
			return;
		}
		if (displayCode === listing.currency) {
			localTotal = breakdown.total;
			return;
		}
		let cancelled = false;
		void convertFx(breakdown.total, listing.currency, displayCode)
			.then((res) => {
				if (cancelled) return;
				const raw = res?.converted;
				localTotal = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
			})
			.catch(() => {
				if (!cancelled) localTotal = null;
			});
		return () => {
			cancelled = true;
		};
	});

	const selectedRanges = $derived.by(() => {
		if (!availData) return null;
		if (selectedRoom?.id && Array.isArray(availData.roomTypeAvailability)) {
			const rt = (
				availData.roomTypeAvailability as {
					roomTypeId: string;
					unavailableRanges: { start: string; end: string }[];
				}[]
			).find((r) => r.roomTypeId === selectedRoom.id);
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
			adults: String(adults),
			children: String(children),
			nights: String(breakdown?.nights ?? 0),
			currency: listing.localizedCurrency ?? listing.currency,
			...(selectedRoom?.id ? { roomTypeId: selectedRoom.id } : {})
		});
		void goto(`/booking/review?${params.toString()}`);
	}
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="flex flex-wrap items-baseline gap-2">
				<p class="text-2xl font-extrabold text-slate-900">
					{formatMoney(displayRate, displayCode, { approx: estimate })}
					{#if promoPct > 0}
						<span class="ml-1 text-sm font-semibold text-slate-400 line-through">
							{formatMoney(effectiveRate, displayCode)}
						</span>
					{/if}
				</p>
			</div>
			<p class="mt-0.5 text-xs font-medium text-slate-400">/ {unit}</p>
			{#if showMeta}
				<p class="mt-0.5 text-[11px] font-medium text-slate-400">
					{#if hasLocalized}
						Base: {formatMoney(baseRate, listing.currency)}/{unit}
					{/if}
					{#if platformCode !== listing.currency && platformNightlyRate != null}
						{#if hasLocalized}•{/if}
						{platformCode === 'EUR'
							? eurMoney(platformNightlyRate)
							: formatMoney(platformNightlyRate, platformCode)}
						/{unit}
					{/if}
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

	{#if cheapestRoom && (listing.roomTypes?.length ?? 0) > 1}
		<div class="mt-3">
			<label
				for="booking-room-type"
				class="mb-1 block text-[10px] font-bold tracking-wider text-slate-400 uppercase"
			>
				Room type
			</label>
			<select
				id="booking-room-type"
				bind:value={selectedRoomId}
				class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition focus:border-[#1D8D2B] focus:outline-none"
			>
				{#each listing.roomTypes ?? [] as rt (rt.id)}
					<option value={rt.id}>
						{rt.name}
						{rt.maxGuests ? ` · up to ${rt.maxGuests} guests` : ''} —
						{formatMoney(
							hasLocalized ? (rt.localizedPricePerNight ?? rt.pricePerNight) : rt.pricePerNight,
							hasLocalized ? (listing.localizedCurrency ?? listing.currency) : listing.currency
						)}
						/ {unit}
					</option>
				{/each}
			</select>
		</div>
	{:else if cheapestRoom}
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
				{formatMoney(securityDepositBase, listing.currency)}
				{#if hasLocalized && securityDeposit > 0}
					({formatMoney(securityDeposit, displayCode, { approx: estimate })})
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
							{#if deliveryFeeBase > 0}
								{formatMoney(deliveryFeeBase, listing.currency)} delivery fee
								{#if hasLocalized && deliveryFee > 0}
									({formatMoney(deliveryFee, displayCode, { approx: estimate })})
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
			<div class="space-y-2">
				<div
					class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
				>
					<span class="text-xs font-semibold text-slate-600">Adults</span>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => (adults = Math.max(1, adults - 1))}
							class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-[#1D8D2B] hover:text-[#1D8D2B]"
							aria-label="Decrease adults">−</button
						>
						<span class="w-5 text-center text-sm font-semibold text-slate-800">{adults}</span>
						<button
							type="button"
							onclick={() => (adults = Math.min(listing.maxGuests ?? 20, adults + 1))}
							class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-[#1D8D2B] hover:text-[#1D8D2B]"
							aria-label="Increase adults">+</button
						>
					</div>
				</div>
				<div
					class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
				>
					<span class="text-xs font-semibold text-slate-600">Children</span>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => (children = Math.max(0, children - 1))}
							class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-[#1D8D2B] hover:text-[#1D8D2B]"
							aria-label="Decrease children">−</button
						>
						<span class="w-5 text-center text-sm font-semibold text-slate-800">{children}</span>
						<button
							type="button"
							onclick={() => (children = Math.min(8, children + 1))}
							class="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-[#1D8D2B] hover:text-[#1D8D2B]"
							aria-label="Increase children">+</button
						>
					</div>
				</div>
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
					{formatMoney(baseRate, listing.currency, { approx: lineEstimate })} × {breakdown.nights}
					{unit}{breakdown.nights > 1 ? 's' : ''}
				</span>
				<span>{formatMoney(breakdown.baseAmount, listing.currency, { approx: lineEstimate })}</span>
			</div>
			{#if breakdown.promotionDiscount > 0}
				<div class="flex justify-between font-semibold text-emerald-600">
					<span>Promotional discount ({promoLabel})</span>
					<span
						>−{formatMoney(breakdown.promotionDiscount, listing.currency, {
							approx: lineEstimate
						})}</span
					>
				</div>
			{/if}
			{#if listing.commissionRate}
				<div class="flex justify-between">
					<span>Service fee ({Math.round(listing.commissionRate * 100)}%)</span>
					<span
						>{formatMoney(breakdown.serviceFee, listing.currency, { approx: lineEstimate })}</span
					>
				</div>
			{/if}
			{#if breakdown.taxAmount > 0}
				<div class="flex justify-between">
					<span>Taxes ({Math.round(getTaxRate(listing.country) * 100)}%)</span>
					<span>{formatMoney(breakdown.taxAmount, listing.currency, { approx: lineEstimate })}</span
					>
				</div>
			{/if}
			{#if breakdown.deliveryFee > 0}
				<div class="flex justify-between">
					<span>Delivery fee</span>
					<span
						>{formatMoney(breakdown.deliveryFee, listing.currency, { approx: lineEstimate })}</span
					>
				</div>
			{/if}
			{#if breakdown.securityDeposit > 0}
				<div class="flex justify-between text-slate-600">
					<span>Security deposit</span>
					<span
						>{formatMoney(breakdown.securityDeposit, listing.currency, {
							approx: lineEstimate
						})}</span
					>
				</div>
			{/if}
			<div class="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
				{#if listing.currency !== displayCode}
					<div class="flex items-baseline justify-between text-sm font-semibold text-slate-600">
						<span>Total ({listing.currency})</span>
						<span>{formatMoney(breakdown.total, listing.currency)}</span>
					</div>
				{/if}
				<div class="flex items-baseline justify-between gap-3">
					<span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
						{estimate ? 'In your currency' : 'Total'}
					</span>
					<span class="text-2xl font-extrabold text-slate-900">
						{formatMoney(
							displayCode === listing.currency ? breakdown.total : localTotal,
							displayCode,
							{ equiv: estimate }
						)}
					</span>
				</div>
				{#if estimate && platformTotal != null}
					<div class="flex items-baseline justify-between gap-3">
						<span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
							{platformCode === 'EUR' ? 'Card charge' : 'Mobile money charge'}
						</span>
						<span class="text-lg font-bold text-[#0B1E3F]">
							{platformCode === 'EUR'
								? eurMoney(platformTotal)
								: formatMoney(platformTotal, platformCode)}
						</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if estimate}
		<div
			class="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-snug text-slate-600"
		>
			<span class="shrink-0">ℹ️</span>
			<span>
				{#if platformCode === 'EUR'}
					Processed in EUR (€). Your bank converts this to {displayCode}.
				{:else}
					Charged in XAF via mobile money.
				{/if}
			</span>
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
