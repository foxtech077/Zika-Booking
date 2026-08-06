<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getPayouts,
		getMerchantProfile,
		getStripeConnectStatus,
		startStripeConnect,
		refreshStripeConnect,
		type ProviderPayout,
		type MerchantProfile
	} from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { formatDate } from '$lib/utils';

	let payouts = $state<ProviderPayout[]>([]);
	let merchant = $state<MerchantProfile | null>(null);
	let connectStatus = $state<string | null>(null);
	let loading = $state(true);
	let error = $state(false);
	let busy = $state(false);
	let notice = $state('');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const [p, m, cs] = await Promise.all([getPayouts(), getMerchantProfile(), getStripeConnectStatus()]);
				payouts = p;
				merchant = m;
				connectStatus = cs?.status ?? null;
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	async function handleStartConnect(): Promise<void> {
		busy = true;
		notice = '';
		try {
			const res = await startStripeConnect();
			if (res.onboardingUrl) window.location.href = res.onboardingUrl;
		} catch {
			notice = 'Could not start Stripe onboarding. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function handleRefreshConnect(): Promise<void> {
		busy = true;
		notice = '';
		try {
			const res = await refreshStripeConnect();
			if (res.onboardingUrl) window.location.href = res.onboardingUrl;
		} catch {
			notice = 'Could not refresh the Stripe onboarding link.';
		} finally {
			busy = false;
		}
	}

	function statusClass(s: string): string {
		if (s === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (s === 'incomplete') return 'bg-amber-50 text-amber-700 border-amber-200';
		return 'bg-red-50 text-red-600 border-red-200';
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Payments</h1>
		<p class="mt-1 text-sm text-slate-500">Payouts and payout settings.</p>
	</div>

	<div class="flex flex-wrap gap-2">
		<a
			href="/dashboard/payments"
			class="rounded-full px-4 py-2 text-sm font-semibold transition bg-[#0c2614] text-white"
		>
			Overview
		</a>
		<a
			href="/dashboard/payments/history"
			class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
		>
			Payout history
		</a>
		<a
			href="/dashboard/payments/revenue"
			class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
		>
			Booking revenue
		</a>
	</div>

	{#if notice}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{notice}</div>
	{/if}

	{#if loading}
		<div class="h-40 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load payment data.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else}
		<!-- Stripe Connect -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 class="text-sm font-bold text-slate-900">Stripe Connect</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						Connect your Stripe account to receive payouts.
						{#if merchant?.businessName}
							<br />Business: {merchant.businessName}
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					{#if connectStatus}
						<span
							class="rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize {statusClass(connectStatus)}"
						>
							{connectStatus}
						</span>
					{/if}
					{#if connectStatus === 'active'}
						<button
							type="button"
							onclick={() => void handleRefreshConnect()}
							disabled={busy}
							class="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
						>
							{busy ? '…' : 'Update Stripe details'}
						</button>
					{:else}
						<button
							type="button"
							onclick={() => void handleStartConnect()}
							disabled={busy}
							class="rounded-lg bg-[#0c2614] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#081b0d] disabled:opacity-50"
						>
							{busy ? '…' : 'Connect Stripe account'}
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Payouts -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-bold text-slate-900">Payout history</h2>
			{#if payouts.length === 0}
				<p class="mt-4 text-sm text-slate-400">No payouts yet.</p>
			{:else}
				<div class="mt-4 divide-y divide-slate-100">
					{#each payouts as p (p.id)}
						<div class="flex items-center justify-between gap-2 py-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">{p.reference ?? p.id}</p>
								<p class="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-sm font-bold text-slate-900">
									{formatMoney(p.amount, p.currency)}
								</span>
								<span
									class="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize {statusClass(p.status)}"
								>
									{p.status.replace(/_/g, ' ')}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
