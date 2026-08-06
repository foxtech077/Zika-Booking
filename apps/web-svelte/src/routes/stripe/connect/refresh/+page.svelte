<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { refreshStripeConnect } from '$lib/provider-api';

	let status = $state<'loading' | 'error'>('loading');

	onMount(() => {
		void (async () => {
			try {
				const res = await refreshStripeConnect();
				if (res.onboardingUrl) {
					window.location.href = res.onboardingUrl;
					return;
				}
				status = 'error';
			} catch {
				status = 'error';
			}
		})();
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
	<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
		{#if status === 'loading'}
			<p class="text-2xl">⏳</p>
			<h1 class="mt-3 text-2xl font-bold text-slate-900">Opening Stripe…</h1>
			<p class="mt-2 text-sm text-slate-500">Preparing your onboarding link.</p>
		{:else}
			<p class="text-2xl">⚠️</p>
			<h1 class="mt-3 text-2xl font-bold text-slate-900">Couldn't open Stripe</h1>
			<p class="mt-2 text-sm text-slate-500">Please try again from your payment settings.</p>
			<button
				type="button"
				onclick={() => void goto('/dashboard/payments')}
				class="mt-5 rounded-xl bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
			>
				Back to payments
			</button>
		{/if}
	</div>
</div>
