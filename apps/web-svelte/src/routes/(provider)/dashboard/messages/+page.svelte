<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		getConversations,
		getConversationMessages,
		sendMessage,
		type Conversation,
		type ConversationMessage
	} from '$lib/account-api';
	import { formatRelativeTime, cn, getInitials } from '$lib/utils';

	let conversations = $state<Conversation[]>([]);
	let messages = $state<ConversationMessage[]>([]);
	let activeId = $state<string | null>(null);
	let loadingList = $state(true);
	let listError = $state(false);
	let composer = $state('');
	let sending = $state(false);
	let sendError = $state('');
	let feedRef: HTMLDivElement | null = $state(null);

	const active = $derived(conversations.find((c) => c.id === activeId) ?? null);

	function guestName(c: Conversation): string {
		return c.guestName || `Guest ${c.guestId?.slice(0, 6)}`;
	}

	function summary(c: Conversation): string {
		if (c.bookingReference) return `Booking #${c.bookingReference}`;
		if (c.bookingId) return `Booking ${c.bookingId.slice(0, 8).toUpperCase()}`;
		return `Listing ${c.listingId.slice(0, 8).toUpperCase()}`;
	}

	function loadList(): void {
		void (async () => {
			try {
				conversations = await getConversations();
				listError = false;
				if (!activeId && conversations.length > 0) {
					activeId = conversations[0].id;
					void loadThread(activeId);
				}
			} catch {
				listError = true;
			} finally {
				loadingList = false;
			}
		})();
	}

	async function loadThread(id: string): Promise<void> {
		try {
			messages = await getConversationMessages(id);
		} catch {
			// keep previous messages
		} finally {
			scrollToBottom();
		}
	}

	function open(id: string): void {
		activeId = id;
		void loadThread(id);
	}

	function scrollToBottom(): void {
		requestAnimationFrame(() => {
			if (feedRef) feedRef.scrollTop = feedRef.scrollHeight;
		});
	}

	async function handleSend(): Promise<void> {
		const body = composer.trim();
		if (!body || !activeId || sending) return;
		sending = true;
		sendError = '';
		try {
			const sent = await sendMessage(activeId, body);
			messages = [...messages, sent];
			composer = '';
			scrollToBottom();
		} catch {
			sendError = 'Could not send the message. Please try again.';
		} finally {
			sending = false;
		}
	}

	onMount(() => {
		loadList();
		const initial = page.url.searchParams.get('conversationId');
		if (initial) activeId = initial;
	});
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Messages</h1>
		<p class="mt-1 text-sm text-slate-500">Conversations with your guests.</p>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid lg:grid-cols-[320px_1fr]">
		<div class={cn('flex h-[65vh] flex-col border-slate-200 lg:h-[70vh] lg:border-r', activeId ? 'hidden lg:flex' : 'flex')}>
			<div class="border-b border-slate-100 p-4">
				<p class="text-sm font-bold text-slate-900">Conversations</p>
				<button
					type="button"
					onclick={loadList}
					class="mt-2 text-xs font-semibold text-[#1D8D2B] hover:underline"
				>
					Refresh
				</button>
			</div>
			<div class="flex-1 overflow-y-auto">
				{#if loadingList}
					<div class="space-y-2 p-4">
						{#each [1, 2, 3] as i (i)}
							<div class="h-12 animate-pulse rounded-xl bg-slate-100"></div>
						{/each}
					</div>
				{:else if listError}
					<div class="p-6 text-center text-sm text-red-600">Could not load conversations.</div>
				{:else if conversations.length === 0}
					<div class="p-8 text-center text-sm text-slate-400">No conversations yet.</div>
				{:else}
					<div class="p-2">
						{#each conversations as c (c.id)}
							<button
								type="button"
								onclick={() => open(c.id)}
								class={cn(
									'flex w-full items-center gap-3 rounded-xl p-3 text-left transition',
									activeId === c.id ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'
								)}
							>
								<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
									{getInitials(guestName(c))}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center justify-between gap-2">
										<p class="truncate text-sm font-semibold text-slate-800">{guestName(c)}</p>
										<span class="shrink-0 text-[10px] text-slate-400">{formatRelativeTime(c.updatedAt)}</span>
									</div>
									<p class="truncate text-xs text-slate-400">{summary(c)}</p>
									<p class="truncate text-xs text-slate-500">{c.lastMessage?.body ?? 'No messages yet'}</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class={cn('flex h-[65vh] flex-col lg:h-[70vh]', activeId ? 'flex' : 'hidden lg:flex')}>
			{#if active}
				<div class="flex items-center gap-3 border-b border-slate-100 p-4">
					<button
						type="button"
						onclick={() => (activeId = null)}
						class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 lg:hidden"
						aria-label="Back"
					>
						←
					</button>
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
						{getInitials(guestName(active))}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-bold text-slate-900">{guestName(active)}</p>
						<p class="text-xs text-slate-400">{summary(active)}</p>
					</div>
				</div>
				<div bind:this={feedRef} class="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
					{#if messages.length === 0}
						<p class="py-10 text-center text-sm text-slate-400">No messages yet.</p>
					{:else}
						{#each messages as m (m.id)}
							<div class={cn('flex', m.senderType === 'system' ? 'justify-center' : 'justify-start')}>
								{#if m.senderType === 'system'}
									<span class="rounded-full bg-amber-50 px-3 py-1 text-center text-xs font-medium text-amber-700">
										{m.body}
									</span>
								{:else}
									<div
										class={cn(
											'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
											m.senderType === 'provider'
												? 'rounded-br-sm bg-[#0c2614] text-white'
												: 'rounded-bl-sm bg-white text-slate-800'
										)}
									>
										<p class="break-words whitespace-pre-wrap">{m.body}</p>
										<p class="mt-1 text-right text-[10px] text-slate-400">
											{formatRelativeTime(m.createdAt)}
										</p>
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
				{#if active.status === 'closed'}
					<div class="border-t border-slate-100 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
						This conversation is closed.
					</div>
				{:else}
					<form
						onsubmit={(e) => {
							e.preventDefault();
							void handleSend();
						}}
						class="border-t border-slate-100 p-3"
					>
						{#if sendError}
							<p class="mb-2 text-xs text-red-600">{sendError}</p>
						{/if}
						<div class="flex items-end gap-2">
							<textarea
								bind:value={composer}
								rows="1"
								placeholder="Write a message…"
								maxlength="2000"
								class="max-h-[160px] min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-[#f6fdf8] px-4 py-2.5 text-sm focus:border-[#1D8D2B] focus:outline-none"
								onkeydown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										void handleSend();
									}
								}}
							></textarea>
							<button
								type="submit"
								disabled={!composer.trim() || sending}
								class="rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15803d] disabled:opacity-50"
							>
								{sending ? '…' : 'Send'}
							</button>
						</div>
					</form>
				{/if}
			{:else}
				<div class="flex h-full flex-col items-center justify-center p-8 text-center">
					<p class="text-sm font-semibold text-slate-600">Select a conversation</p>
					<p class="mt-1 text-sm text-slate-500">Choose a thread on the left to reply to a guest.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
