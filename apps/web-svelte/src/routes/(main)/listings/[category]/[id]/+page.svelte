<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import ListingGallery from '$lib/components/ListingGallery.svelte';
	import ReviewsSection from '$lib/components/ReviewsSection.svelte';
	import ListingCard from '$lib/components/ListingCard.svelte';
	import { formatMoney } from '$lib/currency-display';
	import { categoryHref } from '$lib/listing-meta';
	import { auth } from '$lib/stores/auth.svelte';
	import { recordRecentlyViewed, createConversation } from '$lib/account-api';
	import { addLocalRecentlyViewed } from '$lib/recently-viewed';

	let { data }: PageProps = $props();

	const detail = $derived(data.detail);
	const reviews = $derived(data.reviews);
	const recommendations = $derived(data.recommendations ?? []);

	const categoryLabel = $derived(
		detail
			? detail.category === 'car'
				? 'Car rental'
				: detail.category === 'hotel'
					? 'Hotel'
					: 'Apartment'
			: ''
	);
	const locationLabel = $derived(
		detail ? [detail.town, detail.neighborhood, detail.country].filter(Boolean).join(', ') : ''
	);

	const seoTitle = $derived(detail ? `${detail.name} | Kainook` : 'Listing not found | Kainook');
	const seoDescription = $derived(
		detail
			? detail.description
				? detail.description.slice(0, 200)
				: `Book ${categoryLabel.toLowerCase()} ${locationLabel} on Kainook.`
			: 'This listing is no longer available on Kainook.'
	);
	const imageUrl = $derived(detail?.photos[0]?.cdnUrl ?? detail?.primaryPhotoUrl ?? null);
	const canonicalUrl = $derived(page.url.origin + page.url.pathname);

	let shareCopied = $state(false);
	let messaging = $state(false);

	const canMessage = $derived(!!detail?.allowPreBooking && auth.isAuthenticated);

	// Record the view — signed-in users get server-side history, guests keep a
	// small local list so they still see "recently viewed" on the home page.
	onMount(() => {
		if (!detail) return;
		const snapshot = {
			id: detail.id,
			name: detail.name,
			category: detail.category,
			town: detail.town,
			country: detail.country,
			pricePerNight: detail.pricePerNight,
			currency: detail.currency,
			primaryPhotoUrl: detail.primaryPhotoUrl
		};
		if (auth.isAuthenticated) {
			recordRecentlyViewed(detail.id).catch(() => {
				// Signed-in request can still 401 while the store is hydrated —
				// fall back to local history rather than losing the record.
				addLocalRecentlyViewed(snapshot);
			});
		} else {
			addLocalRecentlyViewed(snapshot);
		}
	});

	async function handleShare(): Promise<void> {
		if (!detail || !browser) return;
		const url = canonicalUrl;
		const shareData = {
			title: detail.name,
			text: `Check out ${detail.name} on Kainook`,
			url
		};
		if (typeof navigator.share === 'function') {
			try {
				await navigator.share(shareData);
				return;
			} catch (err) {
				// User dismissed the native sheet — treat as done.
				if ((err as DOMException)?.name === 'AbortError') return;
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			shareCopied = true;
			setTimeout(() => (shareCopied = false), 2000);
		} catch {
			// clipboard unavailable — nothing more we can do
		}
	}

	async function handleMessage(): Promise<void> {
		if (!detail || messaging) return;
		messaging = true;
		try {
			const convo = await createConversation(detail.id);
			await goto(`/messages?conversationId=${convo.id}`);
		} catch {
			messaging = false;
		}
	}

	const jsonLd = $derived(
		detail
			? JSON.stringify({
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
			: ''
	);
	const jsonLdHtml = $derived('<script type="application/ld+json">' + jsonLd + '<' + '/script>');

	const factRows = $derived.by(() => {
		if (!detail) return [];
		const rows: { label: string; value: string }[] = [];
		const converted = !!detail.localizedCurrency && detail.localizedCurrency !== detail.currency;
		const displayCode = detail.localizedCurrency ?? detail.currency;
		const money = (loc: number | null | undefined, base: number | null | undefined) => {
			const shown = loc ?? base;
			let s = formatMoney(shown, displayCode, { approx: converted });
			if (converted && base && shown !== base) s += ` (${formatMoney(base, detail.currency)})`;
			return s;
		};
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
					value: money(detail.localizedSecurityDeposit, detail.securityDeposit)
				});
			}
			if (detail.deliveryAvailable) {
				const fee = detail.localizedDeliveryFee ?? detail.deliveryFee;
				const feeText =
					fee != null && fee > 0
						? ` · ${money(detail.localizedDeliveryFee, detail.deliveryFee)}`
						: ' · Free';
				rows.push({ label: 'Delivery', value: `Available${feeText}` });
			}
		}
		rows.push({ label: 'Cancellation', value: detail.cancellationPolicy.replace(/_/g, ' ') });
		return rows;
	});

	let WidgetComponent = $state<
		typeof import('$lib/components/BookingWidget.svelte').default | null
	>(null);
	let MapComponent = $state<typeof import('$lib/components/ListingMap.svelte').default | null>(
		null
	);

	$effect(() => {
		if (!browser) return;
		let cancelled = false;
		void import('$lib/components/BookingWidget.svelte').then((mod) => {
			if (!cancelled) WidgetComponent = mod.default;
		});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!browser) return;
		let cancelled = false;
		void import('$lib/components/ListingMap.svelte').then((mod) => {
			if (!cancelled) MapComponent = mod.default;
		});
		return () => {
			cancelled = true;
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
		<meta property="og:image:alt" content={detail?.name ?? 'Kainook'} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={seoDescription} />
	{#if imageUrl}
		<meta name="twitter:image" content={imageUrl} />
	{/if}
	{#if jsonLd}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD from our own listing data -->
		{@html jsonLdHtml}
	{/if}
</svelte:head>

{#if detail}
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
			{#if detail.promoBadge?.labelText}
				<span
					class="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
				>
					🏷️ {detail.promoBadge.labelText}
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

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={handleShare}
				class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
			>
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
					/>
				</svg>
				{shareCopied ? 'Link copied' : 'Share'}
			</button>
			{#if canMessage}
				<button
					type="button"
					onclick={handleMessage}
					disabled={messaging}
					class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#1D8D2B]/50 hover:text-[#0c2614] disabled:cursor-not-allowed disabled:opacity-60"
				>
					<svg
						class="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
						/>
					</svg>
					{messaging ? 'Opening chat…' : 'Message provider'}
				</button>
			{/if}
		</div>

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

				{#if detail.lat != null && detail.lng != null}
					<section>
						<h2 class="font-serif text-2xl font-bold text-slate-900">Where you'll be</h2>
						{#if detail.address}
							<p class="mt-1 text-sm text-slate-500">{detail.address}</p>
						{/if}
						<div
							class="relative z-0 mt-4 h-[300px] overflow-hidden rounded-3xl border border-slate-200"
						>
							{#if MapComponent}
								<MapComponent
									listings={[detail]}
									hoveredId={detail.id}
									onHover={() => {}}
									onSelect={() => {}}
								/>
							{:else}
								<div
									class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl bg-slate-100"
								>
									<div
										class="h-6 w-6 animate-spin rounded-full border-4 border-[#0B1E3F] border-t-transparent"
									></div>
									<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
										Loading map…
									</p>
								</div>
							{/if}
						</div>
					</section>
				{:else}
					<section>
						<h2 class="font-serif text-2xl font-bold text-slate-900">Where you'll be</h2>
						<div
							class="mt-4 flex h-[300px] w-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-100"
						>
							<svg
								class="h-8 w-8 text-slate-400"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
								/>
							</svg>
							<p class="mt-2 text-sm font-semibold text-slate-600">{locationLabel}</p>
							<p class="mt-1 text-xs text-slate-400">Location coordinates not available</p>
						</div>
					</section>
				{/if}

				{#if reviews && reviews.reviews.length > 0}
					<ReviewsSection {reviews} listingName={detail.name} />
				{/if}
			</div>

			<aside class="h-fit lg:sticky lg:top-24">
				<div class="relative min-h-[280px]">
					{#if WidgetComponent}
						<WidgetComponent listing={detail} />
					{:else}
						<div
							class="absolute inset-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-md"
						>
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
{:else}
	<!-- Listing not found / unavailable -->
	<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
		<div class="mx-auto max-w-2xl text-center">
			<div
				class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-red-100 bg-red-50 text-red-500"
			>
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
			</div>
			<h1 class="mt-6 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
				This listing isn't available
			</h1>
			<p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
				It may have been booked, removed, or is no longer taking reservations. Explore similar
				places below or head back to search.
			</p>
			<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
				<a
					href={categoryHref(data.category)}
					class="rounded-full bg-[#0c2614] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d]"
				>
					Browse {categoryLabel || 'listings'}
				</a>
				<a
					href="/"
					class="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
				>
					Go to Home
				</a>
			</div>
		</div>

		{#if recommendations.length > 0}
			<div class="mt-16">
				<h2 class="font-serif text-2xl font-bold text-slate-900">You might also like</h2>
				<div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each recommendations as listing (listing.id)}
						<ListingCard {listing} />
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
