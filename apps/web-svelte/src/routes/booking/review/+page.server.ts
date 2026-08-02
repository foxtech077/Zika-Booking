import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { LISTING_API_URL } from '$lib/config';
import { fetchListingDetail } from '$lib/listing-api';

export const load: PageServerLoad = async ({ url, cookies, fetch }) => {
	const listingId = url.searchParams.get('listingId');
	if (!listingId) throw error(400, 'Missing listing');

	const currency = cookies.get('kainook_currency') ?? undefined;
	const detail = await fetchListingDetail(fetch, listingId, LISTING_API_URL, currency);
	if (!detail) throw error(404, 'Listing not found');

	return { detail };
};
