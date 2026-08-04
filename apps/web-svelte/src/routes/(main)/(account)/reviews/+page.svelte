<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getMyReviews, submitReview, type MyReview } from '$lib/account-api';
	import { formatDate, cn } from '$lib/utils';

	const bookingId = $derived(page.url.searchParams.get('bookingId') ?? '');
	const listingName = $derived(page.url.searchParams.get('listingName') ?? '');

	let reviews = $state<MyReview[]>([]);
	let loading = $state(true);
	let error = $state(false);

	let rating = $state(0);
	let title = $state('');
	let body = $state('');
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let submittedOk = $state(false);

	const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				reviews = await getMyReviews();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	const average = $derived(
		reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
	);
	const replies = $derived(reviews.filter((r) => r.providerReply).length);

	function handleSubmit(): void {
		if (rating < 1) {
			submitError = 'Please select a star rating.';
			return;
		}
		if (!bookingId) {
			submitError = 'No booking selected for this review.';
			return;
		}
		submitError = null;
		submitting = true;
		void (async () => {
			try {
				await submitReview({
					bookingId,
					rating,
					title: title.trim() || undefined,
					body: body.trim() || undefined
				});
				submittedOk = true;
				title = '';
				body = '';
				load();
			} catch (e) {
				submitError = (e as Error).message ?? 'Could not submit your review.';
			} finally {
				submitting = false;
			}
		})();
	}
</script>

<div class="space-y-6">
	<div class="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.28em] text-emerald-700 uppercase">
			Traveller reviews
		</p>
		<h1 class="mt-1 text-3xl font-bold text-slate-950">My Reviews</h1>
		<p class="mt-1 text-sm text-slate-500">
			Share your experience and see what hosts have said back.
		</p>
	</div>

	{#if submittedOk}
		<div
			class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
		>
			<p>Thanks! Your review has been submitted.</p>
			<button
				type="button"
				onclick={() => (submittedOk = false)}
				class="mt-1 text-xs underline opacity-70 hover:opacity-100"
			>
				Dismiss
			</button>
		</div>
	{/if}

	<div class="grid gap-6 xl:grid-cols-[380px_1fr]">
		<!-- Leave a review -->
		<div class="h-fit rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
			<h3 class="text-lg font-bold text-slate-900">Leave a review</h3>

			{#if bookingId}
				<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
					<p class="font-mono text-[11px] font-semibold text-slate-400">
						Booking {bookingId.slice(0, 8).toUpperCase()}
					</p>
					<p class="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
						<span class="rounded-full bg-[#16a34a] px-2 py-0.5 text-[10px] font-bold text-white"
							>ELIGIBLE</span
						>
						<span class="truncate">{listingName || 'This booking'}</span>
					</p>
				</div>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					class="mt-4 space-y-4"
				>
					<div>
						<span class="mb-1.5 block text-sm font-medium text-slate-700">Rating</span>
						<div class="flex items-center gap-1" role="radiogroup" aria-label="Rating">
							{#each [1, 2, 3, 4, 5] as i (i)}
								<button
									type="button"
									onclick={() => (rating = i)}
									role="radio"
									aria-checked={rating === i}
									aria-label={`${i} star${i !== 1 ? 's' : ''}`}
									class={cn(
										'text-2xl transition',
										i <= rating ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'
									)}
								>
									★
								</button>
							{/each}
							<span class="ml-2 text-sm font-semibold text-slate-500">
								{rating > 0 ? RATING_LABELS[rating - 1] : 'Tap to rate'}
							</span>
						</div>
					</div>

					<div>
						<label for="review-title" class="mb-1.5 block text-sm font-medium text-slate-700"
							>Title</label
						>
						<input
							id="review-title"
							bind:value={title}
							maxlength="100"
							placeholder="A short headline (optional)"
							class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
						/>
					</div>

					<div>
						<label for="review-body" class="mb-1.5 block text-sm font-medium text-slate-700"
							>Review</label
						>
						<textarea
							id="review-body"
							bind:value={body}
							maxlength="2000"
							rows="4"
							placeholder="Tell others about your stay (optional)"
							class="w-full resize-none rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
						></textarea>
						<p class="mt-1 text-right text-xs text-slate-400">{body.length}/2000</p>
					</div>

					{#if submitError}
						<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
							<p class="text-sm text-red-600">{submitError}</p>
						</div>
					{/if}

					<button
						type="submit"
						disabled={submitting}
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if submitting}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
						{/if}
						Submit review
					</button>
					<p class="text-center text-xs text-slate-400">
						Only completed bookings within the review window can be reviewed.
					</p>
				</form>
			{:else}
				<div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center">
					<div
						class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"
					>
						<svg
							class="h-6 w-6"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
							/>
						</svg>
					</div>
					<p class="text-sm font-semibold text-slate-600">No review link available</p>
					<p class="mx-auto mt-1 max-w-xs text-xs text-slate-500">
						Open a completed booking and use "Leave Review" to write one.
					</p>
					<a
						href="/bookings"
						class="mt-4 inline-block rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						My Reservations
					</a>
				</div>
			{/if}
		</div>

		<!-- My reviews -->
		<div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
			<div class="flex items-center justify-between gap-4">
				<h3 class="text-lg font-bold text-slate-900">My reviews</h3>
				<button
					type="button"
					onclick={load}
					class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Refresh
				</button>
			</div>

			{#if !loading}
				<div
					class="mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
				>
					<div class="text-center">
						<p class="text-xl font-bold text-slate-900">{reviews.length}</p>
						<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Total</p>
					</div>
					<div class="text-center">
						<p class="text-xl font-bold text-slate-900">
							{average ? average.toFixed(1) : '—'}
							<span class="text-amber-400">★</span>
						</p>
						<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Average</p>
					</div>
					<div class="text-center">
						<p class="text-xl font-bold text-slate-900">{replies}</p>
						<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Replies</p>
					</div>
				</div>
			{/if}

			{#if loading}
				<div class="mt-4 space-y-4">
					{#each [1, 2] as i (i)}
						<div class="animate-pulse rounded-2xl border border-slate-100 p-4">
							<div class="h-4 w-1/3 rounded bg-slate-100"></div>
							<div class="mt-2 h-3 w-2/3 rounded bg-slate-100"></div>
						</div>
					{/each}
				</div>
			{:else if error}
				<div class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
					<p class="text-sm text-red-600">Could not load your reviews.</p>
					<button
						type="button"
						onclick={load}
						class="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Try Again
					</button>
				</div>
			{:else if reviews.length === 0}
				<div class="mt-4 rounded-2xl border border-slate-100 p-8 text-center">
					<p class="text-sm text-slate-500">You haven't written any reviews yet.</p>
				</div>
			{:else}
				<div class="mt-4 space-y-4">
					{#each [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as r (r.id)}
						<div class="rounded-2xl border border-slate-200 p-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-bold text-slate-900">{r.listingName}</p>
									<p class="mt-0.5 font-mono text-[11px] text-slate-400">
										Booking {r.bookingId.slice(0, 8).toUpperCase()} · {formatDate(r.createdAt)}
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-1">
									{#each [1, 2, 3, 4, 5] as i (i)}
										<span class={i <= r.rating ? 'text-amber-400' : 'text-slate-200'}>★</span>
									{/each}
								</div>
							</div>
							{#if r.title}
								<p class="mt-2 text-sm font-semibold text-slate-800">{r.title}</p>
							{/if}
							{#if r.body}
								<p class="mt-1 text-sm text-slate-600">{r.body}</p>
							{/if}
							<div class="mt-2 flex flex-wrap items-center gap-2">
								{#if r.isHidden}
									<span
										class="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
									>
										Hidden
									</span>
								{/if}
								{#if r.providerReply}
									<span
										class="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
									>
										Provider replied
									</span>
								{/if}
							</div>
							{#if r.providerReply}
								<div class="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
									<p class="text-xs font-bold text-green-800">Provider reply</p>
									<p class="mt-1 text-sm text-green-900">{r.providerReply}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
