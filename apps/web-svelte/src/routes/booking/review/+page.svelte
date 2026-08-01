<script lang="ts">
	import { page } from '$app/state';
	import { fmtDates } from '$lib/booking-utils';

	const sp = $derived(page.url.searchParams);
	const listingId = $derived(sp.get('listingId') ?? '');
	const start = $derived(sp.get('start') ?? '');
	const end = $derived(sp.get('end') ?? '');
	const guests = $derived(sp.get('guests') ?? '');
	const nights = $derived(sp.get('nights') ?? '');
</script>

<svelte:head>
	<title>Booking | Kainook</title>
	<meta name="description" content="Complete your Kainook booking." />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-16 sm:px-6">
	<div class="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-md">
		<div
			class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1D8D2B]/10 text-2xl"
		>
			🗓️
		</div>
		<h1 class="mt-4 font-serif text-3xl font-bold text-slate-900">Your booking</h1>

		{#if listingId}
			<dl
				class="mt-6 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left text-sm"
			>
				<div class="flex justify-between">
					<dt class="text-slate-400">Listing</dt>
					<dd class="font-semibold text-slate-700">{listingId.slice(0, 8)}…</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-400">Dates</dt>
					<dd class="font-semibold text-slate-700">
						{fmtDates(start, end)}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-400">Nights</dt>
					<dd class="font-semibold text-slate-700">{nights || '—'}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-slate-400">Guests</dt>
					<dd class="font-semibold text-slate-700">{guests || '—'}</dd>
				</div>
			</dl>
		{:else}
			<p class="mt-6 text-sm text-slate-400">No booking details were provided.</p>
		{/if}

		<div
			class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-800"
		>
			The full checkout flow (guest details, payment, confirmation) is coming soon. You can already
			choose your dates and see the price breakdown on the listing page.
		</div>

		<div class="mt-6 flex items-center justify-center gap-3">
			<a
				href="/"
				class="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-400"
			>
				Back to home
			</a>
			{#if listingId}
				<a
					href={`/listings/${listingId}`}
					class="rounded-xl bg-[#1D8D2B] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16852a]"
				>
					Back to listing
				</a>
			{/if}
		</div>
	</div>
</div>
