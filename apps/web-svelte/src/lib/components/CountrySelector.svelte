<script lang="ts">
	import { location, setCountry } from '$lib/stores/location.svelte';
	import { ALL_COUNTRIES } from '$lib/countries';
	import { cn } from '$lib/utils';

	let open = $state(false);
	let query = $state('');
	let containerRef = $state<HTMLDivElement | null>(null);
	let searchInput = $state<HTMLInputElement | undefined>(undefined);

	const filtered = $derived(
		ALL_COUNTRIES.filter((c) => {
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return `${c.name} ${c.code} ${c.currency ?? ''}`.toLowerCase().includes(q);
		})
	);

	$effect(() => {
		if (!open) return;
		searchInput?.focus();
		const onOutside = (e: MouseEvent) => {
			if (containerRef && !containerRef.contains(e.target as Node)) open = false;
		};
		document.addEventListener('mousedown', onOutside);
		return () => document.removeEventListener('mousedown', onOutside);
	});

	function select(code: string): void {
		setCountry(code);
		open = false;
		query = '';
	}
</script>

<div class="relative shrink-0" bind:this={containerRef}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
		class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#1D8D2B] hover:text-[#0c2614]"
	>
		<span class="text-base leading-none">{location.country?.flag ?? '🌐'}</span>
		<span class="hidden sm:inline">
			{location.country?.name ?? 'Select'}{location.country?.currency
				? `/${location.country.currency}`
				: ''}
		</span>
		<svg
			class={cn('h-3 w-3 transition-transform', open && 'rotate-180 text-slate-400')}
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-72 animate-slide-in-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
		>
			<div class="border-b border-slate-100 p-2">
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search country or currency"
					value={query}
					oninput={(e) => (query = (e.currentTarget as HTMLInputElement).value)}
					class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#1D8D2B] focus:bg-white"
				/>
			</div>
			<div class="max-h-72 overflow-y-auto py-1">
				{#each filtered as c (c.code)}
					<button
						type="button"
						onmousedown={() => select(c.code)}
						class={cn(
							'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors',
							c.code === location.country?.code
								? 'bg-[#E8F5E9] text-[#0c2614]'
								: 'text-slate-700 hover:bg-slate-50'
						)}
					>
						<span class="text-base leading-none">{c.flag}</span>
						<span class="flex-1 truncate">{c.name}</span>
						<span class="text-[10px] font-semibold text-slate-400">{c.currency ?? '—'}</span>
					</button>
				{:else}
					<p class="px-3 py-6 text-center text-xs text-slate-400">No countries found</p>
				{/each}
			</div>
		</div>
	{/if}
</div>
