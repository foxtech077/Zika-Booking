<script lang="ts">
	import { goto } from '$app/navigation';
	import { createListing } from '$lib/provider-api';

	const CATEGORIES = [
		{ key: 'hotel' as const, label: 'Hotel', icon: '🏨', desc: 'Rooms with nightly pricing and room types.' },
		{ key: 'apartment' as const, label: 'Home', icon: '🏠', desc: 'Apartment or residence, nightly pricing.' },
		{ key: 'car' as const, label: 'Car Rental', icon: '🚗', desc: 'Vehicles with daily pricing.' }
	];

	let creating = $state<'hotel' | 'apartment' | 'car' | null>(null);
	let error = $state('');

	async function handleCreate(category: 'hotel' | 'apartment' | 'car'): Promise<void> {
		creating = category;
		error = '';
		try {
			const res = await createListing(category);
			await goto(`/dashboard/listings/${res.id}/edit`);
		} catch {
			error = 'Could not create the listing. Please try again.';
			creating = null;
		}
	}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Create a listing</h1>
		<p class="mt-1 text-sm text-slate-500">Choose the type of listing you want to add. You'll fill in the details next.</p>
	</div>

	{#if error}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
	{/if}

	<div class="grid gap-4">
		{#each CATEGORIES as c (c.key)}
			<button
				type="button"
				onclick={() => void handleCreate(c.key)}
				disabled={creating !== null}
				class="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#1D8D2B]/50 hover:shadow-md disabled:opacity-60"
			>
				<span class="text-3xl">{c.icon}</span>
				<div>
					<p class="font-bold text-slate-900">{c.label}</p>
					<p class="mt-0.5 text-sm text-slate-500">{c.desc}</p>
				</div>
				<span class="ml-auto text-sm font-semibold text-[#1D8D2B]">
					{creating === c.key ? 'Creating…' : 'Choose →'}
				</span>
			</button>
		{/each}
	</div>
</div>
