<script lang="ts">
	import { onMount } from 'svelte';
	import { getProviderBookings, type ProviderBooking } from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { formatDate, cn } from '$lib/utils';

	let bookings = $state<ProviderBooking[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state(false);
	let status = $state('all');
	let search = $state('');

	const FILTERS = [
		{ key: 'all', label: 'All' },
		{ key: 'pending_payment', label: 'Pending' },
		{ key: 'confirmed', label: 'Confirmed' },
		{ key: 'completed', label: 'Completed' },
		{ key: 'cancelled', label: 'Cancelled' }
	];

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const res = await getProviderBookings({ status, search });
				bookings = res.bookings;
				total = res.total;
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function statusClass(s: string): string {
		if (s === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (s === 'pending_payment') return 'bg-amber-50 text-amber-700 border-amber-200';
		if (s === 'completed') return 'bg-blue-50 text-blue-700 border-blue-200';
		return 'bg-red-50 text-red-600 border-red-200';
	}

	function statusLabel(s: string): string {
		if (s === 'cancelled_by_provider') return 'Cancelled by you';
		if (s.startsWith('cancelled')) return 'Cancelled';
		return s.replace(/_/g, ' ');
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Bookings</h1>
			<p class="mt-1 text-sm text-slate-500">{total} booking{total !== 1 ? 's' : ''}</p>
		</div>
		<div class="flex items-center gap-2">
			<input
				type="text"
				bind:value={search}
				placeholder="Search reference / guest…"
				class="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-[#1D8D2B] focus:outline-none"
			/>
			<button
				type="button"
				onclick={load}
				class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
			>
				Search
			</button>
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each FILTERS as f (f.key)}
			<button
				type="button"
				onclick={() => {
					status = f.key;
					load();
				}}
				class={cn(
					'rounded-full px-4 py-2 text-sm font-semibold transition',
					status === f.key
						? 'bg-[#0c2614] text-white'
						: 'border border-slate-200 bg-white text-slate-600'
				)}
			>
				{f.label}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-24 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load bookings.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if bookings.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center">
			<p class="text-sm text-slate-400">No bookings match this view.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each bookings as b (b.id)}
				<div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="text-sm font-bold text-slate-900">{b.listingTitle}</p>
							<p class="text-xs text-slate-400">
								{b.reference} · {b.guestFirstName} {b.guestLastName} · {b.guestEmail}
							</p>
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
					<p class="mt-2 text-xs text-slate-500">
						{b.checkIn ? `${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}` : `${formatDate(b.pickupDatetime)} → ${formatDate(b.returnDatetime)}`}
						· {b.nightsOrDays} {b.listingCategory === 'car' ? 'day' : 'night'}{b.nightsOrDays !== 1 ? 's' : ''}
						{#if b.adults}· {b.adults} adult{b.adults !== 1 ? 's' : ''}{/if}
					</p>
					<div class="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
						<span class="text-xs text-slate-400">
							Payout {formatMoney(b.providerPayout, b.currency)}
						</span>
						<span class="text-sm font-bold text-slate-900">
							{formatMoney(b.totalAmount, b.currency)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
