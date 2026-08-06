<script lang="ts">
	import { onMount } from 'svelte';
	import { LISTING_API_URL } from '$lib/config';
	import {
		fetchListingReviews,
		type ListingReviewsResult
	} from '$lib/listing-api';

	let {
		listingId,
		initialReviews,
		listingName
	}: {
		listingId: string;
		initialReviews: ListingReviewsResult;
		listingName: string;
	} = $props();

	const PAGE_SIZE = 4;
	const stars = [1, 2, 3, 4, 5];

	let page = $state(1);
	let data = $state<ListingReviewsResult>(initialReviews);
	let loading = $state(false);
	let error = $state(false);
	let errorMessage = $state('');

	async function load(target: number, showSpinner = true): Promise<void> {
		if (showSpinner) loading = true;
		error = false;
		try {
			const res = await fetchListingReviews(fetch, listingId, LISTING_API_URL, target, PAGE_SIZE);
			if (!res) {
				error = true;
				errorMessage = 'The reviews feed could not be loaded.';
				return;
			}
			data = res;
			page = target;
		} catch {
			error = true;
			errorMessage = 'The reviews feed could not be loaded.';
		} finally {
			loading = false;
		}
	}

	function goTo(target: number): void {
		if (target < 1 || target > totalPages) return;
		void load(target);
	}

	function retry(): void {
		void load(page, false);
	}

	onMount(() => {
		// The SSR load serves page 1; if it differs from the client contract
		// (or is empty of reviews) a refresh is harmless.
		if (!initialReviews?.reviews?.length && initialReviews?.total) void load(1);
	});

	const reviews = $derived(data.reviews ?? []);
	const totalPages = $derived(Math.max(1, data.totalPages ?? 1));
	const total = $derived(data.total ?? 0);
	const averageRating = $derived(data.averageRating ?? null);

	function displayName(guestId: string): string {
		const short = guestId.replace(/-/g, '').slice(0, 8).toUpperCase();
		return `Reviewer ${short}`;
	}

	function fmtDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	}
</script>

<div>
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-3">
			<h2 class="font-serif text-2xl font-bold text-slate-900">Guest reviews</h2>
			{#if averageRating}
				<span
					class="flex items-center gap-1 rounded-full bg-[#1D8D2B]/10 px-3 py-1 text-sm font-bold text-[#0c2614]"
				>
					<span class="text-amber-500">★</span>
					{Number(averageRating).toFixed(1)}
				</span>
			{/if}
			<span class="text-xs text-slate-400"
				>({total} review{total !== 1 ? 's' : ''})</span
			>
		</div>
		<button
			type="button"
			onclick={retry}
			class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
		>
			<svg
				class="h-3.5 w-3.5"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
				/>
			</svg>
			Refresh
		</button>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each Array(3) as _, i (i)}
				<div class="h-36 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/60"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
			<p class="text-sm font-semibold text-slate-900">Unable to load reviews</p>
			<p class="mt-1 text-xs text-slate-400">{errorMessage}</p>
			<button
				type="button"
				onclick={retry}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
			>
				Retry
			</button>
		</div>
	{:else if reviews.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white px-5 py-12 text-center">
			<p class="text-sm font-semibold text-slate-900">No public reviews yet</p>
			<p class="mt-1 text-xs text-slate-400">
				Be the first to share your experience at {listingName}.
			</p>
		</div>
	{:else}
		<!-- Overall rating summary -->
		<div
			class="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
					Overall rating
				</p>
				<div class="mt-1 flex items-center gap-3">
					<div class="flex items-baseline gap-1">
						<span class="text-3xl font-bold text-slate-950">
							{averageRating == null ? '—' : Number(averageRating).toFixed(1)}
						</span>
						<span class="text-sm text-slate-500">/ 5</span>
					</div>
					{#if averageRating != null}
						<span class="flex items-center gap-0.5" aria-label={`Rated ${averageRating} out of 5`}>
							{#each stars as s (s)}
								<span class={s <= Math.round(averageRating) ? 'text-amber-400' : 'text-slate-300'}>
									★
								</span>
							{/each}
						</span>
					{/if}
				</div>
			</div>
			<div class="text-xs text-slate-500">
				{total > 0 ? `Showing page ${page} of ${totalPages}` : 'No reviews to show'}
			</div>
		</div>

		<div class="space-y-4">
			{#each reviews as review (review.id)}
				<div class="rounded-2xl border border-slate-100 bg-white p-5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-slate-800">{displayName(review.guestId)}</span>
							<span
								class="flex items-center gap-0.5"
								aria-label={`Rated ${review.rating} out of 5`}
							>
								{#each stars as s (s)}
									<span class={s <= review.rating ? 'text-amber-400' : 'text-slate-200'}>★</span>
								{/each}
							</span>
						</div>
						<span class="text-[10px] font-medium text-slate-400">{fmtDate(review.createdAt)}</span>
					</div>
					{#if review.title}
						<h3 class="mt-2 text-sm font-bold text-slate-900">{review.title}</h3>
					{/if}
					{#if review.body}
						<p class="mt-1 text-sm leading-relaxed text-slate-600">{review.body}</p>
					{/if}
					{#if review.providerReply}
						<div class="mt-3 rounded-xl bg-slate-50 px-4 py-3">
							<p class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
								Response from host
							</p>
							<p class="mt-1 text-xs leading-relaxed text-slate-600">{review.providerReply}</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
				<p class="text-sm text-slate-500">
					Page <span class="font-semibold text-slate-900">{page}</span> of
					<span class="font-semibold text-slate-900"> {totalPages}</span>
				</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => goTo(page - 1)}
						disabled={page <= 1}
						class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Previous
					</button>
					<button
						type="button"
						onclick={() => goTo(page + 1)}
						disabled={page >= totalPages}
						class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
