import type { PageServerLoad } from './$types';
import { loadListings } from '$lib/load-listings';

export const load: PageServerLoad = (event) => loadListings(event, 'apartment');
