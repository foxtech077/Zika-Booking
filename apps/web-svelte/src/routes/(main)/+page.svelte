<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import HeroSearch from '$lib/components/HeroSearch.svelte';
	import ListingCard from '$lib/components/ListingCard.svelte';
	import RecentlyViewedStrip from '$lib/components/RecentlyViewedStrip.svelte';
	import ShimmerImage from '$lib/components/ShimmerImage.svelte';
	import { loadFavourites } from '$lib/stores/favourites.svelte';

	let { data }: PageProps = $props();

	const featured = $derived(data.featured ?? []);

	onMount(() => {
		// Load the signed-in user's favourites so the featured-card hearts
		// reflect what's already saved (the SSR featured load can't carry the
		// auth token). Idempotent per user.
		void loadFavourites();
	});

	const curatedWorlds = [
		{
			name: 'Amalfi Coast, Italy',
			img: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=900&q=85',
			props: '120+ Exclusive Properties',
			featured: true
		},
		{
			name: 'Kyoto, Japan',
			img: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=85',
			props: '80+ Exclusive Properties',
			featured: false
		},
		{
			name: 'Santorini, Greece',
			img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=85',
			props: '95+ Exclusive Properties',
			featured: false
		}
	];

	const tiers = [
		{
			tier: 'Bronze',
			label: 'THE ENTRY',
			level: '1 Stay',
			perks: ['Access to member-only pricing', 'Welcome amenities'],
			border: 'border-amber-700/30',
			iconBg: 'bg-amber-700/20',
			icon: 'text-amber-400',
			popular: false
		},
		{
			tier: 'Silver',
			label: 'ACHIEVEMENT',
			level: '5 Stays',
			perks: ['Early check-in, late check-out', 'Luxury suite upgrades'],
			border: 'border-slate-400/25',
			iconBg: 'bg-slate-400/15',
			icon: 'text-slate-300',
			popular: false
		},
		{
			tier: 'Gold',
			label: 'ACHIEVEMENT',
			level: '10 Stays',
			perks: ['Personal travel designer', 'Sustainable breakfast'],
			border: 'border-[#58B430]/50',
			iconBg: 'bg-[#58B430]/15',
			icon: 'text-[#58B430]',
			popular: true
		},
		{
			tier: 'Diamond',
			label: 'REQUIREMENT',
			level: 'Invitation Only',
			perks: ['24/7 dedicated butler', 'Private jet transfers'],
			border: 'border-cyan-400/25',
			iconBg: 'bg-cyan-400/10',
			icon: 'text-cyan-300',
			popular: false
		}
	];

	const benefits = [
		{ icon: '⚡', title: 'Instant Booking', desc: 'Confirmed in seconds, no approval delays.' },
		{ icon: '🛡️', title: 'Secure Payments', desc: 'Bank-grade encryption on every transaction.' },
		{
			icon: '🌍',
			title: 'Global Portfolio',
			desc: '10,000+ curated properties across 40 countries.'
		},
		{ icon: '🎧', title: '24/7 Concierge', desc: 'Personal support at every step of your journey.' }
	];

	const testimonials = [
		{
			text: 'The curation of hotels on Kainook is unmatched. I found a boutique hotel in Morocco that I couldn\u2019t find anywhere else. Flawless experience!',
			name: 'Amara Nwosu',
			location: 'Lagos, Nigeria',
			initials: 'AN'
		},
		{
			text: 'Easy, fast, and secure. The VIP rewards program actually delivers real value from the first booking. Highly recommended.',
			name: 'Kofi Danku',
			location: 'Accra, Ghana',
			initials: 'KD'
		},
		{
			text: 'Travelling across Africa has never been this organised. The car rental feature integrated with my hotel booking saved me so much time.',
			name: 'Sarah Louw',
			location: 'Cape Town, SA',
			initials: 'SL'
		}
	];
</script>

<svelte:head>
	<title>Kainook — Book Hotels, Apartments & Car Rentals Worldwide</title>
	<meta name="robots" content="index, follow" />
</svelte:head>

<!-- ── HERO ── -->
<div class="relative z-20 flex w-full items-center justify-center" style="min-height: 85vh">
	<div class="absolute inset-0 overflow-hidden">
		<ShimmerImage
			src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=95"
			alt="Lakeside hotel at evening"
			loading="eager"
			class="absolute inset-0 h-full w-full object-cover object-center"
		/>
		<div class="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/75"></div>
		<div
			class="pointer-events-none absolute right-0 bottom-0 left-0 h-36 bg-gradient-to-t from-[#0c2614] to-transparent"
		></div>
	</div>

	<div class="relative z-10 mx-auto w-full max-w-4xl px-6 py-12 text-center md:py-20">
		<p class="mb-3 text-[10px] font-semibold tracking-[0.4em] text-white/55 uppercase">
			Private Collections 2026
		</p>
		<h1
			class="mb-5 font-serif text-4xl leading-tight font-light text-white italic drop-shadow-xl md:mb-7 md:text-6xl lg:text-7xl"
		>
			Extraordinary Stays,<br />Unforgettable Journeys
		</h1>

		<HeroSearch />

		<p class="mt-6 text-[10px] font-semibold tracking-[0.3em] text-white/60 uppercase">
			✦ 10,000+ Curated Stays · 40 Countries · 24/7 Concierge ✦
		</p>
	</div>
</div>

<!-- ── TICKER ── -->
<div class="overflow-hidden bg-[#0c2614] py-2">
	<div class="flex w-max items-center" style="animation: marquee 25s linear infinite">
		{#each [0, 1] as group (group)}
			<div class="flex items-center gap-16 px-16 whitespace-nowrap">
				{#each [0, 1, 2, 3] as i (i)}
					<span
						class="flex items-center gap-4 text-[10px] font-medium tracking-[0.25em] text-green-300/80 uppercase"
					>
						<span class="text-[#58B430]">✦</span>
						Exclusive Member Rates · Private Collections 2026 · Complimentary Concierge
					</span>
				{/each}
			</div>
		{/each}
	</div>
</div>

<!-- ── CURATED WORLDS ── -->
<section class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
	<div class="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<p class="mb-2 text-[10px] font-semibold tracking-[0.3em] text-[#1D8D2B] uppercase">
				Curated Worlds
			</p>
			<h2 class="font-serif text-3xl leading-snug text-slate-900 md:text-4xl">
				Discover Destinations Selected for the<br class="hidden sm:block" /> Discerning Traveler.
			</h2>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each curatedWorlds as world, i (world.name)}
			{#if i === 0}
				<a
					href={`/search?category=hotel&destination=${encodeURIComponent(world.name)}`}
					class="group relative block cursor-pointer overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl"
					style="min-height: 420px"
				>
					<ShimmerImage
						src={world.img}
						alt={world.name}
						class="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
					/>
					<div
						class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
					></div>
					<div class="absolute bottom-0 left-0 p-6 text-left">
						<p class="font-serif text-2xl leading-snug font-light text-white">{world.name}</p>
						<p class="mt-1 text-xs font-medium tracking-wide text-white/65">{world.props}</p>
					</div>
				</a>
			{/if}
		{/each}

		<div class="grid grid-rows-2 gap-4">
			{#each curatedWorlds as world (world.name)}
				{#if world.name !== 'Amalfi Coast, Italy'}
					<a
						href={`/search?category=hotel&destination=${encodeURIComponent(world.name)}`}
						class="group relative block cursor-pointer overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:shadow-xl"
						style="min-height: 198px"
					>
						<ShimmerImage
							src={world.img}
							alt={world.name}
							class="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
						/>
						<div
							class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
						></div>
						<div class="absolute bottom-0 left-0 p-5 text-left">
							<p class="font-serif text-xl font-light text-white">{world.name}</p>
							<p class="mt-0.5 text-xs font-medium tracking-wide text-white/65">{world.props}</p>
						</div>
					</a>
				{/if}
			{/each}
		</div>
	</div>
</section>

<!-- ── STAY IN EXCELLENCE ── -->
<section class="border-y border-slate-200/60 bg-[#f7f6f3] py-16">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<div class="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="mb-2 text-[10px] font-semibold tracking-[0.3em] text-[#1D8D2B] uppercase">
					Top Picks
				</p>
				<h2 class="font-serif text-3xl text-slate-900 md:text-4xl">Stay in Excellence</h2>
			</div>
			<div class="flex gap-2">
				{#each [{ key: 'hotel', label: 'Hotels' }, { key: 'apartment', label: 'Home' }, { key: 'car', label: 'Cars' }] as cat (cat.key)}
					<a
						href={`/search?category=${cat.key}`}
						class={cat.key === 'hotel'
							? 'rounded-full border border-[#0c2614] bg-[#0c2614] px-4 py-1.5 text-xs font-semibold text-white'
							: 'rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#0c2614] hover:text-[#0c2614]'}
					>
						{cat.label}
					</a>
				{/each}
			</div>
		</div>

		{#if featured.length === 0}
			<div class="py-16 text-center text-sm font-semibold text-slate-400">
				No featured listings available right now.
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{#each featured as listing (listing.id)}
					<ListingCard {listing} />
				{/each}
			</div>

			<div class="mt-8 text-center">
				<a
					href="/search?category=hotel"
					class="inline-flex items-center gap-2 rounded-full border border-[#0c2614] px-6 py-3 text-sm font-semibold text-[#0c2614] transition hover:bg-[#0c2614] hover:text-white"
				>
					View all hotels
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
					</svg>
				</a>
			</div>
		{/if}
	</div>
</section>

<!-- ── RECENTLY VIEWED ── -->
<RecentlyViewedStrip />

<!-- ── ELEVATE YOUR EVERY EXPERIENCE ── -->
<section class="bg-[#0c2614] px-4 py-16 sm:px-6">
	<div class="mx-auto max-w-7xl">
		<div class="mb-12 text-center">
			<p class="mb-3 text-[10px] font-semibold tracking-[0.35em] text-[#58B430] uppercase">
				Kainook Privilege
			</p>
			<h2 class="font-serif text-3xl leading-snug font-light text-white md:text-4xl">
				Elevate Your Every Experience
			</h2>
			<p class="mx-auto mt-3 max-w-md text-sm text-green-300/70">
				Join our membership programme to unlock exclusive rates, personal concierges, and
				first-class transfers.
			</p>
		</div>
		<div class="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
			{#each tiers as t (t.tier)}
				<div
					class="bg-[#0a1f0d] {t.border} relative flex flex-col items-center gap-4 rounded-2xl border px-4 pt-6 pb-8 text-center text-white"
				>
					{#if t.popular}
						<span
							class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#58B430] px-3 py-1 text-[9px] font-bold tracking-widest whitespace-nowrap text-white uppercase"
						>
							Most Popular
						</span>
					{/if}
					<div class="h-12 w-12 {t.iconBg} flex items-center justify-center rounded-2xl">
						<svg
							class="h-6 w-6 {t.icon}"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
							/>
						</svg>
					</div>
					<div>
						<p class="text-base font-semibold tracking-wide">{t.tier}</p>
						{#each t.perks as perk}
							<p class="mt-0.5 text-[10px] font-medium tracking-widest text-green-300/50 uppercase">
								{perk}
							</p>
						{/each}
					</div>
					<div class="w-full space-y-1 border-t border-white/10 pt-3">
						<p class="text-[9px] font-bold tracking-widest text-green-400/60 uppercase">
							{t.label}
						</p>
						<p class="text-sm font-semibold text-white">{t.level}</p>
					</div>
				</div>
			{/each}
		</div>
		<div class="text-center">
			<a
				href="/auth/login"
				class="inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#0c2614] shadow-lg transition hover:bg-green-50"
			>
				Join Kainook Privilege
			</a>
		</div>
	</div>
</section>

<!-- ── BENEFITS ── -->
<section class="border-t border-slate-100 bg-white py-16">
	<div class="mx-auto max-w-7xl px-4 text-center sm:px-6">
		<p class="mb-2 text-[10px] font-semibold tracking-[0.3em] text-[#1D8D2B] uppercase">
			Why Kainook
		</p>
		<h2 class="mb-12 font-serif text-3xl text-slate-900 md:text-4xl">
			Crafted for the Discerning Traveler
		</h2>
		<div class="grid grid-cols-2 gap-10 lg:grid-cols-4">
			{#each benefits as item (item.title)}
				<div class="flex flex-col items-center gap-3 text-center">
					<div
						class="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#0c2614]/10 bg-[#0c2614]/8 text-2xl"
					>
						{item.icon}
					</div>
					<p class="text-sm font-semibold text-slate-900">{item.title}</p>
					<p class="text-xs leading-relaxed text-slate-400">{item.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- ── TESTIMONIALS ── -->
<section class="border-t border-slate-100 bg-[#f7f6f3] py-16">
	<div class="mx-auto max-w-7xl px-4 sm:px-6">
		<p class="mb-2 text-[10px] font-semibold tracking-[0.3em] text-[#1D8D2B] uppercase">
			Guest Voices
		</p>
		<h2 class="mb-10 font-serif text-3xl text-slate-900 md:text-4xl">What Our Guests Say</h2>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			{#each testimonials as t (t.name)}
				<div class="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
					<div class="flex gap-0.5">
						{#each [1, 2, 3, 4, 5] as n (n)}
							<span class="text-base text-amber-400">★</span>
						{/each}
					</div>
					<p class="text-sm leading-relaxed font-light text-slate-600">&ldquo;{t.text}&rdquo;</p>
					<div class="flex items-center gap-3 border-t border-slate-100 pt-1">
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0c2614] text-[10px] font-bold text-white"
						>
							{t.initials}
						</div>
						<div>
							<p class="text-sm font-semibold text-slate-900">{t.name}</p>
							<p class="text-[10px] tracking-wide text-slate-400">{t.location}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
