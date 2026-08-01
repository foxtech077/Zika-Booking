import type { PageServerLoad } from './$types';
import { searchListings, type PublicListing } from '$lib/listing-api';
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
	return { featured };
};
