<script lang="ts">
	import { cn } from '$lib/utils';
	import { currencySymbol } from '$lib/utils';
	import { location } from '$lib/stores/location.svelte';
	import type { ListingCategory } from '$lib/listing-api';
	import { AMENITY_OPTIONS, CAR_CATEGORIES, type FilterState } from '$lib/listing-meta';

	let {
		category,
		filters,
		onChange,
		onApply,
		onReset
	}: {
		category: ListingCategory;
		filters: FilterState;
		onChange: (patch: Partial<FilterState>) => void;
		onApply: () => void;
		onReset: () => void;
	} = $props();

	const isCar = $derived(category === 'car');
	const isApt = $derived(category === 'apartment');

	const AMENITY_PREVIEW = 12;
	let showAllAmenities = $state(false);

	const currency = $derived(location.country?.currency ?? 'KES');
	const priceDisplay = $derived(
		filters.priceMax >= 500000
			? `${currencySymbol(currency)}500+`
			: `${currencySymbol(currency)}${filters.priceMax.toLocaleString()}`
	);
</script>

{#snippet chip(active: boolean, onClick: () => void, label: string)}
	<button
		type="button"
		onclick={onClick}
		class={cn(
			'rounded-full border px-3 py-1.5 text-xs font-medium transition',
			active
				? 'border-[#0c2614] bg-[#0c2614] text-white'
				: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
		)}
	>
		{label}
	</button>
{/snippet}

<div class="space-y-6">
	<!-- Price range -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<span class="block text-xs font-semibold text-slate-700">Price Range</span>
			<span class="text-xs font-semibold text-slate-500">{priceDisplay}</span>
		</div>
		<input
			type="range"
			min="500"
			max="50000"
			step="500"
			value={filters.priceMax >= 500000 ? 50000 : filters.priceMax}
			oninput={(e) => {
				const v = Number((e.currentTarget as HTMLInputElement).value);
				onChange({ priceMax: v >= 50000 ? 500000 : v });
			}}
			class="h-1.5 w-full cursor-pointer accent-[#1D8D2B]"
		/>
	</div>

	<!-- Min. rating (non-car) -->
	{#if !isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Min. Rating</span>
			<div class="flex gap-2">
				{#each [3, 4, 5] as s (s)}
					<button
						type="button"
						onclick={() => onChange({ rating: s === filters.rating ? null : s })}
						class={cn(
							'flex-1 rounded-xl border py-2 text-xs font-semibold transition',
							s === filters.rating
								? 'border-[#0c2614] bg-[#0c2614] text-white'
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
						)}
					>
						★ {s}+
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Bedrooms / Bathrooms (apartments) -->
	{#if isApt}
		<div class="grid grid-cols-2 gap-3">
			<div>
				<span class="mb-1.5 block text-xs font-semibold text-slate-700">Bedrooms</span>
				<select
					value={filters.bedrooms ?? ''}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						onChange({ bedrooms: v ? Number(v) : null });
					}}
					class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition focus:border-[#1D8D2B] focus:outline-none"
				>
					<option value="">Any</option>
					{#each [1, 2, 3, 4, 5] as n (n)}
						<option value={n}>{n}{n === 5 ? '+' : ''}</option>
					{/each}
				</select>
			</div>
			<div>
				<span class="mb-1.5 block text-xs font-semibold text-slate-700">Bathrooms</span>
				<select
					value={filters.bathrooms ?? ''}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						onChange({ bathrooms: v ? Number(v) : null });
					}}
					class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition focus:border-[#1D8D2B] focus:outline-none"
				>
					<option value="">Any</option>
					{#each [1, 2, 3, 4] as n (n)}
						<option value={n}>{n}{n === 4 ? '+' : ''}</option>
					{/each}
				</select>
			</div>
		</div>
	{/if}

	<!-- Amenities (non-car) -->
	{#if !isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Amenities</span>
			<div class="flex flex-wrap gap-2">
				{#each showAllAmenities ? AMENITY_OPTIONS : AMENITY_OPTIONS.slice(0, AMENITY_PREVIEW) as { key, label } (key)}
					{@render chip(
						filters.amenities.includes(key),
						() =>
							onChange({
								amenities: filters.amenities.includes(key)
									? filters.amenities.filter((a) => a !== key)
									: [...filters.amenities, key]
							}),
						label
					)}
				{/each}
			</div>
			{#if AMENITY_OPTIONS.length > AMENITY_PREVIEW}
				<button
					type="button"
					onclick={() => (showAllAmenities = !showAllAmenities)}
					class="text-xs font-bold text-[#1D8D2B] transition hover:text-[#16852a]"
				>
					{showAllAmenities ? 'Show less' : `Show all amenities (${AMENITY_OPTIONS.length})`}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Cancellation policy (non-car) -->
	{#if !isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Cancellation Policy</span>
			<div class="flex flex-col gap-1.5">
				{#each [{ value: '', label: 'Any' }, { value: 'flexible', label: 'Flexible' }, { value: 'moderate', label: 'Moderate' }, { value: 'strict', label: 'Strict' }] as opt (opt.value)}
					<label class="group flex cursor-pointer items-center gap-2.5 py-0.5">
						<button
							type="button"
							onclick={() => onChange({ cancellation: opt.value })}
							class={cn(
								'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition',
								filters.cancellation === opt.value
									? 'border-[#0c2614] bg-[#0c2614]'
									: 'border-slate-300 group-hover:border-[#1D8D2B]'
							)}
							aria-label={`${opt.label} cancellation`}
						>
							{#if filters.cancellation === opt.value}
								<span class="h-1.5 w-1.5 rounded-full bg-white"></span>
							{/if}
						</button>
						<span class="text-sm text-slate-700">{opt.label}</span>
					</label>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Minimum stay (non-car) -->
	{#if !isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Minimum Stay</span>
			<select
				value={filters.minStay ?? ''}
				onchange={(e) => {
					const v = (e.currentTarget as HTMLSelectElement).value;
					onChange({ minStay: v ? Number(v) : null });
				}}
				class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition focus:border-[#1D8D2B] focus:outline-none"
			>
				<option value="">Any</option>
				{#each [{ value: 1, label: '1+ night' }, { value: 3, label: '3+ nights' }, { value: 7, label: '7+ nights' }, { value: 14, label: '14+ nights' }, { value: 30, label: '30+ nights' }] as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Car: category -->
	{#if isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Vehicle Category</span>
			<div class="flex flex-wrap gap-2">
				{#each CAR_CATEGORIES as cat (cat)}
					{@render chip(
						filters.carCategory === cat,
						() => onChange({ carCategory: filters.carCategory === cat ? '' : cat }),
						cat
					)}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Car: transmission -->
	{#if isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Transmission</span>
			<div class="flex gap-2">
				{#each ['automatic', 'manual'] as t (t)}
					<button
						type="button"
						onclick={() => onChange({ transmission: filters.transmission === t ? '' : t })}
						class={cn(
							'flex-1 rounded-xl border py-2 text-xs font-semibold capitalize transition',
							filters.transmission === t
								? 'border-[#0c2614] bg-[#0c2614] text-white'
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
						)}
					>
						{t}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Car: fuel type -->
	{#if isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Fuel Type</span>
			<div class="flex flex-wrap gap-2">
				{#each ['petrol', 'diesel', 'hybrid', 'electric'] as f (f)}
					{@render chip(
						filters.fuelType === f,
						() => onChange({ fuelType: filters.fuelType === f ? '' : f }),
						f.charAt(0).toUpperCase() + f.slice(1)
					)}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Car: seats -->
	{#if isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Min. Seats</span>
			<div class="flex gap-2">
				{#each [2, 4, 5, 7] as s (s)}
					<button
						type="button"
						onclick={() => onChange({ seats: filters.seats === s ? null : s })}
						class={cn(
							'flex-1 rounded-xl border py-2 text-xs font-semibold transition',
							filters.seats === s
								? 'border-[#0c2614] bg-[#0c2614] text-white'
								: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
						)}
					>
						{s}+
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Car: min driver age -->
	{#if isCar}
		<div class="space-y-2">
			<span class="block text-xs font-semibold text-slate-700">Min. Driver Age</span>
			<select
				value={filters.minDriverAge ?? ''}
				onchange={(e) => {
					const v = (e.currentTarget as HTMLSelectElement).value;
					onChange({ minDriverAge: v ? Number(v) : null });
				}}
				class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition focus:border-[#1D8D2B] focus:outline-none"
			>
				<option value="">Any</option>
				{#each [18, 21, 25] as a (a)}
					<option value={a}>{a}+</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Smoking & pets (non-car) -->
	{#if !isCar}
		<div class="space-y-3">
			{#snippet toggleRow(label: string, on: boolean, onToggle: () => void)}
				<div class="flex items-center justify-between py-1">
					<p class="text-xs font-semibold text-slate-700">{label}</p>
					<button
						type="button"
						onclick={onToggle}
						class={cn(
							'relative h-5 w-10 rounded-full transition-colors',
							on ? 'bg-[#0c2614]' : 'bg-slate-200'
						)}
						aria-label={`Toggle ${label}`}
					>
						<span
							class={cn(
								'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
								on && 'translate-x-5'
							)}
						></span>
					</button>
				</div>
			{/snippet}
			{@render toggleRow('Smoking Allowed', filters.smokingAllowed, () =>
				onChange({ smokingAllowed: !filters.smokingAllowed })
			)}
			{@render toggleRow('Pets Allowed', filters.petsAllowed, () =>
				onChange({ petsAllowed: !filters.petsAllowed })
			)}
		</div>
	{/if}

	<!-- Apartment: long-stay discount -->
	{#if isApt}
		<div class="flex items-center justify-between py-1">
			<div>
				<p class="text-xs font-semibold text-slate-700">Long-stay Discount</p>
				<p class="text-[10px] text-slate-400">Monthly discount available</p>
			</div>
			<button
				type="button"
				onclick={() => onChange({ longStayDiscount: !filters.longStayDiscount })}
				class={cn(
					'relative h-5 w-10 rounded-full transition-colors',
					filters.longStayDiscount ? 'bg-[#0c2614]' : 'bg-slate-200'
				)}
				aria-label="Toggle long-stay discount"
			>
				<span
					class={cn(
						'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
						filters.longStayDiscount && 'translate-x-5'
					)}
				></span>
			</button>
		</div>
	{/if}

	<!-- Car: airport pickup + delivery -->
	{#if isCar}
		<div class="space-y-3">
			{#snippet carToggle(label: string, on: boolean, onToggle: () => void)}
				<div class="flex items-center justify-between py-1">
					<p class="text-xs font-semibold text-slate-700">{label}</p>
					<button
						type="button"
						onclick={onToggle}
						class={cn(
							'relative h-5 w-10 rounded-full transition-colors',
							on ? 'bg-[#0c2614]' : 'bg-slate-200'
						)}
						aria-label={`Toggle ${label}`}
					>
						<span
							class={cn(
								'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
								on && 'translate-x-5'
							)}
						></span>
					</button>
				</div>
			{/snippet}
			{@render carToggle('Airport Pickup', filters.airportPickup, () =>
				onChange({ airportPickup: !filters.airportPickup })
			)}
			{@render carToggle('Delivery Available', filters.deliveryAvailable, () =>
				onChange({ deliveryAvailable: !filters.deliveryAvailable })
			)}
		</div>
	{/if}

	<!-- Actions -->
	<button
		type="button"
		onclick={onApply}
		class="w-full rounded-xl bg-[#0c2614] py-3 text-sm font-semibold text-white transition hover:bg-[#1D8D2B]"
	>
		Apply Filters
	</button>
	<button
		type="button"
		onclick={onReset}
		class="w-full text-xs font-bold text-slate-400 transition hover:text-slate-700"
	>
		Reset all filters
	</button>
</div>
