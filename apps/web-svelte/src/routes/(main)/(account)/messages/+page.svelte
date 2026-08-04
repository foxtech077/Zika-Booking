<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import {
		getConversations,
		getConversationMessages,
		sendMessage,
		getUnreadConversationCount,
		type Conversation,
		type ConversationMessage
	} from '$lib/account-api';
	import { formatRelativeTime, cn, getInitials } from '$lib/utils';

	let conversations = $state<Conversation[]>([]);
	let messages = $state<ConversationMessage[]>([]);
	let activeId = $state<string | null>(null);
	let unreadCount = $state(0);
	let loadingList = $state(true);
	let loadingThread = $state(false);
	let listError = $state(false);
	let threadError = $state(false);
	let search = $state('');
	let composer = $state('');
	let sending = $state(false);

	let listTimer: ReturnType<typeof setInterval> | null = null;
	let threadTimer: ReturnType<typeof setInterval> | null = null;
	let unreadTimer: ReturnType<typeof setInterval> | null = null;
	let feedRef: HTMLDivElement | null = $state(null);

	const activeConversation = $derived(conversations.find((c) => c.id === activeId) ?? null);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return conversations;
		return conversations.filter(
			(c) =>
				c.id.toLowerCase().includes(q) ||
				(c.listingId ?? '').toLowerCase().includes(q) ||
				(c.bookingId ?? '').toLowerCase().includes(q) ||
				(c.status ?? '').toLowerCase().includes(q) ||
				(c.lastMessage?.body ?? '').toLowerCase().includes(q)
		);
	});

	function refreshConversations(): void {
		void (async () => {
			try {
				conversations = await getConversations();
				listError = false;
			} catch {
				listError = true;
			} finally {
				loadingList = false;
			}
		})();
	}

	function refreshUnread(): void {
		void (async () => {
			try {
				unreadCount = await getUnreadConversationCount();
			} catch {
				// non-fatal
			}
		})();
	}

	function openConversation(id: string): void {
		activeId = id;
		void goto(`/messages?conversationId=${id}`, { replaceState: true });
		void refreshThread(id);
	}

	function refreshThread(id: string): void {
		threadError = false;
		loadingThread = true;
		void (async () => {
			try {
				messages = await getConversationMessages(id);
			} catch {
				threadError = true;
			} finally {
				loadingThread = false;
				scrollToBottom();
			}
		})();
	}

	function scrollToBottom(): void {
		requestAnimationFrame(() => {
			if (feedRef) feedRef.scrollTop = feedRef.scrollHeight;
		});
	}

	function handleSend(): void {
		const body = composer.trim();
		if (!body || !activeId || sending) return;
		sending = true;
		void (async () => {
			try {
				const sent = await sendMessage(activeId, body);
				messages = [...messages, sent];
				conversations = conversations.map((c) =>
					c.id === activeId
						? {
								...c,
								lastMessage: {
									body: sent.body,
									senderId: sent.senderId,
									senderType: sent.senderType,
									createdAt: sent.createdAt
								}
							}
						: c
				);
				composer = '';
				scrollToBottom();
			} catch {
				// keep composer text so the user can retry
			} finally {
				sending = false;
			}
		})();
	}

	onMount(() => {
		refreshConversations();
		refreshUnread();

		const initial = page.url.searchParams.get('conversationId');
		if (initial) activeId = initial;

		listTimer = setInterval(refreshConversations, 20_000);
		unreadTimer = setInterval(refreshUnread, 30_000);

		return () => {
			if (listTimer) clearInterval(listTimer);
			if (threadTimer) clearInterval(threadTimer);
			if (unreadTimer) clearInterval(unreadTimer);
		};
	});

	// Poll the active thread.
	$effect(() => {
		if (!activeId) return;
		if (threadTimer) clearInterval(threadTimer);
		threadTimer = setInterval(() => {
			const id = activeId;
			if (id) void refreshThread(id);
		}, 12_000);
		return () => {
			if (threadTimer) clearInterval(threadTimer);
			threadTimer = null;
		};
	});

	const otherName = $derived((c: Conversation) => {
		if (auth.user && c.providerId === auth.user.id)
			return c.guestName || `Guest ${c.guestId?.slice(0, 6)}`;
		return c.providerName || `Provider ${c.providerId?.slice(0, 6)}`;
	});

	const summary = $derived((c: Conversation) => {
		if (c.bookingReference) return `Booking #${c.bookingReference}`;
		if (c.bookingId) return `Booking ${c.bookingId.slice(0, 8).toUpperCase()}`;
		return `Listing ${c.listingId.slice(0, 8).toUpperCase()}`;
	});

	const isClosed = $derived(activeConversation?.status === 'closed');
	const isMe = $derived((m: ConversationMessage) => m.senderId === auth.user?.id);
</script>

<div
	class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:grid-cols-[360px_1fr]"
>
	<!-- Left pane: conversation list -->
	<div
		class={cn(
			'flex h-[70vh] flex-col border-slate-200 lg:h-[75vh] lg:border-r',
			activeId ? 'hidden lg:flex' : 'flex'
		)}
	>
		<div class="border-b border-slate-100 p-4">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-bold text-slate-900">Conversations</h2>
				<span class="text-xs text-slate-500">
					{conversations.length} total ·
					<span class="font-semibold text-[#1D8D2B]">{unreadCount} unread</span>
				</span>
			</div>
			<input
				type="text"
				bind:value={search}
				placeholder="Search conversations…"
				class="mt-3 w-full rounded-xl border border-slate-200 bg-[#f6fdf8] px-3 py-2 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
			/>
		</div>

		<div class="flex-1 overflow-y-auto">
			{#if loadingList}
				<div class="space-y-2 p-4">
					{#each [1, 2, 3] as i (i)}
						<div class="flex animate-pulse gap-3 rounded-xl p-3">
							<div class="h-10 w-10 rounded-full bg-slate-100"></div>
							<div class="flex-1 space-y-2">
								<div class="h-3 w-1/2 rounded bg-slate-100"></div>
								<div class="h-3 w-3/4 rounded bg-slate-100"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if listError}
				<div class="p-6 text-center">
					<p class="text-sm text-red-600">Unable to load conversations.</p>
					<button
						type="button"
						onclick={refreshConversations}
						class="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Retry
					</button>
				</div>
			{:else if filtered.length === 0}
				<div class="p-8 text-center">
					<p class="text-sm text-slate-500">No conversations yet.</p>
				</div>
			{:else}
				<div class="p-2">
					{#each filtered as c (c.id)}
						<button
							type="button"
							onclick={() => openConversation(c.id)}
							class={cn(
								'flex w-full items-center gap-3 rounded-xl p-3 text-left transition',
								activeId === c.id ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'
							)}
						>
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white"
							>
								{getInitials(otherName(c))}
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<p class="truncate text-sm font-semibold text-slate-800">{otherName(c)}</p>
									<span class="shrink-0 text-[10px] text-slate-400">
										{formatRelativeTime(c.updatedAt)}
									</span>
								</div>
								<p class="text-xs text-slate-400">{summary(c)}</p>
								<p class="mt-0.5 truncate text-xs text-slate-500">
									{c.lastMessage?.body ?? 'No messages yet'}
								</p>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right pane: thread -->
	<div class={cn('flex h-[70vh] flex-col lg:h-[75vh]', activeId ? 'flex' : 'hidden lg:flex')}>
		{#if activeConversation}
			<div class="flex items-center gap-3 border-b border-slate-100 p-4">
				<button
					type="button"
					onclick={() => {
						activeId = null;
						void goto('/messages', { replaceState: true });
					}}
					class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 lg:hidden"
					aria-label="Back to conversations"
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
				</button>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white"
				>
					{getInitials(otherName(activeConversation))}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-bold text-slate-900">{otherName(activeConversation)}</p>
					<p class="text-xs text-slate-400">{summary(activeConversation)}</p>
				</div>
				<button
					type="button"
					onclick={() => refreshThread(activeId!)}
					class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Refresh
				</button>
			</div>

			<div bind:this={feedRef} class="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
				{#if loadingThread && messages.length === 0}
					<div class="flex h-full items-center justify-center">
						<span
							class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#1D8D2B]"
						></span>
					</div>
				{:else if threadError}
					<div class="flex h-full flex-col items-center justify-center text-center">
						<p class="text-sm text-red-600">Unable to load messages.</p>
						<button
							type="button"
							onclick={() => refreshThread(activeId!)}
							class="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
						>
							Retry
						</button>
					</div>
				{:else if messages.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-slate-400">No messages yet. Say hello!</p>
					</div>
				{:else}
					{#each messages as m (m.id)}
						{#if isMe(m)}
							<div class="flex justify-end">
								<div
									class="max-w-[75%] rounded-2xl rounded-br-sm bg-[#0c2614] px-4 py-2.5 text-sm text-white shadow-sm"
								>
									<p class="break-words whitespace-pre-wrap">{m.body}</p>
									<p class="mt-1 text-right text-[10px] text-white/50">
										{formatRelativeTime(m.createdAt)}
									</p>
								</div>
							</div>
						{:else if m.senderType === 'system'}
							<div class="flex justify-center">
								<span
									class="rounded-full bg-amber-50 px-3 py-1 text-center text-xs font-medium text-amber-700"
								>
									{m.body}
								</span>
							</div>
						{:else}
							<div class="flex justify-start">
								<div
									class="max-w-[75%] rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm"
								>
									{#if m.isFiltered}
										<span
											class="mr-1.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
										>
											Filtered
										</span>
									{/if}
									<p class="break-words whitespace-pre-wrap">{m.body}</p>
									<p class="mt-1 text-right text-[10px] text-slate-400">
										{formatRelativeTime(m.createdAt)}
									</p>
								</div>
							</div>
						{/if}
					{/each}
				{/if}
			</div>

			{#if isClosed}
				<div
					class="border-t border-slate-100 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700"
				>
					This conversation is closed — replies are disabled.
				</div>
			{:else}
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSend();
					}}
					class="border-t border-slate-100 p-3"
				>
					<div class="flex items-end gap-2">
						<textarea
							bind:value={composer}
							rows="1"
							placeholder="Write a message…"
							maxlength="2000"
							class="max-h-[200px] min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm transition focus:border-[#1D8D2B] focus:ring-2 focus:ring-[#1D8D2B]/25 focus:outline-none"
							onkeydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSend();
								}
							}}></textarea>
						<button
							type="submit"
							disabled={!composer.trim() || sending}
							class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{#if sending}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
								></span>
							{:else}
								Send
							{/if}
						</button>
					</div>
					<p class="mt-1 text-right text-[10px] text-slate-400">{composer.length}/2000</p>
				</form>
			{/if}
		{:else}
			<div class="flex h-full flex-col items-center justify-center p-8 text-center">
				<div
					class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
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
							d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
						/>
					</svg>
				</div>
				<p class="text-sm font-semibold text-slate-600">Select a conversation</p>
				<p class="mt-1 max-w-xs text-sm text-slate-500">
					Choose a thread on the left to view and reply to messages.
				</p>
			</div>
		{/if}
	</div>
</div>
