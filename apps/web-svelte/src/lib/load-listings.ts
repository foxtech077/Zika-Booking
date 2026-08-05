import type { Cookies } from '@sveltejs/kit';
import { LISTING_API_URL, DEFAULT_COORDS, parseCoordsCookie } from '$lib/config';
import {
	searchListingsDetail,
	fetchActivePromotion,
	buildSearchApiParams,
	type PublicListingDetail,
	type ActivePromotion,
	type ListingCategory,
	type SearchState
} from '$lib/listing-api';
import { PAGE_SIZE } from '$lib/listing-meta';

export interface ListingsData {
	category: ListingCategory;
	results: PublicListingDetail[];
	totalCount: number;
	error: string | null;
	promotion: ActivePromotion | null;
}

/** Builds a SearchState from the current URL, so SSR and the client agree on criteria. */
export function searchStateFromUrl(
	url: URL,
	category: ListingCategory,
	coords: { lat: number; lng: number },
	cursor = 0,
	limit = PAGE_SIZE,
	currency?: string
): SearchState {
	const sp = url.searchParams;
	const num = (k: string): number | undefined => {
		const v = Number(sp.get(k) ?? 0);
		return v > 0 ? v : undefined;
	};
	// A destination search is carried by `q` (new) or `destination` (legacy
	// homepage links / hero form). When the destination resolved to a real
	// place the URL also carries place_resolved=true + the geocoded coords —
	// those unlock the "nearby" fallback; otherwise the backend stays text-only.
	const placeResolved = sp.get('place_resolved') === 'true';
	const urlLat = sp.get('lat') ? Number(sp.get('lat')) : undefined;
	const urlLng = sp.get('lng') ? Number(sp.get('lng')) : undefined;
	const hasUrlCoords =
		placeResolved && urlLat != null && urlLng != null && !isNaN(urlLat) && !isNaN(urlLng);
	return {
		category,
		q: sp.get('q') ?? sp.get('destination') ?? undefined,
		placeResolved: sp.get('q') || sp.get('destination') ? placeResolved : undefined,
		checkIn: sp.get('checkin') ?? undefined,
		checkOut: sp.get('checkout') ?? undefined,
		pickupDate: sp.get('pickup') ?? undefined,
		returnDate: sp.get('return') ?? undefined,
		guests: num('guests'),
		sort: sp.get('sort') ?? 'recommended',
		priceMax: num('price_max'),
		rating: num('rating'),
		amenities: (sp.get('amenities') ?? '').split(',').filter(Boolean),
		cancellation: sp.get('cancellation') ?? undefined,
		minStay: num('min_stay'),
		transmission: sp.get('transmission') ?? undefined,
		fuelType: sp.get('fuel') ?? undefined,
		carCategory: sp.get('car_category') ?? undefined,
		seats: num('seats'),
		minDriverAge: num('min_age'),
		bedrooms: num('bedrooms'),
		bathrooms: num('bathrooms'),
		smokingAllowed: sp.get('smoking_allowed') === 'true',
		petsAllowed: sp.get('pets_allowed') === 'true',
		longStayDiscount: sp.get('long_stay_discount') === 'true',
		deliveryAvailable: sp.get('delivery') === 'true',
		currency,
		cursor,
		limit,
		lat: hasUrlCoords ? urlLat! : coords.lat,
		lng: hasUrlCoords ? urlLng! : coords.lng
	};
}

export async function loadListings(
	event: { url: URL; cookies: Cookies; fetch: typeof fetch },
	category: ListingCategory
): Promise<ListingsData> {
	const coords = parseCoordsCookie(event.cookies.get('kainook_coords')) ?? DEFAULT_COORDS;
	const currency = event.cookies.get('kainook_currency') ?? undefined;
	const state = searchStateFromUrl(event.url, category, coords, 0, PAGE_SIZE, currency);

	let failed = false;
	const [listings, promotion] = await Promise.all([
		searchListingsDetail(event.fetch, buildSearchApiParams(state), LISTING_API_URL).catch(() => {
			failed = true;
			return { results: [] as PublicListingDetail[], totalCount: 0 };
		}),
		fetchActivePromotion(event.fetch, category, LISTING_API_URL).catch(() => null)
	]);

	return {
		category,
		results: listings.results,
		totalCount: listings.totalCount,
		error: failed ? 'Failed to load listings.' : null,
		promotion
	};
}
