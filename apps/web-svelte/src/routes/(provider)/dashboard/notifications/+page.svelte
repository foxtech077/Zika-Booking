<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getNotifications,
		markNotificationRead,
		markAllNotificationsRead,
		type AppNotification
	} from '$lib/account-api';
	import { formatRelativeTime, cn } from '$lib/utils';

	let notifications = $state<AppNotification[]>([]);
	let loading = $state(true);
	let error = $state(false);
	let markingAll = $state(false);
	let filter = $state<'all' | 'unread'>('all');

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

	const unreadCount = $derived(notifications.filter((n) => !n.isRead).length);
	const filtered = $derived(
		notifications.filter((n) => (filter === 'unread' ? !n.isRead : true))
	);

	function handleClick(n: AppNotification): void {
		if (!n.isRead) {
			const previous = notifications;
			notifications = notifications.map((x) => (x.id === n.id ? { ...x, isRead: true } : x));
			void markNotificationRead(n.id).catch(() => {
				notifications = previous;
			});
		}
		const { bookingId, conversationId, listingId } = n.data ?? {};
		if (bookingId) void goto(`/dashboard/bookings?highlight=${bookingId}`);
		else if (conversationId) void goto(`/dashboard/messages?conversationId=${conversationId}`);
		else if (listingId) void goto(`/dashboard/bookings`);
	}

	async function handleMarkAll(): Promise<void> {
		markingAll = true;
		try {
			await markAllNotificationsRead();
			notifications = notifications.map((n) => ({ ...n, isRead: true }));
		} catch {
			// ignore
		} finally {
			markingAll = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Notifications</h1>
			<p class="mt-1 text-sm text-slate-500">
				{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
			</p>
		</div>
		<button
			type="button"
			onclick={() => void handleMarkAll()}
			disabled={markingAll || unreadCount === 0}
			class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
		>
			{markingAll ? '…' : 'Mark all as read'}
		</button>
	</div>

	<div class="flex gap-2">
		<button
			type="button"
			onclick={() => (filter = 'all')}
			class={cn(
				'rounded-full px-4 py-2 text-sm font-semibold transition',
				filter === 'all' ? 'bg-[#0c2614] text-white' : 'border border-slate-200 bg-white text-slate-600'
			)}
		>
			All
		</button>
		<button
			type="button"
			onclick={() => (filter = 'unread')}
			class={cn(
				'rounded-full px-4 py-2 text-sm font-semibold transition',
				filter === 'unread' ? 'bg-[#0c2614] text-white' : 'border border-slate-200 bg-white text-slate-600'
			)}
		>
			Unread
		</button>
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each [1, 2, 3] as i (i)}
				<div class="h-16 animate-pulse rounded-2xl border border-slate-100 bg-white"></div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
			<p class="text-sm text-red-600">Could not load notifications.</p>
			<button
				type="button"
				onclick={load}
				class="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
			>
				Try Again
			</button>
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-2xl border border-slate-100 bg-white p-12 text-center">
			<p class="text-sm text-slate-400">No notifications here.</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each filtered as n (n.id)}
				<button
					type="button"
					onclick={() => handleClick(n)}
					class={cn(
						'flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-[#1D8D2B]/40',
						n.isRead ? 'border-slate-100' : 'border-emerald-200 bg-emerald-50/40'
					)}
				>
					<span class={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-slate-200' : 'bg-[#1D8D2B]')}></span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold text-slate-800">{n.title}</p>
						<p class="mt-0.5 text-sm text-slate-500">{n.body}</p>
						<p class="mt-1 text-[11px] text-slate-400">{formatRelativeTime(n.createdAt)}</p>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
