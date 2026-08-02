import { GLOBAL_RADIUS_KM, AMENITY_CATEGORY } from '$lib/listing-meta';

export type ListingCategory = 'hotel' | 'apartment' | 'car';

export interface PublicListing {
	id: string;
	providerId?: string;
	category: ListingCategory;
	name: string;
	pricePerNight: number;
	currency: string;
	town: string;
	country: string;
	primaryPhotoUrl: string | null;
	description?: string;
}

export interface ListingPhoto {
	id: string;
	cdnUrl: string;
	position?: number;
}

export interface PublicListingDetail extends PublicListing {
	minStayNights: number;
	checkinTime: string;
	checkoutTime: string;
	cancellationPolicy: string;
	address: string;
	lat?: number;
	lng?: number;
	neighborhood?: string;
	starRating?: number;
	maxGuests?: number;
	bedrooms?: number;
	bathrooms?: number;
	carMake?: string;
	carModel?: string;
	carYear?: number;
	transmission?: string;
	fuelType?: string;
	seats?: number;
	mileagePolicy?: string;
	deliveryAvailable?: boolean;
	deliveryFee?: number | null;
	deliveryRadiusKm?: number | null;
	photos: ListingPhoto[];
	amenities: string[];
	description: string;
	distanceKm?: number;
	isFavourited?: boolean;
	isAccredited?: boolean;
	longStayDiscountEnabled?: boolean;
	mrpPrice?: number;
	instantBooking?: boolean;
	commissionRate?: number;
	driverProvided?: boolean;
	securityDeposit?: number | null;
	allowPreBooking?: boolean;
	roomTypes?: ListingRoomType[];
	localizedNightlyRate?: number;
	localizedDailyRate?: number;
	localizedCurrency?: string;
}

export interface ListingRoomType {
	id: string;
	name: string;
	roomType?: string;
	pricePerNight: number;
	unitCount?: number;
	maxGuests?: number;
	localizedPricePerNight?: number;
}

export interface AvailabilityRange {
	start: string;
	end: string;
}

export interface ListingReview {
	id: string;
	guestId: string;
	rating: number;
	title: string | null;
	body: string | null;
	providerReply: string | null;
	providerRepliedAt: string | null;
	createdAt: string;
}

export interface ListingReviewsResult {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	averageRating: number | null;
	reviews: ListingReview[];
}

export interface ActivePromotion {
	id: string;
	name: string;
	discountType: 'percentage' | 'fixed';
	discountValue: number;
	description?: string;
	category?: string;
	activity?: string;
	labelText?: string;
	labelColour?: string;
	bannerTitle?: string;
	bannerSubtitle?: string;
	validFrom?: string;
	validUntil?: string;
	status?: string;
	applyToBooking?: boolean;
}

export function isPromotionValid(promotion: ActivePromotion | null | undefined): boolean {
	if (!promotion || promotion.status !== 'active') return false;
	const now = new Date();
	const from = promotion.validFrom ? new Date(promotion.validFrom) : null;
	const until = promotion.validUntil ? new Date(promotion.validUntil) : null;
	if (from && now < from) return false;
	if (until && now > until) return false;
	return true;
}

/** Normalises a raw /search result from the listing service into the shape the UI expects. */
export function mapSearchResult(
	l: Record<string, unknown> | null | undefined
): PublicListing | null {
	if (!l) return null;

	const town = (l.town ?? l.city ?? '') as string;
	const country = (l.country ?? l.countryCode ?? '') as string;
	const rawRoomTypes = Array.isArray(l.hotelRoomTypes)
		? (l.hotelRoomTypes as Record<string, unknown>[])
		: Array.isArray(l.roomTypes)
			? (l.roomTypes as Record<string, unknown>[])
			: [];

	let basePrice = Number(l.pricePerNight ?? l.nightlyRate ?? l.pricePerDay ?? l.dailyRate ?? 0);
	if ((l.category === 'hotel' || l.listingType === 'hotel') && rawRoomTypes.length > 0) {
		const activeRts = rawRoomTypes.filter((rt) => rt.isActive !== false);
		if (activeRts.length > 0) {
			const prices = activeRts
				.map((rt) => Number(rt.pricePerNight))
				.filter((p: number) => !isNaN(p) && p > 0);
			if (prices.length > 0) basePrice = Math.min(...prices);
		}
	}

	const photos = Array.isArray(l.photos) ? (l.photos as Record<string, unknown>[]) : [];
	return {
		id: l.id as string,
		providerId: l.providerId as string | undefined,
		category: (l.category ?? l.listingType) as ListingCategory,
		name: (l.name ?? l.title ?? '') as string,
		pricePerNight: basePrice,
		currency: (l.currency ?? 'KES') as string,
		town,
		country,
		primaryPhotoUrl: (l.primaryPhotoUrl ?? photos[0]?.cdnUrl ?? null) as string | null,
		description: (l.description ?? '') as string
	};
}

/** Normalises a raw /search result into the richer shape the listings pages need. */
export function mapListingDetail(
	l: Record<string, unknown> | null | undefined
): PublicListingDetail | null {
	const base = mapSearchResult(l);
	if (!base) return null;

	const photos = Array.isArray(l?.photos) ? ((l?.photos as Record<string, unknown>[]) ?? []) : [];
	const rawAmenities = Array.isArray(l?.amenities) ? (l?.amenities as unknown[]) : [];
	const rawRoomTypes = Array.isArray(l?.hotelRoomTypes)
		? (l?.hotelRoomTypes as Record<string, unknown>[])
		: Array.isArray(l?.roomTypes)
			? (l?.roomTypes as Record<string, unknown>[])
			: [];

	return {
		...base,
		minStayNights: Number(l?.minStayNights ?? 1),
		checkinTime: (l?.checkinTime ?? '') as string,
		checkoutTime: (l?.checkoutTime ?? '') as string,
		cancellationPolicy: (l?.cancellationPolicy ?? 'flexible') as string,
		address: (l?.address ?? [base.town, base.country].filter(Boolean).join(', ')) as string,
		lat: l?.lat != null ? Number(l.lat) : undefined,
		lng: l?.lng != null ? Number(l.lng) : undefined,
		neighborhood: l?.neighborhood as string | undefined,
		starRating: l?.starRating != null ? Number(l.starRating) : undefined,
		maxGuests: l?.maxGuests != null ? Number(l.maxGuests) : undefined,
		bedrooms: l?.bedrooms != null ? Number(l.bedrooms) : undefined,
		bathrooms: l?.bathrooms != null ? Number(l.bathrooms) : undefined,
		carMake: l?.carMake as string | undefined,
		carModel: l?.carModel as string | undefined,
		carYear: l?.carYear != null ? Number(l.carYear) : undefined,
		transmission: l?.transmission as string | undefined,
		fuelType: l?.fuelType as string | undefined,
		seats: l?.seats != null ? Number(l.seats) : undefined,
		mileagePolicy: l?.mileagePolicy as string | undefined,
		deliveryAvailable: !!l?.deliveryEnabled,
		deliveryFee: l?.deliveryFee != null ? Number(l.deliveryFee) : null,
		deliveryRadiusKm: l?.deliveryRadiusKm != null ? Number(l.deliveryRadiusKm) : null,
		photos: photos.map((p) => ({
			id: (p.id ?? '') as string,
			cdnUrl: (p.cdnUrl ?? p.url ?? '') as string
		})),
		amenities: rawAmenities
			.map((a) =>
				typeof a === 'string'
					? a
					: String(
							(a as Record<string, unknown>).amenityKey ?? (a as Record<string, unknown>).key ?? ''
						)
			)
			.filter(Boolean),
		description: (l?.description ?? '') as string,
		distanceKm: l?.distanceKm != null ? Number(l.distanceKm) : undefined,
		isFavourited: !!l?.isFavourited,
		isAccredited: !!l?.isAccredited,
		longStayDiscountEnabled: !!l?.longStayDiscountEnabled,
		mrpPrice: l?.mrpPrice != null ? Number(l.mrpPrice) : undefined,
		instantBooking: !!(l?.instantBooking ?? l?.instant_booking),
		commissionRate: l?.commissionRate != null ? Number(l.commissionRate) : undefined,
		driverProvided: l?.driverProvided != null ? !!l.driverProvided : undefined,
		securityDeposit: l?.securityDeposit != null ? Number(l.securityDeposit) : null,
		allowPreBooking: l?.allowPreBooking != null ? !!l.allowPreBooking : undefined,
		roomTypes: rawRoomTypes.map((rt) => ({
			id: (rt.id ?? '') as string,
			name: (rt.name ?? '') as string,
			roomType: (rt.roomType ?? rt.roomTypeId) as string | undefined,
			pricePerNight: Number(rt.pricePerNight ?? 0),
			unitCount: rt.unitCount != null ? Number(rt.unitCount) : undefined,
			maxGuests: rt.maxGuests != null ? Number(rt.maxGuests) : undefined,
			localizedPricePerNight:
				rt.localizedPricePerNight != null ? Number(rt.localizedPricePerNight) : undefined
		})),
		localizedNightlyRate:
			l?.localizedNightlyRate != null ? Number(l.localizedNightlyRate) : undefined,
		localizedDailyRate: l?.localizedDailyRate != null ? Number(l.localizedDailyRate) : undefined,
		localizedCurrency: l?.localizedCurrency as string | undefined
	};
}

export async function searchListings(
	fetchFn: typeof fetch,
	params: Record<string, string | number>,
	apiUrl: string
): Promise<PublicListing[]> {
	const { results } = await searchListingsDetail(fetchFn, params, apiUrl);
	return results;
}

/** Fetches a page of listings from the listing service with the given query params. */
export async function searchListingsDetail(
	fetchFn: typeof fetch,
	params: Record<string, string | number | boolean>,
	apiUrl: string
): Promise<{ results: PublicListingDetail[]; totalCount: number }> {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetchFn(`${apiUrl}/search?${query.toString()}`, {
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});
		if (!res.ok) return { results: [], totalCount: 0 };

		const json = (await res.json()) as { data?: Record<string, unknown> | unknown[] };
		const data = json?.data;
		const results = Array.isArray(data)
			? (data as Record<string, unknown>[])
			: Array.isArray((data as Record<string, unknown>)?.results)
				? ((data as Record<string, unknown>).results as Record<string, unknown>[])
				: [];
		const totalCount = Number(
			(data as Record<string, unknown>)?.totalCount ??
				(data as Record<string, unknown>)?.availableCount ??
				results.length
		);

		return {
			results: results.map(mapListingDetail).filter((l): l is PublicListingDetail => l !== null),
			totalCount
		};
	} finally {
		clearTimeout(timer);
	}
}

const REQUEST_TIMEOUT_MS = 12_000;

/** Fetches the currently active promotion for a category, if any. */
export async function fetchActivePromotion(
	fetchFn: typeof fetch,
	category: ListingCategory,
	apiUrl: string
): Promise<ActivePromotion | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetchFn(
			`${apiUrl}/promotions/active?category=${encodeURIComponent(category)}`,
			{
				headers: { Accept: 'application/json' },
				signal: controller.signal
			}
		);
		if (!res.ok) return null;
		const json = (await res.json()) as { success?: boolean; data?: unknown };
		if (!json?.success) return null;
		const raw = json.data;
		const promos = Array.isArray(raw)
			? (raw as Record<string, unknown>[])
			: Array.isArray((raw as Record<string, unknown> | null)?.promotions)
				? ((raw as Record<string, unknown>).promotions as unknown[] as Record<string, unknown>[])
				: [];
		const normalized = promos.map((p) => ({
			...p,
			discountValue: Number(p.discountValue)
		})) as unknown as ActivePromotion[];
		const matched = normalized.filter((p) => p.activity === category && isPromotionValid(p));
		return matched[0] ?? null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Fetches the public detail for a single listing, normalised for the UI. */
export async function fetchListingDetail(
	fetchFn: typeof fetch,
	id: string,
	apiUrl: string,
	currency?: string
): Promise<PublicListingDetail | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const query = new URLSearchParams();
		if (currency) query.set('currency', currency);
		const qs = query.toString();
		const res = await fetchFn(
			`${apiUrl}/listings/${encodeURIComponent(id)}/public${qs ? `?${qs}` : ''}`,
			{
				headers: { Accept: 'application/json' },
				signal: controller.signal
			}
		);
		if (!res.ok) return null;
		const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
		if (!json?.success) return null;
		return mapListingDetail(json.data);
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export interface ListingAvailability {
	roomTypeAvailability?: {
		roomTypeId: string;
		roomType: string | null;
		name: string;
		unitCount: number;
		unavailableRanges: AvailabilityRange[];
	}[];
	unavailableRanges: AvailabilityRange[];
}

/** Fetches unavailable date ranges for a listing over the given window. */
export async function fetchListingAvailability(
	fetchFn: typeof fetch,
	id: string,
	apiUrl: string,
	start: string,
	end: string
): Promise<ListingAvailability | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const query = new URLSearchParams({ start, end });
		const res = await fetchFn(
			`${apiUrl}/listings/${encodeURIComponent(id)}/availability?${query.toString()}`,
			{
				headers: { Accept: 'application/json' },
				signal: controller.signal
			}
		);
		if (!res.ok) return null;
		const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
		if (!json?.success) return null;
		const data = json.data;
		const roomTypeAvailability = Array.isArray(data?.roomTypeAvailability)
			? (data.roomTypeAvailability as Record<string, unknown>[]).map((rt) => ({
					roomTypeId: (rt.roomTypeId ?? '') as string,
					roomType: (rt.roomType ?? null) as string | null,
					name: (rt.name ?? '') as string,
					unitCount: Number(rt.unitCount ?? 1),
					unavailableRanges: (Array.isArray(rt.unavailableRanges)
						? rt.unavailableRanges
						: []) as AvailabilityRange[]
				}))
			: undefined;
		return {
			roomTypeAvailability,
			unavailableRanges: (Array.isArray(data?.unavailableRanges)
				? (data.unavailableRanges as AvailabilityRange[])
				: []) as AvailabilityRange[]
		};
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Fetches the public reviews for a listing. */
export async function fetchListingReviews(
	fetchFn: typeof fetch,
	id: string,
	apiUrl: string
): Promise<ListingReviewsResult | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetchFn(`${apiUrl}/listings/${encodeURIComponent(id)}/reviews?limit=10`, {
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { success?: boolean; data?: ListingReviewsResult };
		if (!json?.success) return null;
		return json.data ?? null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** True when the given date range overlaps any of the unavailable ranges. */
export function isRangeAvailable(
	ranges: AvailabilityRange[] | null | undefined,
	start: string,
	end: string
): boolean {
	if (!ranges || ranges.length === 0) return true;
	const s = new Date(start).getTime();
	const e = new Date(end).getTime();
	return !ranges.some((r) => {
		const rs = new Date(r.start).getTime();
		const re = new Date(r.end).getTime();
		return s < re && e > rs;
	});
}

/** Normalised search criteria shared by the SSR loader and the client-side fetches. */
export interface SearchState {
	category: ListingCategory;
	q?: string;
	checkIn?: string;
	checkOut?: string;
	pickupDate?: string;
	returnDate?: string;
	guests?: number;
	sort: string;
	priceMax?: number;
	rating?: number;
	amenities: string[];
	cancellation?: string;
	minStay?: number;
	transmission?: string;
	fuelType?: string;
	carCategory?: string;
	seats?: number;
	minDriverAge?: number;
	bedrooms?: number;
	bathrooms?: number;
	smokingAllowed?: boolean;
	petsAllowed?: boolean;
	deliveryAvailable?: boolean;
	longStayDiscount?: boolean;
	currency?: string;
	cursor: number;
	limit: number;
	lat: number;
	lng: number;
}

function expandAmenities(keys: string[]): string {
	return keys
		.flatMap((k) => {
			const cat = AMENITY_CATEGORY[k];
			return cat ? [`${cat}:${k}`, k] : [k];
		})
		.join(',');
}

/** Converts a SearchState into the query params the listing API understands. */
export function buildSearchApiParams(s: SearchState): Record<string, string | number | boolean> {
	const p: Record<string, string | number | boolean> = {
		category: s.category,
		limit: s.limit,
		cursor: s.cursor,
		lat: s.lat,
		lng: s.lng,
		radius_km: GLOBAL_RADIUS_KM,
		sort: s.sort
	};

	if (s.q) p.q = s.q;
	if (s.guests && s.guests > 1) p.guests = s.guests;
	if (s.priceMax && s.priceMax < 500000) p.price_max = s.priceMax;
	if (s.rating) p.rating_min = s.rating;
	if (s.amenities.length) p.amenity_ids = expandAmenities(s.amenities);
	if (s.cancellation) p.cancellation_policy = s.cancellation;
	if (s.minStay) p.min_stay_nights = s.minStay;
	if (s.transmission) p.transmission = s.transmission;
	if (s.fuelType) p.fuel_type = s.fuelType;
	if (s.carCategory) p.car_category = s.carCategory.toLowerCase();
	if (s.seats) p.seats_min = s.seats;
	if (s.minDriverAge) p.driver_age = s.minDriverAge;
	if (s.bedrooms) p.bedrooms_min = s.bedrooms;
	if (s.bathrooms) p.bathrooms_min = s.bathrooms;
	if (s.smokingAllowed) p.smoking_allowed = true;
	if (s.petsAllowed) p.pets_allowed = true;
	if (s.deliveryAvailable) p.delivery = true;
	if (s.longStayDiscount) p.long_stay_discount = true;
	if (s.currency) p.currency = s.currency;

	if (s.category === 'car') {
		if (s.pickupDate) p.pickup_datetime = s.pickupDate;
		if (s.returnDate) p.return_datetime = s.returnDate;
	} else {
		if (s.checkIn) p.check_in = s.checkIn;
		if (s.checkOut) p.check_out = s.checkOut;
	}

	return p;
}

const KNOWN_DESTINATIONS: Record<string, [number, number]> = {
	nairobi: [-1.2921, 36.8219],
	kenya: [-1.2921, 36.8219],
	mombasa: [-3.982, 39.726],
	dubai: [25.2048, 55.2708],
	'cape town': [-33.9249, 18.4241],
	zanzibar: [-6.1659, 39.2026],
	kampala: [0.3476, 32.5825],
	kigali: [-1.9441, 30.0619],
	'dar es salaam': [-6.7924, 39.2083],
	lagos: [6.5244, 3.3792],
	accra: [5.6037, -0.187]
};

/** Resolves a free-text destination to coordinates, with a curated shortcut list + Nominatim. */
export async function geocodeDestination(q: string): Promise<{ lat: number; lng: number }> {
	const lower = q.toLowerCase();
	for (const [key, [lat, lng]] of Object.entries(KNOWN_DESTINATIONS)) {
		if (lower.includes(key)) return { lat, lng };
	}
	try {
		const r = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`,
			{ headers: { 'Accept-Language': 'en', 'User-Agent': 'Kainook/1.0' } }
		);
		const d = (await r.json()) as Array<{ lat: string; lon: string }>;
		if (d?.[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
	} catch {
		// fall through to the default
	}
	return { lat: -1.2921, lng: 36.8219 };
}
