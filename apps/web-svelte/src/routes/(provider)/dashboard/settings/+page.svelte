<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getMerchantProfile,
		updateMerchantProfile,
		type MerchantProfile
	} from '$lib/provider-api';

	let merchant = $state<MerchantProfile | null>(null);
	let loading = $state(true);
	let error = $state(false);

	let businessName = $state('');
	let country = $state('');
	let mobileMoneyNumber = $state('');
	let bankName = $state('');
	let bankAccountNumber = $state('');
	let bankAccountName = $state('');

	let saving = $state(false);
	let saveMsg = $state('');
	let saveError = $state('');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const m = await getMerchantProfile();
				merchant = m;
				if (m) {
					businessName = m.businessName ?? '';
					country = m.country ?? '';
					mobileMoneyNumber = m.mobileMoneyNumber ?? '';
					bankName = m.bankName ?? '';
					bankAccountNumber = m.bankAccountNumber ?? '';
					bankAccountName = m.bankAccountName ?? '';
				}
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	async function handleSave(): Promise<void> {
		saving = true;
		saveMsg = '';
		saveError = '';
		try {
			await updateMerchantProfile({
				...(businessName.trim() ? { businessName: businessName.trim() } : {}),
				...(country.trim() ? { country: country.trim().toUpperCase() } : {}),
				...(mobileMoneyNumber.trim() ? { mobileMoneyNumber: mobileMoneyNumber.trim() } : {}),
				...(bankName.trim() ? { bankName: bankName.trim() } : {}),
				...(bankAccountNumber.trim() ? { bankAccountNumber: bankAccountNumber.trim() } : {}),
				...(bankAccountName.trim() ? { bankAccountName: bankAccountName.trim() } : {})
			});
			saveMsg = 'Settings saved.';
		} catch {
			saveError = 'Could not save settings. Please try again.';
		} finally {
			saving = false;
		}
	}

	const inputCls =
		'w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none';
	const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
		<p class="mt-1 text-sm text-slate-500">Your business and payout details.</p>
	</div>

	{#if loading}
		<div class="h-60 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load your settings.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else}
		{#if saveMsg}
			<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
				{saveMsg}
			</div>
		{/if}
		{#if saveError}
			<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
				{saveError}
			</div>
		{/if}

		<div class="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="s-business" class={labelCls}>Business name</label>
					<input id="s-business" bind:value={businessName} placeholder="Your business name" class={inputCls} />
				</div>
				<div>
					<label for="s-country" class={labelCls}>Country (2-letter code)</label>
					<input id="s-country" bind:value={country} maxlength="2" placeholder="KE" class={inputCls} />
				</div>
			</div>

			<h3 class="border-t border-slate-100 pt-4 text-xs font-bold tracking-wider text-slate-400 uppercase">
				Mobile money
			</h3>
			<div>
				<label for="s-mobile" class={labelCls}>Mobile money number</label>
				<input
					id="s-mobile"
					bind:value={mobileMoneyNumber}
					placeholder="+254700000000"
					class={inputCls}
				/>
			</div>

			<h3 class="border-t border-slate-100 pt-4 text-xs font-bold tracking-wider text-slate-400 uppercase">
				Bank details
			</h3>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="s-bank" class={labelCls}>Bank name</label>
					<input id="s-bank" bind:value={bankName} placeholder="Bank name" class={inputCls} />
				</div>
				<div>
					<label for="s-bankname" class={labelCls}>Account name</label>
					<input id="s-bankname" bind:value={bankAccountName} placeholder="Account name" class={inputCls} />
				</div>
			</div>
			<div>
				<label for="s-bankno" class={labelCls}>Account number</label>
				<input id="s-bankno" bind:value={bankAccountNumber} placeholder="Account number" class={inputCls} />
			</div>

			<button
				type="button"
				onclick={() => void handleSave()}
				disabled={saving}
				class="rounded-xl bg-[#0c2614] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#081b0d] disabled:opacity-60"
			>
				{saving ? 'Saving…' : 'Save settings'}
			</button>
		</div>
	{/if}
</div>
