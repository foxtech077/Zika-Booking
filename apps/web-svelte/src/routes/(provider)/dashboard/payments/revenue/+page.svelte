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
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Booking revenue</h1>
		<p class="mt-1 text-sm text-slate-500">Revenue and commission per recent booking.</p>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-16 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load revenue data.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if data}
		<div class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
			{#each data.recentPayouts as p (p.id)}
				<div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
					<div>
						<p class="text-sm font-semibold text-slate-800">{p.listingName}</p>
						<p class="text-xs text-slate-400">
							{p.reference} · {p.confirmedAt ? formatDate(p.confirmedAt) : ''}
						</p>
					</div>
					<div class="flex items-center gap-4 text-right">
						<div>
							<p class="text-xs text-slate-400">Revenue</p>
							<p class="text-sm font-semibold text-slate-800">{formatMoney(p.totalAmount, p.currency)}</p>
						</div>
						<div>
							<p class="text-xs text-slate-400">Commission</p>
							<p class="text-sm font-semibold text-slate-500">{formatMoney(p.commission, p.currency)}</p>
						</div>
						<div>
							<p class="text-xs text-slate-400">Your payout</p>
							<p class="text-sm font-bold text-emerald-700">{formatMoney(p.payout, p.currency)}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
