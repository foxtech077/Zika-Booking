<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getMyBookings,
		cancelBooking,
		failPendingBooking,
		type GuestBooking
	} from '$lib/account-api';
	import { currencySymbol, formatDate, cn } from '$lib/utils';
	import ListingImage from '$lib/components/ListingImage.svelte';
	import type { ListingCategory } from '$lib/listing-api';

	type Filter = 'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled';

	const FILTERS: { key: Filter; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'confirmed', label: 'Confirmed' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'completed', label: 'Completed' },
		{ key: 'cancelled', label: 'Cancelled' }
	];

	let bookings = $state<GuestBooking[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filter = $state<Filter>('all');
	let cancellingId = $state<string | null>(null);

	const isCancelled = $derived((s: string) => s.startsWith('cancelled'));

	const filtered = $derived(
		bookings.filter((b) => {
			if (filter === 'all') return true;
			if (filter === 'confirmed') return b.status === 'confirmed';
			if (filter === 'pending') return b.status === 'pending_payment';
			if (filter === 'completed') return b.status === 'completed';
			if (filter === 'cancelled') return isCancelled(b.status);
			return true;
		})
	);

	const counts = $derived({
		all: bookings.length,
		confirmed: bookings.filter((b) => b.status === 'confirmed').length,
		pending: bookings.filter((b) => b.status === 'pending_payment').length,
		completed: bookings.filter((b) => b.status === 'completed').length,
		cancelled: bookings.filter((b) => isCancelled(b.status)).length
	});

	function load(): void {
		loading = true;
		error = null;
		void (async () => {
			try {
				bookings = await getMyBookings();
			} catch {
				error = 'Could not load your bookings. Please try again.';
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function statusLabel(status: string): string {
		if (status === 'confirmed') return 'Confirmed';
		if (status === 'pending_payment') return 'Payment required';
		if (status === 'completed') return 'Completed';
		if (isCancelled(status)) return 'Cancelled';
		return status.replace(/_/g, ' ');
	}

	const listingCategory = $derived((t: string | undefined): ListingCategory => {
		const c = t?.toLowerCase();
		if (c === 'car' || c === 'apartment' || c === 'hotel') return c;
		return 'hotel';
	});

	function statusClass(status: string): string {
		if (status === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (status === 'pending_payment') return 'bg-amber-50 text-amber-700 border-amber-200';
		if (status === 'completed') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-slate-100 text-slate-500 border-slate-200';
	}

	function handleCancel(b: GuestBooking): void {
		cancellingId = b.id;
		void (async () => {
			try {
				if (b.status === 'pending_payment') {
					await failPendingBooking(b.id);
				} else {
					await cancelBooking(b.id);
				}
				bookings = bookings.map((x) =>
					x.id === b.id ? { ...x, status: 'cancelled_by_guest' } : x
				);
			} catch {
				bookings = bookings.map((x) =>
					x.id === b.id ? { ...x, status: 'cancelled_by_guest' } : x
				);
			} finally {
				cancellingId = null;
			}
		})();
	}

	function dateRange(b: GuestBooking): string {
		if (b.pickupDatetime || b.returnDatetime) {
			return `${formatDate(b.pickupDatetime, { year: 'numeric' })} – ${formatDate(
				b.returnDatetime,
				{
					year: 'numeric'
				}
			)}`;
		}
		if (b.checkIn || b.checkOut) {
			return `${formatDate(b.checkIn)} – ${formatDate(b.checkOut)}`;
		}
		return '—';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">My Reservations</h1>
			<p class="mt-1 text-sm text-slate-500">
				{bookings.length} booking{bookings.length !== 1 ? 's' : ''}
			</p>
		</div>
		<button
			type="button"
			onclick={load}
			class="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:self-auto"
		>
			Refresh
		</button>
	</div>

	<!-- Filter chips -->
	<div class="flex flex-wrap gap-2">
		{#each FILTERS as f (f.key)}
			<button
				type="button"
				onclick={() => (filter = f.key)}
				class={cn(
					'rounded-full px-4 py-2 text-sm font-semibold transition',
					filter === f.key
						? 'bg-[#0c2614] text-white'
						: 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
				)}
			>
				{f.label}
				<span class={cn('ml-1 text-xs', filter === f.key ? 'text-white/60' : 'text-slate-400')}>
					{counts[f.key]}
				</span>
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
					<div class="flex gap-4">
						<div class="h-28 w-28 shrink-0 rounded-xl bg-slate-100"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 w-1/3 rounded bg-slate-100"></div>
							<div class="h-3 w-1/2 rounded bg-slate-100"></div>
							<div class="h-3 w-1/4 rounded bg-slate-100"></div>
						</div>
					</div>
				</div>
			{/each}
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
	{:else if filtered.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0fdf4] text-emerald-600"
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
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-bold text-slate-800">No reservations yet</h3>
			<p class="mx-auto mt-2 max-w-sm text-sm text-slate-500">
				{filter === 'all'
					? 'When you book a stay or car rental it will show up here.'
					: 'No bookings match this filter.'}
			</p>
			<a
				href="/"
				class="mt-6 inline-block rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
			>
				Explore Listings
			</a>
		</div>
	{:else}
		<div class="space-y-4">
			{#each filtered as b (b.id)}
				<div
					role="link"
					tabindex="0"
					onclick={() => void goto(`/bookings/${b.id}`)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							void goto(`/bookings/${b.id}`);
						}
					}}
					class="group w-full cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-[#1D8D2B]/40 hover:shadow-md"
				>
					<div class="flex gap-4">
						<div class="h-28 w-28 shrink-0 overflow-hidden rounded-xl">
							<ListingImage
								src={b.listingPrimaryPhotoUrl}
								alt={b.listingTitle}
								category={listingCategory(b.listingType)}
								class="h-full w-full object-cover"
							/>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-mono text-[11px] font-semibold text-slate-400">{b.reference}</p>
									<h3 class="mt-0.5 truncate text-base font-bold text-slate-900">
										{b.listingTitle}
									</h3>
								</div>
								<span
									class={cn(
										'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
										statusClass(b.status)
									)}
								>
									{statusLabel(b.status)}
								</span>
							</div>
							<p class="mt-1 text-sm text-slate-500">{dateRange(b)}</p>
							<div class="mt-2 flex items-center justify-between gap-3">
								<p class="text-sm text-slate-500">
									{b.nightsOrDays}
									{b.listingType === 'car' ? 'day' : 'night'}
									{b.nightsOrDays !== 1 ? 's' : ''}
									{#if b.adults}
										<span class="text-slate-300">·</span>
										{b.adults} guest{b.adults !== 1 ? 's' : ''}
									{/if}
								</p>
								<p class="text-base font-bold text-slate-900">
									{currencySymbol(b.currency)}{Number(b.totalAmount).toLocaleString()}
								</p>
							</div>

							{#if b.status === 'confirmed' || b.status === 'pending_payment' || b.status === 'completed'}
								<div class="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
									{#if b.status === 'confirmed'}
										<span
											class="inline-block cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
											role="button"
											tabindex="0"
											onclick={(e) => {
												e.stopPropagation();
												handleCancel(b);
											}}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													e.stopPropagation();
													handleCancel(b);
												}
											}}
										>
											{cancellingId === b.id ? 'Cancelling…' : 'Cancel booking'}
										</span>
									{:else if b.status === 'pending_payment'}
										<span
											class="inline-block cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
											role="button"
											tabindex="0"
											onclick={(e) => {
												e.stopPropagation();
												handleCancel(b);
											}}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													e.stopPropagation();
													handleCancel(b);
												}
											}}
										>
											{cancellingId === b.id ? 'Cancelling…' : 'Payment required — cancel'}
										</span>
									{/if}
									{#if b.status === 'completed'}
										<a
											href={`/reviews?bookingId=${b.id}&listingId=${b.listingId}&listingName=${encodeURIComponent(b.listingTitle)}`}
											class="inline-block rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#15803d]"
											onclick={(e) => e.stopPropagation()}
										>
											Leave Review
										</a>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
