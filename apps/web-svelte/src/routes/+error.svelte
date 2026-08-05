<script lang="ts">
	import { page } from '$app/state';

	const { error } = $props<{ error: { status?: number; message?: string } }>();
	const status = $derived(error?.status ?? page.status ?? 404);
	const message = $derived(
		(error?.message && error.message !== 'Not found' ? error.message : null) ??
			(status === 404 ? "We couldn't find that page." : 'Something went wrong on our end.')
	);
</script>

<svelte:head>
	<title>{status === 404 ? 'Page not found — Kainook' : `Error ${status} — Kainook`}</title>
</svelte:head>

<div class="mx-auto w-full max-w-xl px-4 py-24 text-center sm:px-6">
	<div
		class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-red-100 bg-red-50 text-red-500"
	>
		{#if status === 404}
			<svg
				class="h-10 w-10"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15.75 15.75L18.75 18.75M3.75 3.75L8.25 8.25M8.25 8.25A5.25 5.25 0 018.25 2.25M8.25 8.25l3.5-3.5m3 6a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		{:else}
			<svg
				class="h-10 w-10"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
		{/if}
	</div>
	<h1 class="mt-6 font-serif text-4xl font-bold text-slate-900">
		{status === 404 ? 'Page not found' : `Something went wrong (${status})`}
	</h1>
	<p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
	<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
		<a
			href="/"
			class="rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d]"
		>
			Go to Home
		</a>
		<button
			type="button"
			onclick={() => history.back()}
			class="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
		>
			Go back
		</button>
	</div>
</div>
