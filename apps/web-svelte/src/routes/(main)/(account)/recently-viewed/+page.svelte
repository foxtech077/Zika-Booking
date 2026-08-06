<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getRecentlyViewed, type RecentlyViewedListing } from '$lib/account-api';
	import { listingHref } from '$lib/listing-meta';
	import { formatMoney } from '$lib/currency-display';
	import ListingImage from '$lib/components/ListingImage.svelte';
	import type { ListingCategory } from '$lib/listing-api';

	let items = $state<RecentlyViewedListing[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	function load(): void {
		loading = true;
		error = null;
		void (async () => {
			try {
				items = await getRecentlyViewed();
			} catch {
				error = 'Could not load your recently viewed listings. Please try again.';
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function categoryLabel(cat: string | null | undefined): string {
		if (cat === 'car') return 'Car rental';
		if (cat === 'hotel') return 'Hotel';
		if (cat === 'apartment') return 'Apartment';
		return 'Listing';
	}

	function timeAgo(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<a
		href="/"
		class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#0c2614]"
	>
		<svg
			class="h-4 w-4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
		</svg>
		Back to Home
	</a>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Recently Viewed</h1>
			<p class="mt-1 text-sm text-slate-500">Listings you've been browsing lately.</p>
		</div>
		<button
			type="button"
			onclick={load}
			class="self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:self-auto"
		>
			Refresh
		</button>
	</div>

	{#if loading}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each [1, 2, 3, 4] as i (i)}
				<div
					class="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
				>
					<div class="h-44 bg-slate-100"></div>
					<div class="space-y-2 p-4">
						<div class="h-4 w-3/4 rounded bg-slate-100"></div>
						<div class="h-3 w-1/2 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">{error}</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if items.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0fdf4] text-emerald-600"
			>
				<svg
					class="h-8 w-8"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-bold text-slate-800">Nothing here yet</h3>
			<p class="mx-auto mt-2 max-w-sm text-sm text-slate-500">
				Browse some listings and they'll show up here so you can pick up where you left off.
			</p>
			<a
				href="/"
				class="mt-6 inline-block rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d]"
			>
				Explore Listings
			</a>
		</div>
	{:else}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each items as item (item.listingId)}
				{@const l = item.listing}
				{#if l}
					<div
						role="link"
						tabindex="0"
						onclick={() => void goto(listingHref(l.category, l.id))}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								void goto(listingHref(l.category, l.id));
							}
						}}
						class="group cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#1D8D2B]/40 hover:shadow-md"
					>
						<div class="relative h-44 overflow-hidden">
							<ListingImage
								src={l.primaryPhotoUrl}
								alt={l.title}
								category={(l.category as ListingCategory) ?? 'hotel'}
								class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
							/>
							<span
								class="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-700 uppercase backdrop-blur-sm"
							>
								{categoryLabel(l.category)}
							</span>
							<span
								class="absolute right-3 bottom-3 rounded-full bg-[#0c2614]/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm"
							>
								{timeAgo(item.viewedAt)}
							</span>
						</div>
						<div class="p-4">
							<h3 class="truncate text-sm font-bold text-slate-900">{l.title}</h3>
							<p class="mt-0.5 truncate text-xs text-slate-500">
								{[l.city, l.countryCode].filter(Boolean).join(', ') || '—'}
							</p>
							<div class="mt-3 flex items-center justify-between gap-2">
								<p class="text-sm font-bold text-slate-900">
									{l.nightlyRate != null
										? `${formatMoney(l.nightlyRate, l.currency ?? 'KES')}/night`
										: '—'}
								</p>
								<span
									class="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-[#0c2614] transition group-hover:border-[#1D8D2B] group-hover:text-[#1D8D2B]"
								>
									View
								</span>
							</div>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
