<script lang="ts">
	import { goto } from '$app/navigation';
	import { LISTING_API_URL } from '$lib/config';
	import {
		fetchListingAvailability,
		isRangeAvailable,
		type PublicListingDetail
	} from '$lib/listing-api';
	import { computePriceBreakdown, getTaxRate } from '$lib/pricing';
	import { currencySymbol } from '$lib/utils';
	import DateRangePicker from './DateRangePicker.svelte';

	let { listing }: { listing: PublicListingDetail } = $props();

	const isCar = $derived(listing.category === 'car');
	const unit = $derived(isCar ? 'day' : 'night');

	const cheapestRoom = $derived(
		listing.category === 'hotel' && listing.roomTypes && listing.roomTypes.length > 0
			? listing.roomTypes.reduce((min, rt) => (rt.pricePerNight < min.pricePerNight ? rt : min))
			: null
	);
	const rate = $derived(cheapestRoom?.pricePerNight ?? listing.pricePerNight);
	const sym = $derived(currencySymbol(listing.currency));

	let checkIn = $state('');
	let checkOut = $state('');
	let guests = $state(2);
	let availData = $state<
		| { unavailableRanges: { start: string; end: string }[]; roomTypeAvailability?: unknown[] }
		| null
		| undefined
	>(undefined);

	const breakdown = $derived.by(() =>
		checkIn && checkOut
			? computePriceBreakdown({
					pricePerNight: rate,
					checkIn,
					checkOut,
					commissionRate: listing.commissionRate,
					taxRate: getTaxRate(listing.country)
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
			nights: String(breakdown?.nights ?? 0)
		});
		void goto(`/booking/review?${params.toString()}`);
	}
</script>

<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
	<div class="flex items-end justify-between gap-3">
		<p class="text-sm font-bold text-slate-900">
			{sym}{rate > 0 ? rate.toLocaleString() : '—'}
			<span class="text-[11px] font-medium text-slate-400">/{unit}</span>
		</p>
		{#if listing.minStayNights > 1}
			<p class="text-[10px] font-semibold text-slate-400">Min {listing.minStayNights} {unit}s</p>
		{/if}
	</div>

	{#if cheapestRoom}
		<p class="mt-1 text-[11px] font-medium text-slate-400">
			{cheapestRoom.name}{cheapestRoom.maxGuests ? ` · up to ${cheapestRoom.maxGuests} guests` : ''}
		</p>
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
				<span>{sym}{breakdown.subtotal.toLocaleString()}</span>
			</div>
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
