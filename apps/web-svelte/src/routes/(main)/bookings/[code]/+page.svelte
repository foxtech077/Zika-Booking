<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	import {
		getBookingByManageToken,
		cancelBookingByManageToken,
		type BookingDetail
	} from '$lib/account-api';
	import { formatDate, cn } from '$lib/utils';
	import { formatMoney } from '$lib/currency-display';
	import { listingHref } from '$lib/listing-meta';
	import ListingImage from '$lib/components/ListingImage.svelte';
	import type { ListingCategory } from '$lib/listing-api';

	// Anonymous bookings are managed through the secret magic-link token from
	// the confirmation email (path: /bookings/<code>?token=<manageToken>).
	// Without a token the path is a legacy signed-in deep link, so bounce to
	// the reservations list with the booking highlighted.
	const code = $derived(String(page.params.code ?? ''));
	const token = $derived(page.url.searchParams.get('token'));

	let booking = $state<BookingDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let errorKind = $state<'invalid' | 'expired' | 'generic' | null>(null);
	let cancelling = $state(false);
	let cancelMessage = $state<string | null>(null);

	const isCancelled = $derived(booking?.status.startsWith('cancelled') ?? false);

	const listingCategory = $derived.by((): ListingCategory => {
		const c = (booking?.listingType ?? '').toLowerCase();
		if (c === 'car' || c === 'apartment' || c === 'hotel') return c;
		return 'hotel';
	});

	const listingUrl = $derived(booking ? listingHref(listingCategory, booking.listing.id) : '');

	onMount(() => {
		if (!token) {
			void goto(`/bookings?highlight=${encodeURIComponent(code)}`);
			return;
		}
		void load();
	});

	async function load(): Promise<void> {
		if (!token) return;
		loading = true;
		error = null;
		errorKind = null;
		try {
			booking = await getBookingByManageToken(token);
		} catch (err) {
			const status = (err as { status?: number })?.status;
			errorKind = status === 410 ? 'expired' : status === 404 ? 'invalid' : 'generic';
			error =
				errorKind === 'expired'
					? 'This booking link has expired.'
					: errorKind === 'invalid'
						? 'This booking link is invalid.'
						: 'Something went wrong while loading your booking. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleCancel(): Promise<void> {
		if (!token || !booking || cancelling) return;
		cancelling = true;
		cancelMessage = null;
		try {
			const res = await cancelBookingByManageToken(token);
			booking = {
				...booking,
				status: 'cancelled_by_guest',
				canCancel: false,
				cancelledAt: new Date().toISOString(),
				refundAmount: res.refundAmount
			};
			cancelMessage = `Booking cancelled. Refund: ${formatMoney(res.refundAmount ?? 0, res.currency)}`;
		} catch (err) {
			cancelMessage =
				(err as { message?: string })?.message ?? 'Could not cancel the booking. Please try again.';
		} finally {
			cancelling = false;
		}
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

	const statusClass = $derived.by(() => {
		if (!booking) return 'border-slate-200 bg-slate-100 text-slate-500';
		if (booking.status === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (booking.status === 'pending_payment') return 'border-amber-200 bg-amber-50 text-amber-700';
		if (booking.status === 'completed') return 'border-blue-200 bg-blue-50 text-blue-700';
		return 'border-slate-200 bg-slate-100 text-slate-500';
	});
</script>

<svelte:head>
	<title>{booking ? `${booking.listing.title} | Kainook` : 'Your booking | Kainook'}</title>
</svelte:head>

<div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	{#if loading}
		<div class="animate-pulse space-y-4">
			<div class="h-8 w-64 rounded bg-slate-100"></div>
			<div class="h-64 rounded-2xl bg-slate-100"></div>
		</div>
	{:else if error}
		<div class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500"
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
						d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
					/>
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-slate-900">
				{errorKind === 'expired'
					? 'This booking link has expired'
					: errorKind === 'invalid'
						? 'This booking link is invalid'
						: 'Something went wrong'}
			</h1>
			<p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">{error}</p>
			<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
				<a
					href="/bookings"
					class="rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
				>
					My Reservations
				</a>
				<a
					href="/"
					class="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Go to Home
				</a>
			</div>
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
						statusClass
					)}
				>
					{booking.status.replace(/_/g, ' ')}
				</span>
			</div>

			<p class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
				Booked as a guest on this device. The link from your confirmation email lets you view or
				cancel this booking without signing in.
			</p>

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
								<dt class="text-xs font-semibold tracking-wide text-slate-400 uppercase">
									Duration
								</dt>
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
					{:else if booking.status === 'confirmed'}
						<p class="mt-4 text-sm leading-relaxed text-slate-500">
							Cancellation is no longer available because your check-in has already started.
						</p>
					{/if}

					{#if booking.status === 'completed'}
						<a
							href={`/reviews?bookingId=${booking.id}&listingName=${encodeURIComponent(booking.listing.title)}`}
							class="mt-5 block w-full rounded-xl bg-[#16a34a] py-3 text-center text-sm font-semibold text-white transition hover:bg-[#15803d]"
						>
							Leave Review
						</a>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
