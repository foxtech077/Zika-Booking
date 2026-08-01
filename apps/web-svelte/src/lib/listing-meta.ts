import type { ListingCategory } from '$lib/listing-api';

export const PAGE_SIZE = 20;

/** Global radius used for all listing searches so results are never clipped by geography. */
export const GLOBAL_RADIUS_KM = 20000;

export const CATEGORY_META: Record<
	ListingCategory,
	{ label: string; plural: string; title: string; subtitle: string }
> = {
	hotel: {
		label: 'Hotels',
		plural: 'hotels',
		title: 'Hotels',
		subtitle: 'Exceptional stays hand-picked for the discerning traveller.'
	},
	apartment: {
		label: 'Home',
		plural: 'homes',
		title: 'Home',
		subtitle: 'Spacious homes that feel like home, wherever you are.'
	},
	car: {
		label: 'Cars',
		plural: 'car rentals',
		title: 'Car Rentals',
		subtitle: 'Explore every destination with the perfect vehicle.'
	}
};

export const CATEGORIES: { key: ListingCategory; label: string; href: string }[] = [
	{ key: 'hotel', label: 'Hotels', href: '/hotels' },
	{ key: 'apartment', label: 'Home', href: '/apartments' },
	{ key: 'car', label: 'Cars', href: '/cars' }
];

export function categoryHref(category: ListingCategory): string {
	return category === 'hotel' ? '/hotels' : category === 'apartment' ? '/apartments' : '/cars';
}

export function isListingCategory(value: string | null): value is ListingCategory {
	return value === 'hotel' || value === 'apartment' || value === 'car';
}

export const SORT_OPTIONS: { value: string; label: string }[] = [
	{ value: 'recommended', label: 'Recommended' },
	{ value: 'price_asc', label: 'Price: Low to High' },
	{ value: 'price_desc', label: 'Price: High to Low' },
	{ value: 'rating_desc', label: 'Highest Rated' },
	{ value: 'distance_asc', label: 'Distance' }
];

export const AMENITY_CATEGORY: Record<string, string> = {
	wifi: 'Connectivity',
	smart_tv: 'Connectivity',
	work_desk: 'Connectivity',
	printer: 'Connectivity',
	workspace: 'Connectivity',
	breakfast: 'Food & Drink',
	restaurant_on_site: 'Food & Drink',
	coffee_machine: 'Food & Drink',
	minibar: 'Food & Drink',
	kitchen: 'Food & Drink',
	pool: 'Wellness',
	gym: 'Wellness',
	spa: 'Wellness',
	sauna: 'Wellness',
	hot_tub: 'Wellness',
	fitness_centre: 'Wellness',
	ac: 'Comfort',
	heating: 'Comfort',
	laundry: 'Comfort',
	parking: 'Comfort',
	elevator: 'Comfort',
	accessible: 'Comfort',
	fireplace: 'Comfort',
	balcony: 'Comfort',
	washer: 'Comfort',
	reception_24h: 'Services',
	housekeeping_daily: 'Services',
	airport_shuttle: 'Services',
	security_24h: 'Services',
	shop_on_site: 'Services',
	pet_friendly: 'Services',
	tv: 'Services'
};

export const AMENITY_OPTIONS: { key: string; label: string }[] = [
	{ key: 'wifi', label: 'Wi-Fi' },
	{ key: 'smart_tv', label: 'Smart TV' },
	{ key: 'work_desk', label: 'Work Desk' },
	{ key: 'workspace', label: 'Workspace' },
	{ key: 'breakfast', label: 'Breakfast' },
	{ key: 'restaurant_on_site', label: 'Restaurant' },
	{ key: 'coffee_machine', label: 'Coffee Machine' },
	{ key: 'minibar', label: 'Minibar' },
	{ key: 'kitchen', label: 'Kitchen' },
	{ key: 'pool', label: 'Pool' },
	{ key: 'gym', label: 'Gym' },
	{ key: 'spa', label: 'Spa' },
	{ key: 'sauna', label: 'Sauna' },
	{ key: 'hot_tub', label: 'Hot Tub' },
	{ key: 'fitness_centre', label: 'Fitness Centre' },
	{ key: 'ac', label: 'Air Conditioning' },
	{ key: 'heating', label: 'Heating' },
	{ key: 'laundry', label: 'Laundry' },
	{ key: 'parking', label: 'Parking' },
	{ key: 'elevator', label: 'Elevator' },
	{ key: 'accessible', label: 'Wheelchair Accessible' },
	{ key: 'reception_24h', label: '24/7 Reception' },
	{ key: 'housekeeping_daily', label: 'Daily Housekeeping' },
	{ key: 'airport_shuttle', label: 'Airport Shuttle' },
	{ key: 'security_24h', label: '24/7 Security' },
	{ key: 'shop_on_site', label: 'Shop On-Site' },
	{ key: 'pet_friendly', label: 'Pet Friendly' },
	{ key: 'tv', label: 'TV' },
	{ key: 'fireplace', label: 'Fireplace' },
	{ key: 'balcony', label: 'Balcony' }
];

export const CAR_CATEGORIES = [
	'Economy',
	'Compact',
	'SUV',
	'Minivan',
	'Pickup',
	'Luxury',
	'Electric',
	'Convertible'
];

export interface FilterState {
	priceMax: number;
	rating: number | null;
	amenities: string[];
	cancellation: string;
	minStay: number | null;
	smokingAllowed: boolean;
	petsAllowed: boolean;
	bedrooms: number | null;
	bathrooms: number | null;
	longStayDiscount: boolean;
	carCategory: string;
	transmission: string;
	fuelType: string;
	seats: number | null;
	minDriverAge: number | null;
	airportPickup: boolean;
	deliveryAvailable: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
	priceMax: 500000,
	rating: null,
	amenities: [],
	cancellation: '',
	minStay: null,
	smokingAllowed: false,
	petsAllowed: false,
	bedrooms: null,
	bathrooms: null,
	longStayDiscount: false,
	carCategory: '',
	transmission: '',
	fuelType: '',
	seats: null,
	minDriverAge: null,
	airportPickup: false,
	deliveryAvailable: false
};

export function countActiveFilters(f: FilterState): number {
	let n = 0;
	if (f.priceMax < 500000) n++;
	if (f.rating) n++;
	if (f.amenities.length) n++;
	if (f.cancellation) n++;
	if (f.minStay) n++;
	if (f.smokingAllowed) n++;
	if (f.petsAllowed) n++;
	if (f.bedrooms) n++;
	if (f.bathrooms) n++;
	if (f.longStayDiscount) n++;
	if (f.carCategory) n++;
	if (f.transmission) n++;
	if (f.fuelType) n++;
	if (f.seats) n++;
	if (f.minDriverAge) n++;
	if (f.airportPickup) n++;
	if (f.deliveryAvailable) n++;
	return n;
}
