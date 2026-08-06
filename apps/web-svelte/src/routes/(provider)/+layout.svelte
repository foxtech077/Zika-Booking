<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth, clearSession } from '$lib/stores/auth.svelte';
	import { logout } from '$lib/auth-api';
	import { cn } from '$lib/utils';

	let { children } = $props();

	const pathname = $derived(String(page.url.pathname));

	// Provider dashboard requires a signed-in account. Any user can host now,
	// so the guard is simply authentication.
	$effect(() => {
		if (!auth.isAuthenticated) {
			void goto(`/auth/login?next=${encodeURIComponent(pathname)}`);
		}
	});

	const NAV = $derived([
		{ href: '/dashboard', label: 'Dashboard', active: pathname === '/dashboard' || pathname === '/dashboard/' },
		{ href: '/dashboard/listings', label: 'Listings', active: pathname.startsWith('/dashboard/listings') },
		{ href: '/dashboard/bookings', label: 'Bookings', active: pathname.startsWith('/dashboard/bookings') },
		{ href: '/dashboard/earnings', label: 'Earnings', active: pathname.startsWith('/dashboard/earnings') },
		{ href: '/dashboard/payments', label: 'Payments', active: pathname.startsWith('/dashboard/payments') },
		{ href: '/dashboard/reviews', label: 'Reviews', active: pathname.startsWith('/dashboard/reviews') },
		{ href: '/dashboard/messages', label: 'Messages', active: pathname.startsWith('/dashboard/messages') },
		{ href: '/dashboard/notifications', label: 'Notifications', active: pathname.startsWith('/dashboard/notifications') },
		{ href: '/dashboard/settings', label: 'Settings', active: pathname.startsWith('/dashboard/settings') }
	]);

	function handleLogout(): void {
		void logout().finally(() => {
			clearSession();
			goto('/');
		});
	}
</script>

{#if auth.isAuthenticated}
	<div class="min-h-screen bg-[#F8FAFC]">
		<header
			class="sticky top-0 z-40 border-b border-slate-100 bg-white/95 shadow-[0_1px_4px_rgba(0,0,0,0.04)] backdrop-blur-md"
		>
			<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
				<div class="flex items-center gap-3">
					<a href="/dashboard" class="text-lg font-serif font-bold tracking-tight text-[#0c2614]">
						Kainook Host
					</a>
					<a href="/" class="text-xs font-semibold text-slate-400 transition hover:text-[#0c2614]">
						← Back to site
					</a>
				</div>
				<button
					type="button"
					onclick={handleLogout}
					class="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Sign out
				</button>
			</div>
		</header>

		<div class="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
			<aside class="hidden w-52 shrink-0 lg:block">
				<nav class="sticky top-24 space-y-1">
					{#each NAV as item (item.href)}
						<a
							href={item.href}
							class={cn(
								'block rounded-xl px-4 py-2.5 text-sm font-semibold transition',
								item.active
									? 'bg-[#0c2614] text-white'
									: 'text-slate-600 hover:bg-white hover:text-[#0c2614]'
							)}
						>
							{item.label}
						</a>
					{/each}
				</nav>
			</aside>

			<div class="min-w-0 flex-1">
				<nav class="mb-6 flex flex-wrap gap-2 lg:hidden">
					{#each NAV as item (item.href)}
						<a
							href={item.href}
							class={cn(
								'rounded-full px-4 py-2 text-xs font-semibold transition',
								item.active
									? 'bg-[#0c2614] text-white'
									: 'border border-slate-200 bg-white text-slate-600'
							)}
						>
							{item.label}
						</a>
					{/each}
				</nav>
				{@render children()}
			</div>
		</div>
	</div>
{/if}
