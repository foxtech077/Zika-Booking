<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initLocation } from '$lib/stores/location.svelte';

	let { children } = $props();

	// Listing detail pages set their own SEO/OG tags, so the brand defaults
	// below would otherwise shadow them (crawlers use the first occurrence).
	const isListingDetail = $derived(/^\/listings\/[^/]+\/?$/.test(page.url.pathname));

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
<main class="min-h-screen bg-[#F8FAFC] text-slate-800">{@render children()}</main>
<Footer />
