<script lang="ts">
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import ListingsPage from '$lib/components/ListingsPage.svelte';

	let { data }: PageProps = $props();
	const searchParams = $derived(page.url.searchParams);
</script>

<svelte:head>
	<title>Car Rentals | Kainook</title>
</svelte:head>

<ListingsPage category="car" initial={data} seedParams={searchParams} />
