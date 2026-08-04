import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { LISTING_API_URL } from '$lib/config';
import { fetchListingDetail, fetchListingReviews } from '$lib/listing-api';

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
	const currency = cookies.get('kainook_currency') ?? undefined;
	const [detail, reviews] = await Promise.all([
		fetchListingDetail(fetch, params.id, LISTING_API_URL, currency),
		fetchListingReviews(fetch, params.id, LISTING_API_URL)
	]);

	if (!detail) throw error(404, 'Listing not found');

	return { detail, reviews };
};
