<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		getProviderListing,
		updateListing,
		activateListing,
		type ProviderListingDetail
	} from '$lib/provider-api';
	import { cn } from '$lib/utils';

	const id = $derived(String(page.params.id ?? ''));

	let listing = $state<ProviderListingDetail | null>(null);
	let loading = $state(true);
	let error = $state(false);

	let title = $state('');
	let description = $state('');
	let town = $state('');
	let country = $state('');
	let address = $state('');
	let price = $state('');
	let currency = $state('KES');
	let minStay = $state('1');
	let checkinTime = $state('14:00');
	let checkoutTime = $state('11:00');
	let cancellationPolicy = $state('flexible');
	let saving = $state(false);
	let saveMsg = $state('');
	let saveError = $state('');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const l = await getProviderListing(id);
				if (!l) {
					error = true;
					return;
				}
				listing = l;
				title = l.name ?? '';
				description = l.description ?? '';
				town = l.town ?? '';
				country = l.country ?? '';
				price = l.pricePerNight ? String(l.pricePerNight) : '';
				currency = l.currency ?? 'KES';
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
			await updateListing(id, {
				listingTitle: title.trim(),
				description: description.trim() || undefined,
				town: town.trim() || undefined,
				country: country.trim() ? country.trim().toUpperCase() : undefined,
				address: address.trim() || undefined,
				...(price ? { pricePerNight: Number(price) } : {}),
				currency: currency.trim().toUpperCase() || undefined,
				...(minStay ? { minStayNights: Number(minStay) } : {}),
				checkinTime,
				checkoutTime,
				cancellationPolicy
			});
			saveMsg = 'Saved successfully.';
		} catch {
			saveError = 'Could not save the listing. Please try again.';
		} finally {
			saving = false;
		}
	}

	async function handleActivate(): Promise<void> {
		saving = true;
		saveError = '';
		try {
			await activateListing(id);
			await load();
			saveMsg = 'Listing activated.';
		} catch {
			saveError = 'Could not activate the listing. Please check the details.';
		} finally {
			saving = false;
		}
	}

	const inputCls =
		'w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none';
	const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Edit listing</h1>
			<p class="mt-1 text-sm text-slate-500">Fill in the core details for your listing.</p>
		</div>
		<a href="/dashboard/listings" class="text-sm font-semibold text-slate-400 hover:text-[#0c2614]">
			← Back to listings
		</a>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-14 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error || !listing}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load this listing.</p>
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
			<div>
				<label for="l-name" class={labelCls}>Title</label>
				<input id="l-name" bind:value={title} placeholder="e.g. Serenity Beach House" class={inputCls} />
			</div>
			<div>
				<label for="l-desc" class={labelCls}>Description</label>
				<textarea
					id="l-desc"
					bind:value={description}
					rows="4"
					maxlength="1000"
					placeholder="Describe your property…"
					class={cn(inputCls, 'resize-none')}
				></textarea>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="l-town" class={labelCls}>Town / City</label>
					<input id="l-town" bind:value={town} placeholder="e.g. Mombasa" class={inputCls} />
				</div>
				<div>
					<label for="l-country" class={labelCls}>Country (2-letter code)</label>
					<input
						id="l-country"
						bind:value={country}
						placeholder="e.g. KE"
						maxlength="2"
						class={inputCls}
					/>
				</div>
			</div>
			<div>
				<label for="l-address" class={labelCls}>Address</label>
				<input id="l-address" bind:value={address} placeholder="Street address" class={inputCls} />
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<label for="l-price" class={labelCls}>Price per {listing.category === 'car' ? 'day' : 'night'}</label>
					<input id="l-price" type="number" min="0" bind:value={price} placeholder="0" class={inputCls} />
				</div>
				<div>
					<label for="l-currency" class={labelCls}>Currency</label>
					<input id="l-currency" bind:value={currency} placeholder="KES" maxlength="3" class={inputCls} />
				</div>
				<div>
					<label for="l-minstay" class={labelCls}>Minimum stay (nights)</label>
					<input id="l-minstay" type="number" min="1" bind:value={minStay} class={inputCls} />
				</div>
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<label for="l-checkin" class={labelCls}>Check-in time</label>
					<input id="l-checkin" type="time" bind:value={checkinTime} class={inputCls} />
				</div>
				<div>
					<label for="l-checkout" class={labelCls}>Check-out time</label>
					<input id="l-checkout" type="time" bind:value={checkoutTime} class={inputCls} />
				</div>
				<div>
					<label for="l-cancel" class={labelCls}>Cancellation policy</label>
					<select id="l-cancel" bind:value={cancellationPolicy} class={inputCls}>
						<option value="flexible">Flexible</option>
						<option value="moderate">Moderate</option>
						<option value="strict">Strict</option>
					</select>
				</div>
			</div>

			<div class="flex flex-wrap gap-3 pt-2">
				<button
					type="button"
					onclick={() => void handleSave()}
					disabled={saving}
					class="rounded-xl bg-[#0c2614] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#081b0d] disabled:opacity-60"
				>
					{saving ? 'Saving…' : 'Save changes'}
				</button>
				<button
					type="button"
					onclick={() => void handleActivate()}
					disabled={saving}
					class="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
				>
					Activate listing
				</button>
			</div>
		</div>
	{/if}
</div>
