<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { applyFontScale } from '$lib/font-scale.svelte';

	let { children } = $props();

	// Scale the root font for Windows users (low-DPI desktop displays).
	onMount(() => {
		applyFontScale();
	});

	// Listing detail pages set their own SEO/OG tags, so the brand defaults
	// below would otherwise shadow them (crawlers use the first occurrence).
	const isListingDetail = $derived(/^\/listings\/[^/]+\/?$/.test(page.url.pathname));

	// Account pages share a single layout with an in-page tab bar. Switching
	// tabs is a same-shell navigation, so a full-document cross-fade is
	// distracting — the account layout fades only its content instead.
	const ACCOUNT_PREFIXES = [
		'/bookings',
		'/messages',
		'/wishlist',
		'/reviews',
		'/profile',
		'/notifications'
	];
	function isAccountPath(path: string): boolean {
		return ACCOUNT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
	}

	// Cross-fade between pages using the native View Transitions API, so the
	// whole page doesn't hard-swap on client-side navigation. Wrapped in the
	// document to keep the same element (e.g. the header) from flashing.
	onNavigate((navigation) => {
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion || !('startViewTransition' in document)) return;
		const from = navigation.from?.url.pathname ?? '';
		const to = navigation.to?.url.pathname ?? '';
		if (isAccountPath(from) && isAccountPath(to)) return;
		return new Promise<void>((resolve) => {
			document.startViewTransition(() => {
				resolve();
				return navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href="/kainook-logo.jpeg" />
	<title>Kainook — Book Hotels, Apartments & Car Rentals Worldwide</title>
	{#if !isListingDetail}
		<meta
			name="description"
			content="Book hotels, apartments, and car rentals worldwide. Browse exclusive properties, find the perfect stay, and reserve without an account."
		/>
		<meta property="og:title" content="Kainook — Book Hotels, Apartments & Car Rentals Worldwide" />
		<meta
			property="og:description"
			content="Book hotels, apartments, and car rentals worldwide. Browse exclusive properties, find the perfect stay, and reserve without an account."
		/>
		<meta property="og:image" content="/kainook-logo.jpeg" />
		<meta name="twitter:card" content="summary" />
		<meta
			name="twitter:title"
			content="Kainook — Book Hotels, Apartments & Car Rentals Worldwide"
		/>
		<meta
			name="twitter:description"
			content="Book hotels, apartments, and car rentals worldwide. Browse exclusive properties, find the perfect stay, and reserve without an account."
		/>
		<meta name="twitter:image" content="/kainook-logo.jpeg" />
	{/if}
	<meta property="og:site_name" content="Kainook" />
	<meta property="og:type" content="website" />
</svelte:head>

{@render children()}
