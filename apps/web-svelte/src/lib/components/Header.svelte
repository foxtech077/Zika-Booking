<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth, clearSession } from '$lib/stores/auth.svelte';
	import { logout } from '$lib/auth-api';
	import { getUnreadNotificationCount, getUnreadConversationCount } from '$lib/account-api';
	import Avatar from './Avatar.svelte';
	import CountrySelector from './CountrySelector.svelte';
	import { cn } from '$lib/utils';

	const ROUTES = {
		destinations: '/',
		hotels: '/hotels',
		apartments: '/apartments',
		cars: '/cars',
		bookings: '/bookings',
		wishlist: '/wishlist',
		messages: '/messages',
		reviews: '/reviews',
		profile: '/profile',
		faq: '/faq'
	} as const;

	let menuOpen = $state(false);
	let mobileMenuOpen = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);

	let unreadNotifications = $state(0);
	let unreadMessages = $state(0);
	let notifTimer: ReturnType<typeof setInterval> | null = null;
	let msgTimer: ReturnType<typeof setInterval> | null = null;

	const pathname = $derived(String(page.url.pathname));
	const searchParams = $derived(page.url.searchParams);
	const searchSignature = $derived(searchParams.toString());

	// Host status is now a normal profile field from the auth service REST
	// body (publicUser), so the header reads it from the user object — no JWT
	// decode needed.
	const hostStatus = $derived(auth.user?.hostStatus ?? null);
	const hostLabel = $derived(
		hostStatus === 'approved'
			? 'Manage Hosting'
			: hostStatus === 'pending'
				? 'Host application pending'
				: hostStatus === 'rejected'
					? 'Reapply to host'
					: 'Become a Host'
	);

	function refreshUnread(): void {
		void (async () => {
			try {
				unreadNotifications = await getUnreadNotificationCount();
			} catch {
				// non-fatal — keep the previous badge
			}
			try {
				unreadMessages = await getUnreadConversationCount();
			} catch {
				// non-fatal
			}
		})();
	}

	onMount(() => {
		if (!auth.isAuthenticated) return;
		refreshUnread();
		notifTimer = setInterval(refreshUnread, 30_000);
		msgTimer = setInterval(refreshUnread, 30_000);
		return () => {
			if (notifTimer) clearInterval(notifTimer);
			if (msgTimer) clearInterval(msgTimer);
		};
	});

	const isDestinationsActive = $derived(pathname === '/' && searchParams.get('tab') !== 'bookings');
	const isHotelsActive = $derived(pathname === ROUTES.hotels);
	const isApartmentsActive = $derived(pathname === ROUTES.apartments);
	const isCarsActive = $derived(pathname === ROUTES.cars);
	const isBookingsActive = $derived(pathname.startsWith(ROUTES.bookings));
	const isMessagesActive = $derived(pathname.startsWith(ROUTES.messages));
	const isReviewsActive = $derived(pathname.startsWith(ROUTES.reviews));
	const isWishlistActive = $derived(pathname.startsWith(ROUTES.wishlist));
	const isProfileActive = $derived(pathname.startsWith(ROUTES.profile));
	const isNotificationsActive = $derived(pathname.startsWith('/notifications'));

	const fullName = $derived(
		auth.user ? [auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ') : 'Traveller'
	);
	const email = $derived(auth.user?.email ?? '');

	// Close the avatar dropdown when clicking outside it.
	$effect(() => {
		if (!menuOpen) return;
		function onOutside(e: MouseEvent) {
			if (dropdownRef && !dropdownRef.contains(e.target as Node)) menuOpen = false;
		}
		document.addEventListener('mousedown', onOutside);
		return () => document.removeEventListener('mousedown', onOutside);
	});

	// Close the mobile menu on route change.
	$effect(() => {
		if (page.url.pathname || searchSignature) mobileMenuOpen = false;
	});

	function handleLogout() {
		menuOpen = false;
		void logout().finally(() => {
			clearSession();
			goto('/');
		});
	}
</script>

{#snippet navBtn(label: string, href: string, isActive: boolean)}
	<a
		{href}
		aria-current={isActive ? 'page' : undefined}
		class={cn(
			'text-sm font-medium tracking-wide transition-colors',
			isActive ? 'font-semibold text-[#0c2614]' : 'text-slate-500 hover:text-[#0c2614]'
		)}
	>
		{label}
	</a>
{/snippet}

{#snippet mobileNavBtn(label: string, href: string, isActive: boolean)}
	<a
		{href}
		aria-current={isActive ? 'page' : undefined}
		class={cn(
			'flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all',
			isActive
				? 'border-[#0c2614] bg-[#0c2614] text-white'
				: 'border-slate-200 bg-white text-slate-700 hover:border-[#1D8D2B] hover:text-[#0c2614]'
		)}
	>
		{label}
	</a>
{/snippet}

<header
	class="sticky top-0 z-40 border-b border-slate-100 bg-white/95 shadow-[0_1px_4px_rgba(0,0,0,0.04)] backdrop-blur-md"
>
	<div class="flex flex-col">
		<div class="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
			<!-- Left: logo + content nav -->
			<div class="flex items-center gap-4 sm:gap-10">
				<a
					href={ROUTES.destinations}
					class="shrink-0 font-serif text-xl font-bold tracking-tight text-[#0c2614]"
				>
					Kainook
				</a>

				<nav class="hidden items-center gap-8 md:flex">
					{@render navBtn('Destinations', ROUTES.destinations, isDestinationsActive)}
					{@render navBtn('Hotels', ROUTES.hotels, isHotelsActive)}
					{@render navBtn('Home', ROUTES.apartments, isApartmentsActive)}
					{@render navBtn('Car Rentals', ROUTES.cars, isCarsActive)}
				</nav>
			</div>

			<!-- Right: country selector + workspace links + avatar dropdown -->
			<div class="flex items-center gap-3">
				<CountrySelector />
				<button
					type="button"
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					class="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition hover:bg-slate-50 md:hidden"
					aria-label="Open menu"
					aria-expanded={mobileMenuOpen}
				>
					<svg
						class="h-5 w-5 text-slate-700"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>

				<!-- Unauthenticated -->
				{#if !auth.user && !auth.isAuthenticated}
					<a
						href="/auth/login"
						class="hidden text-sm font-medium text-slate-500 transition hover:text-[#0c2614] sm:block"
					>
						Sign In
					</a>
					<a
						href="/auth/login"
						class="rounded-full bg-[#0c2614] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d]"
					>
						Sign Up
					</a>
				{/if}

				<!-- Authenticated -->
				{#if auth.user}
					<a
						href="/notifications"
						aria-label="Open notifications"
						class="relative mr-1 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-all hover:bg-slate-50"
					>
						<svg
							class="h-[18px] w-[18px]"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
							/>
						</svg>
						{#if unreadNotifications > 0}
							<span
								class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white"
							>
								{unreadNotifications > 9 ? '9+' : unreadNotifications}
							</span>
						{/if}
					</a>

					<!-- Avatar dropdown -->
					<div class="relative" bind:this={dropdownRef}>
						<button
							type="button"
							onclick={() => (menuOpen = !menuOpen)}
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							class={cn(
								'flex items-center gap-2 rounded-2xl border px-2 py-1.5 font-semibold transition-all duration-150 focus:ring-2 focus:ring-green-500/30 focus:outline-none',
								menuOpen || isProfileActive
									? 'border-[#0c2614] bg-[#0c2614] text-white shadow-sm'
									: 'border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]'
							)}
						>
							<Avatar name={fullName} size="sm" />
							<div class="hidden text-left sm:block">
								<p
									class={cn(
										'max-w-[100px] truncate text-xs leading-none font-semibold',
										menuOpen || isProfileActive ? 'text-white' : 'text-slate-800'
									)}
								>
									{fullName}
								</p>
								<p
									class={cn(
										'mt-0.5 max-w-[100px] truncate text-[10px]',
										menuOpen || isProfileActive ? 'text-green-200/80' : 'text-slate-400'
									)}
								>
									{email}
								</p>
							</div>
							<svg
								class={cn(
									'h-3.5 w-3.5 transition-transform',
									menuOpen ? 'rotate-180' : '',
									menuOpen || isProfileActive ? 'text-white/70' : 'text-slate-400'
								)}
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{#if menuOpen}
							<div
								class="absolute top-full right-0 z-50 mt-2 w-52 animate-slide-in-up rounded-2xl border border-slate-100 bg-white py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
							>
								<div class="mb-1 border-b border-slate-100 px-4 py-2.5">
									<p class="truncate text-sm font-semibold text-slate-800">{fullName}</p>
									<p class="mt-0.5 truncate text-xs text-slate-400">{email}</p>
								</div>

								<a
									href={ROUTES.profile}
									onclick={() => (menuOpen = false)}
									class={cn(
										'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all',
										isProfileActive
											? 'bg-slate-50 text-slate-900'
											: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
									)}
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
										/>
									</svg>
									Profile
								</a>

								<a
									href="/host"
									onclick={() => (menuOpen = false)}
									class="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z"
										/>
									</svg>
									{hostLabel}
								</a>

								<div class="my-1 border-t border-slate-100"></div>

								<a
									href={ROUTES.bookings}
									onclick={() => (menuOpen = false)}
									class={cn(
										'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all',
										isBookingsActive
											? 'bg-slate-50 text-slate-900'
											: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
									)}
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									My Reservations
								</a>

								<a
									href={ROUTES.messages}
									onclick={() => (menuOpen = false)}
									class={cn(
										'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all',
										isMessagesActive
											? 'bg-slate-50 text-slate-900'
											: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
									)}
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
										/>
									</svg>
									<span class="flex-1">Messages</span>
									{#if unreadMessages > 0}
										<span
											class="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white"
										>
											{unreadMessages > 9 ? '9+' : unreadMessages}
										</span>
									{/if}
								</a>

								<a
									href="/notifications"
									onclick={() => (menuOpen = false)}
									class={cn(
										'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all',
										isNotificationsActive
											? 'bg-slate-50 text-slate-900'
											: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
									)}
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
										/>
									</svg>
									<span class="flex-1">Notifications</span>
								</a>

								<a
									href={ROUTES.wishlist}
									onclick={() => (menuOpen = false)}
									class={cn(
										'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all',
										isWishlistActive
											? 'bg-slate-50 text-slate-900'
											: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
									)}
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
										/>
									</svg>
									Wishlist
								</a>

								<a
									href={ROUTES.reviews}
									onclick={() => (menuOpen = false)}
									class={cn(
										'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all',
										isReviewsActive
											? 'bg-slate-50 text-slate-900'
											: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
									)}
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
										/>
									</svg>
									My Reviews
								</a>

								<a
									href={ROUTES.faq}
									onclick={() => (menuOpen = false)}
									class="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
										/>
									</svg>
									Help &amp; FAQ
								</a>

								<a
									href="/legal/privacy"
									target="_blank"
									rel="noopener noreferrer"
									onclick={() => (menuOpen = false)}
									class="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
										/>
									</svg>
									Privacy Policy
								</a>

								<a
									href="/legal/terms"
									target="_blank"
									rel="noopener noreferrer"
									onclick={() => (menuOpen = false)}
									class="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
								>
									<svg
										class="h-4 w-4 text-green-600"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
										/>
									</svg>
									Terms &amp; Conditions
								</a>

								<div class="my-1 border-t border-slate-100"></div>
								<button
									type="button"
									onclick={handleLogout}
									class="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition-all hover:bg-red-50"
								>
									<svg
										class="h-4 w-4"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
										/>
									</svg>
									Sign Out
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		{#if mobileMenuOpen}
			<div class="border-t border-slate-100 bg-white px-4 py-4 sm:px-6 md:hidden lg:px-8">
				<div class="space-y-4">
					<div class="grid gap-2">
						{@render mobileNavBtn('Destinations', ROUTES.destinations, isDestinationsActive)}
						{@render mobileNavBtn('Hotels', ROUTES.hotels, isHotelsActive)}
						{@render mobileNavBtn('Home', ROUTES.apartments, isApartmentsActive)}
						{@render mobileNavBtn('Car Rentals', ROUTES.cars, isCarsActive)}
						{#if auth.user}
							{@render mobileNavBtn('My Reservations', ROUTES.bookings, isBookingsActive)}
						{/if}
					</div>

					{#if auth.user}
						<div class="grid gap-2">
							<a
								href={ROUTES.messages}
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#1D8D2B] hover:text-[#0c2614]"
							>
								<span>Messages</span>
								<svg
									class="h-4 w-4 text-slate-400"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
									/>
								</svg>
							</a>
							{@render mobileNavBtn('Wishlist', ROUTES.wishlist, isWishlistActive)}
							{@render mobileNavBtn('My Reviews', ROUTES.reviews, isReviewsActive)}
							{@render mobileNavBtn('Profile', ROUTES.profile, isProfileActive)}
							<a
								href="/host"
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#1D8D2B] hover:text-[#0c2614]"
							>
								<span>{hostLabel}</span>
							</a>
							<button
								type="button"
								onclick={handleLogout}
								class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-100"
							>
								Sign Out
							</button>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-2">
							<a
								href="/auth/login"
								onclick={() => (mobileMenuOpen = false)}
								class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-[#1D8D2B] hover:text-[#0c2614]"
							>
								Sign In
							</a>
							<a
								href="/auth/login"
								onclick={() => (mobileMenuOpen = false)}
								class="rounded-xl bg-[#0c2614] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#081b0d]"
							>
								Sign Up
							</a>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</header>
