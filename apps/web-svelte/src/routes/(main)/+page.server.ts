import type { PageServerLoad } from './$types';
import {
	searchListings,
	fetchActivePromotion,
	isPromotionValid,
	type PublicListing
} from '$lib/listing-api';
import { LISTING_API_URL, DEFAULT_COORDS, parseCoordsCookie } from '$lib/config';

export const load: PageServerLoad = async ({ fetch, cookies }) => {
	const coords = parseCoordsCookie(cookies.get('kainook_coords')) ?? DEFAULT_COORDS;
	const currency = cookies.get('kainook_currency') ?? undefined;
	let featured: PublicListing[];
	try {
		featured = await searchListings(
			fetch,
			{
				category: 'hotel',
				limit: 8,
				lat: coords.lat,
				lng: coords.lng,
				radius_km: 5000,
				...(currency ? { currency } : {})
			},
			LISTING_API_URL
		);
	} catch {
		featured = [];
	}
	// The active hotel promotion drives the badge shown on the featured cards.
	const promotion = await fetchActivePromotion(fetch, 'hotel', LISTING_API_URL).catch(
		() => null
	);
	return {
		featured,
		promotion: promotion && isPromotionValid(promotion) ? promotion : null
	};
};
