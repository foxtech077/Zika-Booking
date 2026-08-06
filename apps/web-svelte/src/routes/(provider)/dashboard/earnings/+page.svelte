<script lang="ts">
	import { onMount } from 'svelte';
	import { getProviderEarnings, type ProviderEarnings } from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { formatDate } from '$lib/utils';

	let data = $state<ProviderEarnings | null>(null);
	let loading = $state(true);
	let error = $state(false);

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				data = await getProviderEarnings();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	const maxMonthly = $derived(data ? Math.max(1, ...data.monthly.map((m) => m.revenue)) : 1);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Earnings</h1>
		<p class="mt-1 text-sm text-slate-500">Revenue, commission and payouts across the last 12 months.</p>
	</div>

	{#if loading}
		<div class="grid grid-cols-3 gap-4">
			{#each Array(3) as _, i (i)}
				<div class="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load earnings.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if data}
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Total revenue</p>
				<p class="mt-1.5 text-2xl font-bold text-slate-900">{formatMoney(data.allTime.revenue, 'USD')}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Commission</p>
				<p class="mt-1.5 text-2xl font-bold text-slate-900">{formatMoney(data.allTime.commission, 'USD')}</p>
			</div>
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Your payout</p>
				<p class="mt-1.5 text-2xl font-bold text-emerald-700">{formatMoney(data.allTime.payout, 'USD')}</p>
			</div>
		</div>

		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-bold text-slate-900">Monthly revenue — last 12 months</h2>
			<div class="mt-4 flex h-48 items-end gap-1.5">
				{#each data.monthly as m (m.month)}
					<div class="flex flex-1 flex-col items-center gap-1">
						<span class="text-[9px] font-semibold text-slate-400">
							{m.revenue > 0 ? formatMoney(m.revenue, 'USD') : ''}
						</span>
						<div
							class="w-full rounded-t-md bg-[#1D8D2B]/80"
							style="height: {Math.max(4, (m.revenue / maxMonthly) * 160)}px"
						></div>
						<span class="text-[9px] font-semibold text-slate-400">{m.month.slice(5)}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-bold text-slate-900">Recent payouts</h2>
			{#if data.recentPayouts.length === 0}
				<p class="mt-4 text-sm text-slate-400">No payouts yet.</p>
			{:else}
				<div class="mt-4 divide-y divide-slate-100">
					{#each data.recentPayouts as p (p.id)}
						<div class="flex items-center justify-between gap-2 py-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">{p.listingName}</p>
								<p class="text-xs text-slate-400">
									{p.reference} · {p.confirmedAt ? formatDate(p.confirmedAt) : ''}
								</p>
							</div>
							<div class="text-right">
								<p class="text-sm font-bold text-slate-900">{formatMoney(p.payout, p.currency)}</p>
								<p class="text-[10px] text-slate-400">of {formatMoney(p.totalAmount, p.currency)}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
