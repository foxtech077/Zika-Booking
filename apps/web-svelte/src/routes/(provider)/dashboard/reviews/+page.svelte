<script lang="ts">
	import { onMount } from 'svelte';
	import { getProviderReviews, replyToReview, type ProviderReview } from '$lib/provider-api';
	import { formatDate, cn } from '$lib/utils';

	let reviews = $state<ProviderReview[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state(false);
	let replyingId = $state<string | null>(null);
	let replyText = $state('');
	let replyError = $state('');
	let replyMsg = $state('');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const res = await getProviderReviews({ limit: 50 });
				reviews = res.reviews;
				total = res.total;
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	async function handleReply(r: ProviderReview): Promise<void> {
		if (!replyText.trim()) {
			replyError = 'Please write a reply.';
			return;
		}
		replyingId = r.id;
		replyError = '';
		replyMsg = '';
		try {
			await replyToReview(r.id, replyText.trim());
			replyMsg = 'Reply posted.';
			replyText = '';
			await load();
		} catch {
			replyError = 'Could not post the reply. Please try again.';
		} finally {
			replyingId = null;
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Reviews</h1>
		<p class="mt-1 text-sm text-slate-500">{total} review{total !== 1 ? 's' : ''} from guests.</p>
	</div>

	{#if replyMsg}
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			{replyMsg}
		</div>
	{/if}

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div class="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load reviews.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if reviews.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center">
			<p class="text-sm text-slate-400">No reviews yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each reviews as r (r.id)}
				<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-slate-800">
								Guest {r.guestId.replace(/-/g, '').slice(0, 8).toUpperCase()}
							</span>
							<span class="flex items-center gap-0.5">
								{#each [1, 2, 3, 4, 5] as i (i)}
									<span class={i <= r.rating ? 'text-amber-400' : 'text-slate-200'}>★</span>
								{/each}
							</span>
						</div>
						<span class="text-xs text-slate-400">
							{r.listingName} · {formatDate(r.createdAt)}
						</span>
					</div>
					{#if r.title}
						<p class="mt-2 text-sm font-semibold text-slate-800">{r.title}</p>
					{/if}
					{#if r.body}
						<p class="mt-1 text-sm text-slate-600">{r.body}</p>
					{/if}

					{#if r.providerReply}
						<div class="mt-3 rounded-xl bg-emerald-50 p-3">
							<p class="text-[10px] font-bold tracking-wider text-emerald-700 uppercase">
								Your reply{r.providerRepliedAt ? ` · ${formatDate(r.providerRepliedAt)}` : ''}
							</p>
							<p class="mt-1 text-sm text-emerald-900">{r.providerReply}</p>
						</div>
					{:else}
						<div class="mt-3 rounded-xl bg-slate-50 p-3">
							<textarea
								bind:value={replyText}
								rows="2"
								maxlength="1000"
								placeholder="Reply to this review…"
								class="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#1D8D2B] focus:outline-none"
							></textarea>
							<div class="mt-2 flex items-center justify-between gap-2">
								{#if replyError}
									<p class="text-xs text-red-600">{replyError}</p>
								{:else}
									<span class="text-[10px] text-slate-400">Your reply is public.</span>
								{/if}
								<button
									type="button"
									onclick={() => void handleReply(r)}
									disabled={replyingId === r.id}
									class={cn(
										'rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50',
										'bg-[#16a34a] hover:bg-[#15803d]'
									)}
								>
									{replyingId === r.id ? 'Posting…' : 'Reply'}
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
