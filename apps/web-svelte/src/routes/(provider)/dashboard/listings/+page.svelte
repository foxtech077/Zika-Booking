<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getProviderListings,
		activateListing,
		deactivateListing,
		deleteListing,
		type ProviderListing
	} from '$lib/provider-api';
	import { formatMoney } from '$lib/currency-display';
	import { cn } from '$lib/utils';

	let listings = $state<ProviderListing[]>([]);
	let loading = $state(true);
	let error = $state(false);
	let busyId = $state<string | null>(null);
	let notice = $state('');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				listings = await getProviderListings();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function statusClass(s: string): string {
		if (s === 'active' || s === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
		if (s === 'pending' || s === 'draft' || s === 'pending_review') return 'bg-amber-50 text-amber-700 border-amber-200';
		return 'bg-slate-100 text-slate-500 border-slate-200';
	}

	async function toggleActive(l: ProviderListing): Promise<void> {
		if (busyId) return;
		busyId = l.id;
		notice = '';
		try {
			if (l.status === 'active' || l.status === 'approved') {
				await deactivateListing(l.id);
			} else {
				await activateListing(l.id);
			}
			await load();
		} catch {
			notice = 'Could not update the listing. Please try again.';
		} finally {
			busyId = null;
		}
	}

	async function remove(l: ProviderListing): Promise<void> {
		if (!confirm(`Delete "${l.name || l.id}"? This cannot be undone.`)) return;
		busyId = l.id;
		notice = '';
		try {
			await deleteListing(l.id);
			listings = listings.filter((x) => x.id !== l.id);
			notice = 'Listing deleted.';
		} catch {
			notice = 'Could not delete the listing. Please try again.';
		} finally {
			busyId = null;
		}
	}

	function categoryLabel(c: string): string {
		if (c === 'hotel') return 'Hotel';
		if (c === 'apartment') return 'Home';
		if (c === 'car') return 'Car Rental';
		return c;
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">My Listings</h1>
			<p class="mt-1 text-sm text-slate-500">Create and manage your properties.</p>
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={load}
				class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
			>
				Refresh
			</button>
			<button
				type="button"
				onclick={() => void goto('/dashboard/listings/new')}
				class="rounded-xl bg-[#0c2614] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
			>
				+ Create listing
			</button>
		</div>
	</div>

	{#if notice}
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			{notice}
		</div>
	{/if}

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-24 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load your listings.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if listings.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center">
			<p class="text-sm font-semibold text-slate-700">No listings yet</p>
			<p class="mt-1 text-sm text-slate-400">Create your first listing to start hosting.</p>
			<button
				type="button"
				onclick={() => void goto('/dashboard/listings/new')}
				class="mt-5 rounded-xl bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
			>
				Create listing
			</button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each listings as l (l.id)}
				<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<p class="truncate text-sm font-bold text-slate-900">{l.name || 'Untitled listing'}</p>
							<span
								class={cn(
									'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
									statusClass(l.status)
								)}
							>
								{l.status.replace(/_/g, ' ')}
							</span>
						</div>
						<p class="mt-0.5 text-xs text-slate-400">
							{categoryLabel(l.category)} · {l.bookingCount} booking{l.bookingCount !== 1 ? 's' : ''} ·{' '}
							{l.reviewCount} review{l.reviewCount !== 1 ? 's' : ''}
						</p>
						{#if l.averageRating != null}
							<p class="text-xs text-slate-500">★ {l.averageRating.toFixed(1)}</p>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<span class="text-sm font-bold text-slate-900">
							{formatMoney(l.totalRevenue, l.currency)}
						</span>
						<a
							href={`/dashboard/listings/${l.id}/edit`}
							class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
						>
							Edit
						</a>
						<a
							href={`/dashboard/listings/${l.id}/availability`}
							class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
						>
							Availability
						</a>
						<button
							type="button"
							onclick={() => void toggleActive(l)}
							disabled={busyId === l.id}
							class={cn(
								'rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50',
								l.status === 'active' || l.status === 'approved'
									? 'border-amber-200 text-amber-700 hover:bg-amber-50'
									: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
							)}
						>
							{busyId === l.id
								? '…'
								: l.status === 'active' || l.status === 'approved'
									? 'Deactivate'
									: 'Activate'}
						</button>
						<button
							type="button"
							onclick={() => void remove(l)}
							disabled={busyId === l.id}
							class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
