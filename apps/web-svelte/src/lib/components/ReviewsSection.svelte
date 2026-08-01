<script lang="ts">
	import type { ListingReviewsResult } from '$lib/listing-api';

	let {
		reviews,
		listingName
	}: {
		reviews: ListingReviewsResult;
		listingName: string;
	} = $props();

	const stars = [1, 2, 3, 4, 5];

	function displayName(guestId: string): string {
		const short = guestId.replace(/-/g, '').slice(0, 8).toUpperCase();
		return `Guest ${short}`;
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
	<div class="mb-5 flex flex-wrap items-center gap-3">
		<h2 class="font-serif text-2xl font-bold text-slate-900">Guest reviews</h2>
		{#if reviews.averageRating}
			<span
				class="flex items-center gap-1 rounded-full bg-[#1D8D2B]/10 px-3 py-1 text-sm font-bold text-[#0c2614]"
			>
				<span class="text-amber-500">★</span>
				{Number(reviews.averageRating).toFixed(1)}
			</span>
			<span class="text-xs text-slate-400"
				>({reviews.total} review{reviews.total !== 1 ? 's' : ''})</span
			>
		{/if}
	</div>

	{#if reviews.reviews.length === 0}
		<p
			class="rounded-2xl border border-slate-100 bg-white px-5 py-8 text-center text-sm text-slate-400"
		>
			No reviews for {listingName} yet.
		</p>
	{:else}
		<div class="space-y-4">
			{#each reviews.reviews as review (review.id)}
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
	{/if}
</div>
