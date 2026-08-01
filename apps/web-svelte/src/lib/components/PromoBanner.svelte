<script lang="ts">
	import { isPromotionValid, type ActivePromotion } from '$lib/listing-api';

	let { promotion }: { promotion: ActivePromotion | null } = $props();

	const active = $derived(promotion !== null && isPromotionValid(promotion));
</script>

{#if active && promotion}
	<div
		class="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-[#1d8d2b]/20 bg-[#0c2614] p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8"
	>
		<div class="min-w-0 flex-1">
			{#if promotion.labelText}
				<span
					class="mb-2.5 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
					style={`background-color:${promotion.labelColour ? `${promotion.labelColour}22` : 'rgba(29,141,43,0.2)'};border-color:${promotion.labelColour ? `${promotion.labelColour}44` : 'rgba(29,141,43,0.3)'};color:${promotion.labelColour || '#4ade80'};`}
				>
					{promotion.labelText}
				</span>
			{/if}
			{#if promotion.bannerTitle}
				<h3 class="text-xl leading-tight font-bold tracking-tight text-white sm:text-2xl">
					{promotion.bannerTitle}
				</h3>
			{/if}
			{#if promotion.bannerSubtitle}
				<p class="mt-1 max-w-xl text-xs leading-relaxed font-normal text-slate-300 sm:text-sm">
					{promotion.bannerSubtitle}
				</p>
			{/if}
		</div>

		<div class="flex shrink-0 items-center justify-center sm:ml-4">
			<div
				class="relative flex h-24 w-24 flex-col items-center justify-center gap-0.5 rounded-full border border-emerald-700/50"
			>
				<span class="text-2xl font-bold text-emerald-400">
					{promotion.discountType === 'percentage'
						? `${promotion.discountValue}%`
						: `${promotion.discountValue}`}
				</span>
				<span class="text-[8px] font-bold tracking-widest text-emerald-500/80 uppercase">
					AUTO-APPLIED
				</span>
			</div>
		</div>
	</div>
{/if}
