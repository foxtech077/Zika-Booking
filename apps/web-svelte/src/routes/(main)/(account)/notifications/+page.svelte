<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getNotifications,
		markNotificationRead,
		markAllNotificationsRead,
		type AppNotification
	} from '$lib/account-api';
	import { fetchListingDetail } from '$lib/listing-api';
	import { LISTING_API_URL } from '$lib/config';
	import { listingHref } from '$lib/listing-meta';
	import { formatRelativeTime, cn } from '$lib/utils';

	type Category =
		| 'booking'
		| 'message'
		| 'promotion'
		| 'payment'
		| 'reminder'
		| 'loyalty'
		| 'system';

	function getCategory(type: string): Category {
		const t = (type ?? '').toLowerCase();
		if (
			t.includes('booking') ||
			t === 'new_booking' ||
			t.includes('checkin') ||
			t.includes('checkout') ||
			t === 'review_received' ||
			t === 'listing_approved'
		)
			return 'booking';
		if (t.includes('message') || t.includes('chat') || t.includes('conversation')) return 'message';
		if (
			t.includes('promotion') ||
			t.includes('promo') ||
			t.includes('sale') ||
			t.includes('offer') ||
			t.includes('deal')
		)
			return 'promotion';
		if (t.includes('payment') || t.includes('refund') || t === 'payment_received') return 'payment';
		if (t.includes('reminder') || t.includes('upcoming')) return 'reminder';
		if (t.includes('loyalty') || t.includes('reward') || t.includes('point') || t.includes('tier'))
			return 'loyalty';
		return 'system';
	}

	const CATEGORY_CFG: Record<
		Category,
		{ color: string; bg: string; border: string; icon: string }
	> = {
		booking: {
			color: 'text-emerald-600',
			bg: 'bg-emerald-50',
			border: 'border-emerald-100',
			icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
		},
		message: {
			color: 'text-blue-600',
			bg: 'bg-blue-50',
			border: 'border-blue-100',
			icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
		},
		promotion: {
			color: 'text-orange-600',
			bg: 'bg-orange-50',
			border: 'border-orange-100',
			icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z'
		},
		payment: {
			color: 'text-violet-600',
			bg: 'bg-violet-50',
			border: 'border-violet-100',
			icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z'
		},
		reminder: {
			color: 'text-cyan-600',
			bg: 'bg-cyan-50',
			border: 'border-cyan-100',
			icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		loyalty: {
			color: 'text-amber-600',
			bg: 'bg-amber-50',
			border: 'border-amber-100',
			icon: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0'
		},
		system: {
			color: 'text-slate-600',
			bg: 'bg-slate-50',
			border: 'border-slate-100',
			icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z'
		}
	};

	let notifications = $state<AppNotification[]>([]);
	let loading = $state(true);
	let error = $state(false);
	let filter = $state<'all' | 'unread'>('all');
	let markingAll = $state(false);

	const unreadCount = $derived(notifications.filter((n) => !n.isRead).length);
	const visible = $derived(
		[...notifications]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.filter((n) => (filter === 'unread' ? !n.isRead : true))
	);

	function load(): void {
		loading = true;
		error = false;
		void (async () => {
			try {
				notifications = await getNotifications();
			} catch {
				error = true;
			} finally {
				loading = false;
			}
		})();
	}

	onMount(load);

	function handleClick(n: AppNotification): void {
		if (!n.isRead) {
			const previous = notifications;
			notifications = notifications.map((x) => (x.id === n.id ? { ...x, isRead: true } : x));
			// Roll back the optimistic read if the API call fails.
			void markNotificationRead(n.id).catch(() => {
				notifications = previous;
			});
		}
		const { bookingId, conversationId, listingId } = n.data ?? {};
		if (bookingId) void goto(`/bookings?highlight=${bookingId}`);
		else if (conversationId) void goto(`/messages?conversationId=${conversationId}`);
		else if (listingId) {
			// The listing URL is category-scoped, which the notification payload
			// doesn't carry — resolve it from the listing before navigating.
			void (async () => {
				const detail = await fetchListingDetail(fetch, listingId, LISTING_API_URL);
				if (detail) void goto(listingHref(detail.category, listingId));
			})();
		}
	}

	function handleMarkAll(): void {
		markingAll = true;
		void (async () => {
			try {
				await markAllNotificationsRead();
				notifications = notifications.map((n) => ({ ...n, isRead: true }));
			} catch {
				// ignore
			} finally {
				markingAll = false;
			}
		})();
	}
</script>

<div class="mx-auto w-full max-w-4xl">
	<div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900">
				Notifications
				{#if unreadCount > 0}
					<span
						class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs leading-none font-bold text-white"
					>
						{unreadCount}
					</span>
				{/if}
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				Stay updated with your latest reservations, messages, and offers
			</p>
		</div>

		{#if unreadCount > 0}
			<button
				type="button"
				onclick={handleMarkAll}
				disabled={markingAll}
				class="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold tracking-wide text-emerald-800 uppercase shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 sm:self-auto"
			>
				<svg
					class="h-4 w-4 text-emerald-600"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
				</svg>
				Mark all as read
			</button>
		{/if}
	</div>

	<div class="mb-6 flex gap-2 border-b border-slate-200 pb-4">
		<button
			type="button"
			onclick={() => (filter = 'all')}
			class={cn(
				'rounded-xl px-4 py-2 text-sm font-semibold transition',
				filter === 'all'
					? 'bg-[#0c2614] text-white'
					: 'border border-slate-200 bg-white text-slate-600 hover:text-slate-800'
			)}
		>
			All
		</button>
		<button
			type="button"
			onclick={() => (filter = 'unread')}
			class={cn(
				'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
				filter === 'unread'
					? 'bg-[#0c2614] text-white'
					: 'border border-slate-200 bg-white text-slate-600 hover:text-slate-800'
			)}
		>
			Unread
			{#if unreadCount > 0}
				<span
					class={cn(
						'inline-block h-2 w-2 rounded-full',
						filter === 'unread' ? 'bg-white' : 'bg-rose-500'
					)}
				></span>
			{/if}
		</button>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each [1, 2, 3] as i (i)}
				<div
					class="flex animate-pulse gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
				>
					<div class="h-10 w-10 shrink-0 rounded-xl bg-slate-100"></div>
					<div class="flex-1 space-y-2">
						<div class="h-4 w-1/3 rounded bg-slate-100"></div>
						<div class="h-3 w-2/3 rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-12 text-center">
			<h3 class="text-base font-semibold text-slate-800">Failed to load notifications</h3>
			<p class="mt-1 text-sm text-slate-500">
				There was a problem loading your notifications list.
			</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if visible.length === 0}
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
						d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-bold text-slate-800">You're all caught up!</h3>
			<p class="mx-auto mt-2 max-w-sm text-sm text-slate-500">
				{filter === 'unread'
					? 'No unread notifications right now.'
					: "No notifications available. We'll alert you about bookings, messages, and account events."}
			</p>
		</div>
	{:else}
		<div class="space-y-3.5">
			{#each visible as item (item.id)}
				{@const cfg = CATEGORY_CFG[getCategory(item.type)] ?? CATEGORY_CFG.system}
				<div
					role="button"
					tabindex="0"
					onclick={() => handleClick(item)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleClick(item);
						}
					}}
					class={cn(
						'group relative flex cursor-pointer gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md',
						item.isRead
							? 'border-slate-100 bg-white'
							: 'border-emerald-200 bg-white ring-1 ring-emerald-50 hover:border-emerald-300'
					)}
				>
					{#if !item.isRead}
						<div class="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl bg-emerald-600"></div>
					{/if}

					<div
						class={cn(
							'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
							cfg.bg,
							cfg.color,
							cfg.border
						)}
					>
						<svg
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d={cfg.icon} />
						</svg>
					</div>

					<div class="min-w-0 flex-1 pr-2">
						<div class="flex items-start justify-between gap-4">
							<h4
								class={cn(
									'truncate text-sm',
									item.isRead ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'
								)}
							>
								{item.title}
							</h4>
							<span class="pt-0.5 text-xs whitespace-nowrap text-slate-400">
								{formatRelativeTime(item.createdAt)}
							</span>
						</div>
						<p class="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{item.body}</p>
					</div>

					<div
						class="flex items-center self-center text-slate-300 transition-colors group-hover:text-emerald-700"
					>
						<svg
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
