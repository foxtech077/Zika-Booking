<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getPayoutDetail, type ProviderPayout } from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { formatDateTime } from '$lib/utils';

	const id = $derived(String(page.params.id ?? ''));

	let payout = $state<ProviderPayout | null>(null);
	let loading = $state(true);
	let error = $state(false);

	onMount(() => {
		void (async () => {
			try {
				payout = await getPayoutDetail(id);
				if (!payout) error = true;
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	});
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Payout detail</h1>
			<p class="mt-1 text-sm text-slate-500">{id}</p>
		</div>
		<a href="/dashboard/payments/history" class="text-sm font-semibold text-slate-400 hover:text-[#0c2614]">
			← Back to payouts
		</a>
	</div>

	{#if loading}
		<div class="h-48 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
	{:else if error || !payout}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load this payout.</p>
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
			<dl class="space-y-3 text-sm">
				<div class="flex items-center justify-between">
					<dt class="text-slate-500">Amount</dt>
					<dd class="font-bold text-slate-900">{formatMoney(payout.amount, payout.currency)}</dd>
				</div>
				<div class="flex items-center justify-between">
					<dt class="text-slate-500">Status</dt>
					<dd class="font-semibold capitalize text-slate-800">{payout.status.replace(/_/g, ' ')}</dd>
				</div>
				<div class="flex items-center justify-between">
					<dt class="text-slate-500">Created</dt>
					<dd class="text-slate-800">{formatDateTime(payout.createdAt)}</dd>
				</div>
				{#if payout.method}
					<div class="flex items-center justify-between">
						<dt class="text-slate-500">Method</dt>
						<dd class="text-slate-800 capitalize">{payout.method.replace(/_/g, ' ')}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}
</div>
