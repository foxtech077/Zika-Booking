<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getStripeConnectStatus } from '$lib/provider-api';

	let status = $state<'checking' | 'complete' | 'error'>('checking');

	onMount(() => {
		void (async () => {
			try {
				const res = await getStripeConnectStatus();
				status = res?.status === 'active' ? 'complete' : 'error';
			} catch {
				status = 'error';
			} finally {
				setTimeout(() => void goto('/dashboard/payments'), 2000);
			}
		})();
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
	<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
		{#if status === 'checking'}
			<p class="text-2xl">⏳</p>
			<h1 class="mt-3 text-2xl font-bold text-slate-900">Verifying your account…</h1>
			<p class="mt-2 text-sm text-slate-500">Checking your Stripe Connect status.</p>
		{:else if status === 'complete'}
			<p class="text-2xl">✅</p>
			<h1 class="mt-3 text-2xl font-bold text-slate-900">Stripe Connected!</h1>
			<p class="mt-2 text-sm text-slate-500">Redirecting you to your payment settings…</p>
		{:else}
			<p class="text-2xl">⚠️</p>
			<h1 class="mt-3 text-2xl font-bold text-slate-900">Not connected yet</h1>
			<p class="mt-2 text-sm text-slate-500">Your Stripe account needs a bit more setup. Redirecting…</p>
		{/if}
	</div>
</div>
