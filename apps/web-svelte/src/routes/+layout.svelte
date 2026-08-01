<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { navigating, page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initLocation } from '$lib/stores/location.svelte';

	let { children } = $props();

	// Listing detail pages set their own SEO/OG tags, so the brand defaults
	// below would otherwise shadow them (crawlers use the first occurrence).
	const isListingDetail = $derived(/^\/listings\/[^/]+\/?$/.test(page.url.pathname));

	// Cross-fade between pages using the native View Transitions API, so the
	// whole page doesn't hard-swap on client-side navigation. Wrapped in the
	// document to keep the same element (e.g. the header) from flashing.
	onNavigate((navigation) => {
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion || !('startViewTransition' in document)) return;
		return new Promise<void>((resolve) => {
			document.startViewTransition(() => {
				resolve();
				return navigation.complete;
			});
		});
	});

	onMount(() => {
		initLocation();
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

<Header />
{#if browser && navigating.to !== null}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-[#1D8D2B]/15"
		aria-hidden="true"
	>
		<div
			class="h-full w-1/3 rounded-full bg-[#1D8D2B]"
			style="animation: progress-slide 1s ease-in-out infinite"
		></div>
	</div>
{/if}
<main class="min-h-screen bg-[#F8FAFC] text-slate-800">{@render children()}</main>
<Footer />
