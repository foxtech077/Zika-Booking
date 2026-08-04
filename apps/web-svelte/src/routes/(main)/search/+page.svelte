<script lang="ts">
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import ListingsPage from '$lib/components/ListingsPage.svelte';
	import { CATEGORY_META } from '$lib/listing-meta';

	let { data }: PageProps = $props();
	const searchParams = $derived(page.url.searchParams);
	const title = $derived(CATEGORY_META[data.category].title);
</script>

<svelte:head>
	<title>{title} | Kainook</title>
</svelte:head>

<ListingsPage category={data.category} initial={data} seedParams={searchParams} />
