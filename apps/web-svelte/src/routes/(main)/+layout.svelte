<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { navigating } from '$app/state';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initLocation } from '$lib/stores/location.svelte';

	let { children } = $props();

	onMount(() => {
		initLocation();
	});
</script>

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
