import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { LISTING_API_URL, DEFAULT_COORDS, parseCoordsCookie } from '$lib/config';
import { fetchListingDetail, fetchListingReviews, searchListingsDetail } from '$lib/listing-api';
import { slugToCategory } from '$lib/listing-meta';

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
	const category = slugToCategory(params.category);
	if (!category) throw error(404, 'Listing not found');

	const currency = cookies.get('kainook_currency') ?? undefined;
	const [detail, reviews] = await Promise.all([
		fetchListingDetail(fetch, params.id, LISTING_API_URL, currency),
		fetchListingReviews(fetch, params.id, LISTING_API_URL)
	]);

	if (!detail) {
		// Listing doesn't exist (or is no longer available). Instead of a bare
		// 404, gather a few suggestions so the page can point the traveller
		// somewhere useful.
		const coords = parseCoordsCookie(cookies.get('kainook_coords')) ?? DEFAULT_COORDS;
		const { results: recommendations } = await searchListingsDetail(
			fetch,
			{ category, limit: 8, lat: coords.lat, lng: coords.lng, sort: 'recommended' },
			LISTING_API_URL
		).catch(() => ({ results: [], totalCount: 0 }));
		return { detail: null, reviews: null, recommendations, category };
	}

	// Canonical URL: the slug in the path must match the listing's real category.
	if (detail.category !== category) {
		redirect(308, `/listings/${detail.category}/${params.id}`);
	}

	return { detail, reviews, recommendations: [], category };
};
