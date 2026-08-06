<script lang="ts">
	import { onMount } from 'svelte';
	import { getProviderDashboard, type ProviderDashboard } from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { formatDate } from '$lib/utils';

	let data = $state<ProviderDashboard | null>(null);
	let loading = $state(true);
	let error = $state(false);

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				data = await getProviderDashboard();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	const maxRevenue = $derived(
		data ? Math.max(1, ...data.monthlyRevenue.map((m) => m.revenue)) : 1
	);

	function statusLabel(s: string): string {
		if (s === 'cancelled_by_provider') return 'Cancelled by you';
		if (s.startsWith('cancelled')) return 'Cancelled';
		return s.replace(/_/g, ' ');
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Provider Dashboard</h1>
		<p class="mt-1 text-sm text-slate-500">Your properties, bookings and earnings at a glance.</p>
	</div>

	{#if loading}
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
			{#each Array(4) as _, i (i)}
				<div class="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load your dashboard.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if data}
		<!-- Stat cards -->
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Total earnings</p>
				<p class="mt-1.5 text-2xl font-bold text-slate-900">
					{formatMoney(data.totalEarnings, 'USD')}
				</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">This month</p>
				<p class="mt-1.5 text-2xl font-bold text-slate-900">
					{formatMoney(data.thisMonthEarnings, 'USD')}
				</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Active listings</p>
				<p class="mt-1.5 text-2xl font-bold text-slate-900">{data.activeListingsCount}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Pending bookings</p>
				<p class="mt-1.5 text-2xl font-bold text-slate-900">{data.pendingBookingsCount}</p>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Monthly revenue chart -->
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<h2 class="text-sm font-bold text-slate-900">Revenue — last 6 months</h2>
				<div class="mt-4 flex h-40 items-end gap-2">
					{#each data.monthlyRevenue as m (m.month)}
						<div class="flex flex-1 flex-col items-center gap-1">
							<span class="text-[9px] font-semibold text-slate-400">
								{m.revenue > 0 ? formatMoney(m.revenue, 'USD') : ''}
							</span>
							<div
								class="w-full rounded-t-md bg-[#1D8D2B]/80"
								style="height: {Math.max(4, (m.revenue / maxRevenue) * 130)}px"
							></div>
							<span class="text-[9px] font-semibold text-slate-400">
								{m.month.slice(5)}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Quick stats -->
			<div class="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<h2 class="text-sm font-bold text-slate-900">At a glance</h2>
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-xl bg-slate-50 p-4">
						<p class="text-xl font-bold text-slate-900">{data.completedBookingsCount}</p>
						<p class="text-[11px] font-medium text-slate-400">Completed bookings</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-4">
						<p class="text-xl font-bold text-slate-900">{data.unreadMessages}</p>
						<p class="text-[11px] font-medium text-slate-400">Unread messages</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-4">
						<p class="text-xl font-bold text-slate-900">{data.pendingReviews}</p>
						<p class="text-[11px] font-medium text-slate-400">Reviews awaiting reply</p>
					</div>
					<div class="rounded-xl bg-slate-50 p-4">
						<a href="/dashboard/listings" class="text-xl font-bold text-[#1D8D2B]">+ New</a>
						<p class="text-[11px] font-medium text-slate-400">Create listing</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Recent bookings -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-slate-900">Recent bookings</h2>
				<a href="/dashboard/bookings" class="text-xs font-semibold text-[#1D8D2B] hover:underline">
					View all →
				</a>
			</div>
			{#if data.recentBookings.length === 0}
				<p class="mt-4 text-sm text-slate-400">No bookings yet.</p>
			{:else}
				<div class="mt-4 divide-y divide-slate-100">
					{#each data.recentBookings as b (b.id)}
						<div class="flex flex-wrap items-center justify-between gap-2 py-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">{b.listingTitle}</p>
								<p class="text-xs text-slate-400">
									{b.reference} · {b.guestName} ·{' '}
									{b.checkIn ? formatDate(b.checkIn) : formatDate(b.pickupDatetime)}
								</p>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-sm font-bold text-slate-900">
									{formatMoney(b.providerPayout, b.currency)}
								</span>
								<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 capitalize">
									{statusLabel(b.status)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
