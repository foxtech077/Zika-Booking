<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { auth } from '$lib/stores/auth.svelte';

	let { children } = $props();

	const pathname = $derived(String(page.url.pathname));

	// The reservations list (/bookings) is also reachable by anonymous visitors:
	// their stable per-device anonymous token returns the bookings made on this
	// device. Every other account page requires a signed-in user.
	const isPublicBookings = $derived(pathname === '/bookings');

	// Account pages require a signed-in user. Redirect (with a next param) so
	// the user lands back where they were after signing in.
	$effect(() => {
		if (!auth.isAuthenticated && !isPublicBookings) {
			void goto(`/auth/login?next=${encodeURIComponent(pathname)}`);
		}
	});

	const navItems = $derived([
		{
			label: 'Reservations',
			href: '/bookings',
			active: pathname === '/bookings' || pathname.startsWith('/bookings/')
		},
		{ label: 'Messages', href: '/messages', active: pathname.startsWith('/messages') },
		{ label: 'Wishlist', href: '/wishlist', active: pathname.startsWith('/wishlist') },
		{ label: 'Reviews', href: '/reviews', active: pathname.startsWith('/reviews') },
		{ label: 'Profile', href: '/profile', active: pathname.startsWith('/profile') }
	]);

	const visibleNavItems = $derived(
		auth.isAuthenticated ? navItems : navItems.filter((i) => i.href === '/bookings')
	);
</script>

{#if auth.isAuthenticated || isPublicBookings}
	<div class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<nav class="mb-8 flex flex-wrap items-center gap-2">
			{#each visibleNavItems as item (item.href)}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					class={`rounded-full px-4 py-2 text-sm font-semibold transition ${
						item.active
							? 'bg-[#0c2614] text-white'
							: 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
					}`}
				>
					{item.label}
				</a>
			{/each}
		</nav>
		{#key pathname}
			<div in:fade={{ duration: 140 }}>{@render children()}</div>
		{/key}
	</div>
{:else}
	<div class="mx-auto max-w-md px-4 py-24 text-center">
		<div
			class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600"
		>
			<svg class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
		</div>
		<h1 class="text-2xl font-bold text-slate-800">Access Denied</h1>
		<p class="mt-2 text-slate-500">Please sign in to view this page.</p>
		<a
			href="/auth/login"
			class="mt-6 inline-block rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d]"
		>
			Sign In
		</a>
	</div>
{/if}
