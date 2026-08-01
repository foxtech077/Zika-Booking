import type { PageServerLoad } from './$types';
import { loadListings } from '$lib/load-listings';
import { isListingCategory } from '$lib/listing-meta';

export const load: PageServerLoad = (event) => {
	const raw = event.url.searchParams.get('category');
	const category = isListingCategory(raw) ? raw : 'hotel';
	return loadListings(event, category);
};
