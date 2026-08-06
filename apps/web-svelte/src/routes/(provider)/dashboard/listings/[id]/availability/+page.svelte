<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		getProviderAvailability,
		getIcalFeeds,
		addIcalFeed,
		deleteIcalFeed,
		syncIcalFeed,
		getBlockedDates,
		type AvailabilityRange,
		type IcalFeed
	} from '$lib/provider-api';
	import AvailabilityCalendar from '$lib/components/AvailabilityCalendar.svelte';
	import { formatDate } from '$lib/utils';

	const id = $derived(String(page.params.id ?? ''));

	let booked = $state<AvailabilityRange[]>([]);
	let blocked = $state<AvailabilityRange[]>([]);
	let feeds = $state<IcalFeed[]>([]);
	let loading = $state(true);
	let error = $state(false);

	let platform = $state('airbnb');
	let feedUrl = $state('');
	let adding = $state(false);
	let syncingId = $state<string | null>(null);
	let notice = $state('');
	let errMsg = $state('');

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				const [avail, bl, f] = await Promise.all([
					getProviderAvailability(id),
					getBlockedDates(id),
					getIcalFeeds(id)
				]);
				booked = avail.bookedRanges;
				blocked = avail.blockedRanges;
				feeds = f;
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	async function handleAdd(): Promise<void> {
		if (!feedUrl.trim()) {
			errMsg = 'Please paste an iCal feed URL.';
			return;
		}
		adding = true;
		errMsg = '';
		try {
			await addIcalFeed(id, platform, feedUrl.trim());
			feedUrl = '';
			notice = 'Feed added.';
			feeds = await getIcalFeeds(id);
		} catch {
			errMsg = 'Could not add the feed.';
		} finally {
			adding = false;
		}
	}

	async function handleSync(feedId: string): Promise<void> {
		syncingId = feedId;
		errMsg = '';
		try {
			await syncIcalFeed(id, feedId);
			notice = 'Feed synced.';
			feeds = await getIcalFeeds(id);
		} catch {
			errMsg = 'Could not sync the feed.';
		} finally {
			syncingId = null;
		}
	}

	async function handleDelete(feedId: string): Promise<void> {
		if (!confirm('Remove this iCal feed?')) return;
		try {
			await deleteIcalFeed(id, feedId);
			feeds = feeds.filter((f) => f.id !== feedId);
			notice = 'Feed removed.';
		} catch {
			errMsg = 'Could not remove the feed.';
		}
	}

	const allRanges = $derived([...booked, ...blocked]);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Availability & Channels</h1>
			<p class="mt-1 text-sm text-slate-500">Booked dates, iCal feeds and blocked dates for this listing.</p>
		</div>
		<a href="/dashboard/listings" class="text-sm font-semibold text-slate-400 hover:text-[#0c2614]">
			← Back to listings
		</a>
	</div>

	{#if notice}
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
	{/if}
	{#if errMsg}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errMsg}</div>
	{/if}

	{#if loading}
		<div class="h-80 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load availability.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Calendar -->
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<AvailabilityCalendar ranges={allRanges} />
			</div>

			<!-- Blocked dates -->
			<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
				<h2 class="text-sm font-bold text-slate-900">Blocked dates</h2>
				{#if blocked.length === 0}
					<p class="mt-3 text-sm text-slate-400">No blocked dates. Add iCal feeds below to keep availability in sync.</p>
				{:else}
					<div class="mt-3 space-y-2">
						{#each blocked as b (b.start + (b.end ?? ''))}
							<div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
								<span class="font-semibold text-slate-700">
									{formatDate(b.start)} → {b.end ? formatDate(b.end) : formatDate(b.start)}
								</span>
								<span class="text-slate-400">{b.reference ?? 'iCal'}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- iCal feeds -->
		<div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-bold text-slate-900">iCal / Channel feeds</h2>
			<div class="mt-3 flex flex-wrap items-end gap-2">
				<div>
					<label for="ical-platform" class="mb-1 block text-[11px] font-semibold text-slate-400">Platform</label>
					<select id="ical-platform" bind:value={platform} class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
						<option value="airbnb">Airbnb</option>
						<option value="booking">Booking.com</option>
						<option value="expedia">Expedia</option>
						<option value="google">Google</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div class="min-w-0 flex-1">
					<label for="ical-url" class="mb-1 block text-[11px] font-semibold text-slate-400">iCal feed URL</label>
					<input
						id="ical-url"
						bind:value={feedUrl}
						placeholder="https://…/calendar.ics"
						class="w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-3 py-2 text-sm focus:border-[#1D8D2B] focus:outline-none"
					/>
				</div>
				<button
					type="button"
					onclick={() => void handleAdd()}
					disabled={adding}
					class="rounded-xl bg-[#0c2614] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#081b0d] disabled:opacity-50"
				>
					{adding ? 'Adding…' : 'Add feed'}
				</button>
			</div>

			{#if feeds.length > 0}
				<div class="mt-4 divide-y divide-slate-100">
					{#each feeds as f (f.id)}
						<div class="flex flex-wrap items-center justify-between gap-2 py-3">
							<div class="min-w-0">
								<p class="text-sm font-semibold text-slate-800 capitalize">{f.platform}</p>
								<p class="truncate text-xs text-slate-400">{f.feedUrl}</p>
								<p class="text-[11px] text-slate-400">
									Status: {f.status}{f.lastSyncedAt ? ` · synced ${formatDate(f.lastSyncedAt)}` : ''}
									{f.lastError ? ` · ${f.lastError}` : ''}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => void handleSync(f.id)}
									disabled={syncingId === f.id}
									class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
								>
									{syncingId === f.id ? 'Syncing…' : 'Sync now'}
								</button>
								<button
									type="button"
									onclick={() => void handleDelete(f.id)}
									class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
								>
									Remove
								</button>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mt-4 text-sm text-slate-400">No iCal feeds connected yet.</p>
			{/if}
		</div>
	{/if}
</div>
