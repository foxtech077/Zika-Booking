<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { mount, unmount } from 'svelte';
	import type { PageProps } from './$types';
	import ListingGallery from '$lib/components/ListingGallery.svelte';
	import ReviewsSection from '$lib/components/ReviewsSection.svelte';

	let { data }: PageProps = $props();

	const detail = $derived(data.detail);
	const reviews = $derived(data.reviews);

	const categoryLabel = $derived(
		detail.category === 'car' ? 'Car rental' : detail.category === 'hotel' ? 'Hotel' : 'Apartment'
	);
	const locationLabel = $derived(
		[detail.town, detail.neighborhood, detail.country].filter(Boolean).join(', ')
	);

	const seoTitle = $derived(`${detail.name} | Kainook`);
	const seoDescription = $derived(
		detail.description
			? detail.description.slice(0, 200)
			: `Book ${categoryLabel.toLowerCase()} ${locationLabel} on Kainook.`
	);
	const imageUrl = $derived(detail.photos[0]?.cdnUrl ?? detail.primaryPhotoUrl ?? null);
	const canonicalUrl = $derived(page.url.origin + page.url.pathname);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type':
				detail.category === 'hotel'
					? 'Hotel'
					: detail.category === 'car'
						? 'AutoRental'
						: 'Apartment',
			name: detail.name,
			description: detail.description || undefined,
			image: imageUrl || undefined,
			url: canonicalUrl,
			...(detail.lat != null && detail.lng != null
				? { geo: { '@type': 'GeoCoordinates', latitude: detail.lat, longitude: detail.lng } }
				: {}),
			address: {
				'@type': 'PostalAddress',
				addressLocality: detail.town,
				addressCountry: detail.country
			},
			...(detail.pricePerNight > 0
				? { priceRange: `${detail.currency} ${detail.pricePerNight.toLocaleString()}` }
				: {}),
			...(reviews?.averageRating
				? {
						aggregateRating: {
							'@type': 'AggregateRating',
							ratingValue: reviews.averageRating,
							reviewCount: reviews.total
						}
					}
				: {})
		})
	);
	const jsonLdHtml = $derived('<script type="application/ld+json">' + jsonLd + '<' + '/script>');

	const factRows = $derived.by(() => {
		const rows: { label: string; value: string }[] = [];
		if (detail.category !== 'car') {
			rows.push({ label: 'Check-in', value: detail.checkinTime || 'Flexible' });
			rows.push({ label: 'Check-out', value: detail.checkoutTime || 'Flexible' });
			if (detail.minStayNights > 1)
				rows.push({ label: 'Minimum stay', value: `${detail.minStayNights} nights` });
			if (detail.maxGuests) rows.push({ label: 'Guests', value: String(detail.maxGuests) });
			if (detail.bedrooms) rows.push({ label: 'Bedrooms', value: String(detail.bedrooms) });
			if (detail.bathrooms) rows.push({ label: 'Bathrooms', value: String(detail.bathrooms) });
		} else {
			if (detail.transmission) rows.push({ label: 'Transmission', value: detail.transmission });
			if (detail.fuelType) rows.push({ label: 'Fuel type', value: detail.fuelType });
			if (detail.seats) rows.push({ label: 'Seats', value: String(detail.seats) });
			if (detail.mileagePolicy) rows.push({ label: 'Mileage', value: detail.mileagePolicy });
			if (detail.driverProvided) {
				rows.push({ label: 'Driver', value: 'Included' });
			} else if (detail.securityDeposit != null && detail.securityDeposit > 0) {
				rows.push({
					label: 'Deposit',
					value: `${detail.currency} ${detail.securityDeposit.toLocaleString()}`
				});
			}
			if (detail.deliveryAvailable) {
				const fee =
					detail.deliveryFee != null && detail.deliveryFee > 0
						? ` · ${detail.currency} ${detail.deliveryFee}`
						: ' · Free';
				rows.push({ label: 'Delivery', value: `Available${fee}` });
			}
		}
		rows.push({ label: 'Cancellation', value: detail.cancellationPolicy.replace(/_/g, ' ') });
		return rows;
	});

	let host = $state<HTMLDivElement | null>(null);
	let widgetReady = $state(false);
	let widget: ReturnType<typeof mount> | null = null;

	$effect(() => {
		if (!browser) return;
		let cancelled = false;
		widgetReady = false;
		void import('$lib/components/BookingWidget.svelte').then((mod) => {
			if (cancelled || !host || !data.detail) return;
			widget = mount(mod.default, {
				target: host,
				props: { listing: data.detail }
			});
			widgetReady = true;
		});
		return () => {
			cancelled = true;
			if (widget) unmount(widget);
		};
	});
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={seoDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Kainook" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:url" content={canonicalUrl} />
	{#if imageUrl}
		<meta property="og:image" content={imageUrl} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:alt" content={detail.name} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={seoDescription} />
	{#if imageUrl}
		<meta name="twitter:image" content={imageUrl} />
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD from our own listing data -->
	{@html jsonLdHtml}
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
	<button
		type="button"
		onclick={() => history.back()}
		class="mb-4 flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-[#1D8D2B]"
	>
		<span class="text-base leading-none">←</span> Back to results
	</button>

	<div class="flex flex-wrap items-center gap-2">
		<span
			class="rounded-full bg-[#1D8D2B]/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#0c2614] uppercase"
		>
			{categoryLabel}
		</span>
		{#if detail.isAccredited}
			<span class="rounded-full bg-[#1D8D2B]/90 px-2.5 py-1 text-[10px] font-semibold text-white">
				✓ Verified
			</span>
		{/if}
		{#if detail.starRating}
			<span class="flex items-center gap-1 text-sm font-bold text-slate-700">
				<span class="text-amber-400">★</span>
				{detail.starRating}
			</span>
		{/if}
		{#if reviews?.averageRating}
			<span class="text-xs font-medium text-slate-400">
				{Number(reviews.averageRating).toFixed(1)} · {reviews.total} review{reviews.total !== 1
					? 's'
					: ''}
			</span>
		{/if}
	</div>

	<h1 class="mt-3 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">{detail.name}</h1>
	<p class="mt-1 text-sm text-slate-500">{locationLabel}</p>

	<div class="mt-6">
		<ListingGallery photos={detail.photos} alt={detail.name} />
	</div>

	<div
		class="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]"
	>
		<div class="min-w-0 space-y-10">
			<section>
				<h2 class="font-serif text-2xl font-bold text-slate-900">
					About this {categoryLabel.toLowerCase()}
				</h2>
				{#if detail.description}
					<p class="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-600">
						{detail.description}
					</p>
				{:else}
					<p class="mt-3 text-sm text-slate-400">No description available.</p>
				{/if}
			</section>

			{#if detail.amenities.length > 0}
				<section>
					<h2 class="font-serif text-2xl font-bold text-slate-900">What this place offers</h2>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each detail.amenities as amenity (amenity)}
							<span
								class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 capitalize"
							>
								{amenity.replace(/_/g, ' ')}
							</span>
						{/each}
					</div>
				</section>
			{/if}

			<section>
				<h2 class="font-serif text-2xl font-bold text-slate-900">Good to know</h2>
				<dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
					{#each factRows as row (row.label)}
						<div class="rounded-xl border border-slate-100 bg-white px-4 py-3">
							<dt class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
								{row.label}
							</dt>
							<dd class="mt-1 text-sm font-semibold text-slate-700 capitalize">{row.value}</dd>
						</div>
					{/each}
				</dl>
			</section>

			{#if reviews && reviews.reviews.length > 0}
				<ReviewsSection {reviews} listingName={detail.name} />
			{/if}
		</div>

		<aside class="h-fit lg:sticky lg:top-24">
			<div class="relative min-h-[280px]">
				<div bind:this={host}></div>
				{#if !widgetReady}
					<div class="absolute inset-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
						<div class="h-5 w-24 animate-pulse rounded bg-slate-200"></div>
						<div class="mt-4 h-10 animate-pulse rounded-xl bg-slate-100"></div>
						<div class="mt-3 h-10 animate-pulse rounded-xl bg-slate-100"></div>
						<div class="mt-5 h-11 animate-pulse rounded-xl bg-slate-200"></div>
					</div>
				{/if}
			</div>
		</aside>
	</div>
</div>
