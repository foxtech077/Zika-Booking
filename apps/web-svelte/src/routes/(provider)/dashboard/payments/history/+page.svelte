<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getPayouts, type ProviderPayout } from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { formatDate, cn } from '$lib/utils';

	let payouts = $state<ProviderPayout[]>([]);
	let loading = $state(true);
	let error = $state(false);
	let filter = $state('all');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				payouts = await getPayouts();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	const filtered = $derived(filter === 'all' ? payouts : payouts.filter((p) => p.status === filter));
	const statuses = $derived(['all', ...new Set(payouts.map((p) => p.status))]);

	function statusClass(s: string): string {
		if (s === 'paid' || s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (s === 'pending' || s === 'scheduled') return 'bg-amber-50 text-amber-700 border-amber-200';
		return 'bg-red-50 text-red-600 border-red-200';
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Payout history</h1>
		<p class="mt-1 text-sm text-slate-500">All payouts to your account.</p>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each statuses as s (s)}
			<button
				type="button"
				onclick={() => (filter = s)}
				class={cn(
					'rounded-full px-4 py-2 text-sm font-semibold transition',
					filter === s
						? 'bg-[#0c2614] text-white'
						: 'border border-slate-200 bg-white text-slate-600'
				)}
			>
				{s.charAt(0).toUpperCase() + s.slice(1)}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-16 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load payouts.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center">
			<p class="text-sm text-slate-400">No payouts yet.</p>
		</div>
	{:else}
		<div class="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
			{#each filtered as p (p.id)}
				<button
					type="button"
					onclick={() => void goto(`/dashboard/payments/payouts/${p.id}`)}
					class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
				>
					<div>
						<p class="text-sm font-semibold text-slate-800">{p.reference ?? p.id}</p>
						<p class="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-sm font-bold text-slate-900">{formatMoney(p.amount, p.currency)}</span>
						<span
							class={cn(
								'rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
								statusClass(p.status)
							)}
						>
							{p.status.replace(/_/g, ' ')}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
