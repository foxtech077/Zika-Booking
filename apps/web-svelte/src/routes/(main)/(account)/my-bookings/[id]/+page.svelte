<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	import { getBookingDetail, cancelBooking, type BookingDetail } from '$lib/account-api';
	import { CANCELLATION_POLICY_LABEL } from '$lib/booking-utils';
	import { formatDate, cn } from '$lib/utils';
	import { formatMoney } from '$lib/currency-display';
	import { listingHref } from '$lib/listing-meta';
	import ListingImage from '$lib/components/ListingImage.svelte';
	import type { ListingCategory } from '$lib/listing-api';

	const bookingId = $derived(String(page.params.id ?? ''));

	let booking = $state<BookingDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let cancelling = $state(false);
	let cancelMessage = $state<string | null>(null);

	const isCancelled = $derived(booking?.status.startsWith('cancelled') ?? false);

	const listingCategory = $derived.by((): ListingCategory => {
		const c = (booking?.listingType ?? '').toLowerCase();
		if (c === 'car' || c === 'apartment' || c === 'hotel') return c;
		return 'hotel';
	});

	/** Canonical listing URL for the "view listing" link. */
	const listingUrl = $derived(booking ? listingHref(listingCategory, booking.listing.id) : '');

	function load(): void {
		loading = true;
		error = null;
		void (async () => {
			try {
				booking = await getBookingDetail(bookingId);
			} catch {
				error = 'Could not load this booking. Please try again.';
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function handleCancel(): void {
		if (!booking || cancelling) return;
		cancelling = true;
		cancelMessage = null;
		void (async () => {
			try {
				const res = await cancelBooking(booking.id);
				booking = {
					...booking,
					status: 'cancelled_by_guest',
					canCancel: false,
					refundAmount: res.refundAmount
				};
				cancelMessage = `Booking cancelled. Refund: ${formatMoney(res.refundAmount ?? 0, res.currency)}`;
			} catch {
				cancelMessage = 'Could not cancel the booking. Please try again.';
			} finally {
				cancelling = false;
			}
		})();
	}

	const periodLabel = $derived.by(() => {
		if (!booking) return '—';
		if (booking.pickupDatetime || booking.returnDatetime) {
			return `${formatDate(booking.pickupDatetime)} – ${formatDate(booking.returnDatetime)}`;
		}
		return `${formatDate(booking.checkIn)} – ${formatDate(booking.checkOut)}`;
	});

	const breakdownRows = $derived.by(() => {
		if (!booking) return [] as { label: string; value: string; strong?: boolean }[];
		const rows: { label: string; value: string; strong?: boolean }[] = [
			{
				label: 'Subtotal',
				value: formatMoney(booking.subtotal, booking.currency)
			}
		];
		if (booking.discountAmount > 0) {
			rows.push({
				label: 'Discount',
				value: `−${formatMoney(booking.discountAmount, booking.currency)}`
			});
		}
		if (booking.deliveryFee > 0) {
			rows.push({
				label: 'Delivery fee',
				value: formatMoney(booking.deliveryFee, booking.currency)
			});
		}
		rows.push({
			label: 'Service fee',
			value: formatMoney(booking.serviceFee, booking.currency)
		});
		if (booking.taxAmount > 0) {
			rows.push({
				label: 'Taxes',
				value: formatMoney(booking.taxAmount, booking.currency)
			});
		}
		if (booking.securityDeposit > 0) {
			rows.push({
				label: 'Security deposit',
				value: formatMoney(booking.securityDeposit, booking.currency)
			});
		}
		if (booking.voucherDiscount > 0) {
			rows.push({
				label: 'Voucher',
				value: `−${formatMoney(booking.voucherDiscount, booking.currency)}`
			});
		}
		rows.push({
			label: 'Total',
			value: formatMoney(booking.totalAmount, booking.currency),
			strong: true
		});
		return rows;
	});
</script>

{#if loading}
	<div class="animate-pulse space-y-4">
		<div class="h-8 w-64 rounded bg-slate-100"></div>
		<div class="h-64 rounded-2xl bg-slate-100"></div>
	</div>
{:else if error}
	<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
		<p class="text-sm text-red-600">{error}</p>
		<button
			type="button"
			onclick={load}
			class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
		>
			Try Again
		</button>
	</div>
{:else if booking}
	<div class="space-y-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="font-mono text-sm font-semibold text-slate-400">{booking.reference}</p>
				<h1 class="mt-0.5 text-3xl font-bold tracking-tight text-slate-900">
					{booking.listing.title}
				</h1>
				<p class="mt-1 text-sm text-slate-500">{periodLabel}</p>
			</div>
			<span
				class={cn(
					'w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize',
					booking.status === 'confirmed'
						? 'border-emerald-200 bg-emerald-50 text-emerald-700'
						: booking.status === 'pending_payment'
							? 'border-amber-200 bg-amber-50 text-amber-700'
							: booking.status === 'completed'
								? 'border-blue-200 bg-blue-50 text-blue-700'
								: 'border-slate-200 bg-slate-100 text-slate-500'
				)}
			>
				{booking.status.replace(/_/g, ' ')}
			</span>
		</div>

		{#if cancelMessage}
			<div
				class={cn(
					'rounded-xl border px-4 py-3 text-sm',
					cancelMessage.startsWith('Booking cancelled')
						? 'border-emerald-200 bg-emerald-50 text-emerald-800'
						: 'border-red-200 bg-red-50 text-red-700'
				)}
			>
				{cancelMessage}
			</div>
		{/if}

		<div class="grid gap-6 lg:grid-cols-[1fr_360px]">
			<div class="space-y-6">
				<!-- Listing -->
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div class="relative h-56 w-full overflow-hidden">
						<ListingImage
							src={booking.listing.primaryPhotoUrl}
							alt={booking.listing.title}
							category={listingCategory}
							class="h-full w-full object-cover"
						/>
					</div>
					<div class="p-5">
						<h3 class="text-lg font-bold text-slate-900">{booking.listing.title}</h3>
						<p class="mt-1 text-sm text-slate-500">
							{[booking.listing.address, booking.listing.town, booking.listing.country]
								.filter(Boolean)
								.join(', ')}
						</p>
						<a
							href={listingUrl}
							class="mt-3 inline-block text-sm font-semibold text-[#1D8D2B] hover:underline"
						>
							View listing →
						</a>
					</div>
				</div>

				<!-- Guest details -->
				<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h3 class="text-lg font-bold text-slate-900">Guest details</h3>
					<dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
						<div>
							<dt class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Name</dt>
							<dd class="mt-1 font-semibold text-slate-900">
								{booking.guestFirstName}
								{booking.guestLastName}
							</dd>
						</div>
						<div>
							<dt class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Email</dt>
							<dd class="mt-1 font-semibold text-slate-900">{booking.guestEmail}</dd>
						</div>
						<div>
							<dt class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Guests</dt>
							<dd class="mt-1 font-semibold text-slate-900">
								{booking.adults} adult{booking.adults !== 1 ? 's' : ''}
								{#if booking.children}
									, {booking.children} child{booking.children !== 1 ? 'ren' : ''}
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Duration</dt>
							<dd class="mt-1 font-semibold text-slate-900">
								{booking.nightsOrDays}
								{booking.listingType === 'car' ? 'day' : 'night'}
								{booking.nightsOrDays !== 1 ? 's' : ''}
							</dd>
						</div>
						{#if booking.specialRequests}
							<div class="sm:col-span-2">
								<dt class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
									Special requests
								</dt>
								<dd class="mt-1 font-semibold text-slate-900">{booking.specialRequests}</dd>
							</div>
						{/if}
					</dl>
				</div>
			</div>

			<!-- Price breakdown -->
			<div class="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h3 class="text-lg font-bold text-slate-900">Price details</h3>
				<dl class="mt-3 space-y-2.5 text-sm">
					{#each breakdownRows as row (row.label)}
						<div
							class={cn(
								'flex items-center justify-between gap-3',
								row.strong
									? 'border-t border-slate-200 pt-3 font-bold text-slate-900'
									: 'text-slate-600'
							)}
						>
							<dt>{row.label}</dt>
							<dd>{row.value}</dd>
						</div>
					{/each}
				</dl>

				{#if booking.voucherCode}
					<p class="mt-3 text-xs text-slate-400">Voucher applied: {booking.voucherCode}</p>
				{/if}
				{#if booking.refundAmount != null && isCancelled}
					<p class="mt-2 text-xs font-semibold text-emerald-700">
						Refund: {formatMoney(booking.refundAmount, booking.currency)}
					</p>
				{/if}

				{#if booking.canCancel}
					<button
						type="button"
						onclick={handleCancel}
						disabled={cancelling}
						class="mt-5 w-full rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{cancelling ? 'Cancelling…' : 'Cancel booking'}
					</button>
				{/if}

				{#if booking.cancellationPolicy}
					<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
						<p class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
							Cancellation Policy
						</p>
						<p class="mt-1 text-xs leading-relaxed text-slate-600">
							{CANCELLATION_POLICY_LABEL[booking.cancellationPolicy] ?? booking.cancellationPolicy}
						</p>
					</div>
				{/if}

				{#if booking.status === 'completed'}
					<a
						href={`/reviews?bookingId=${booking.id}&listingName=${encodeURIComponent(booking.listing.title)}`}
						class="mt-5 block w-full rounded-xl bg-[#16a34a] py-3 text-center text-sm font-semibold text-white transition hover:bg-[#15803d]"
					>
						Leave Review
					</a>
				{/if}

				<a
					href="/bookings"
					class="mt-3 block text-center text-sm font-semibold text-slate-500 hover:text-slate-800"
				>
					← Back to reservations
				</a>
			</div>
		</div>
	</div>
{/if}
