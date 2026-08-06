import { LISTING_API_URL, PAYMENT_API_URL } from '$lib/config';
import { apiRequest } from '$lib/http';

/**
 * Provider dashboard API — listings, bookings, reviews, earnings, payouts and
 * merchant/Stripe Connect against the listing and payment services. All
 * endpoints require the account access token (the shared helper attaches +
 * refreshes it).
 */

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface ProviderDashboardBooking {
	id: string;
	reference: string;
	listingTitle: string;
	listingCategory: string;
	guestName: string;
	guestEmail: string;
	checkIn: string | null;
	checkOut: string | null;
	pickupDatetime: string | null;
	returnDatetime: string | null;
	totalAmount: number;
	providerPayout: number;
	currency: string;
	status: string;
	createdAt: string;
}

export interface ProviderDashboard {
	totalEarnings: number;
	thisMonthEarnings: number;
	activeListingsCount: number;
	pendingBookingsCount: number;
	completedBookingsCount: number;
	unreadMessages: number;
	pendingReviews: number;
	recentBookings: ProviderDashboardBooking[];
	monthlyRevenue: { month: string; revenue: number; bookings: number }[];
}

export async function getProviderDashboard(): Promise<ProviderDashboard> {
	const data = await apiRequest<ProviderDashboard>(LISTING_API_URL, '/provider/dashboard');
	return data;
}

// ── Listings ─────────────────────────────────────────────────────────────────

export interface ProviderListing {
	id: string;
	name: string;
	category: string;
	status: string;
	bookingCount: number;
	totalRevenue: number;
	currency: string;
	averageRating: number | null;
	reviewCount: number;
}

export interface ProviderListingDetail {
	id: string;
	name: string;
	category: string;
	status: string;
	town: string;
	country: string;
	pricePerNight: number;
	currency: string;
	description: string;
	primaryPhotoUrl: string | null;
}

/** Blank-draft create — the provider then fills in the details via edit. */
export async function createListing(category: 'hotel' | 'apartment' | 'car'): Promise<{ id: string }> {
	const data = await apiRequest<{ id: string; category: string; status: string }>(
		LISTING_API_URL,
		'/listings',
		{ method: 'POST', body: JSON.stringify({ category }) }
	);
	return data;
}

export async function getProviderListings(): Promise<ProviderListing[]> {
	const data = await apiRequest<{ listings?: unknown }>(LISTING_API_URL, '/listings?limit=100');
	if (!Array.isArray(data?.listings)) return [];
	return data.listings as ProviderListing[];
}

export async function getProviderListing(id: string): Promise<ProviderListingDetail | null> {
	try {
		const data = await apiRequest<ProviderListingDetail>(
			LISTING_API_URL,
			`/listings/${encodeURIComponent(id)}`
		);
		return data;
	} catch {
		return null;
	}
}

export async function updateListing(
	id: string,
	patch: Record<string, unknown>
): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/listings/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
}

export async function activateListing(id: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/listings/${encodeURIComponent(id)}/activate`, {
		method: 'POST',
		body: JSON.stringify({})
	});
}

export async function deactivateListing(id: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/listings/${encodeURIComponent(id)}/deactivate`, {
		method: 'POST',
		body: JSON.stringify({})
	});
}

export async function deleteListing(id: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/listings/${encodeURIComponent(id)}`, {
		method: 'DELETE'
	});
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export interface ProviderBooking {
	id: string;
	reference: string;
	listingTitle: string;
	listingCategory: string;
	guestFirstName: string;
	guestLastName: string;
	guestEmail: string;
	guestPhone: string | null;
	adults: number | null;
	children: number | null;
	checkIn: string | null;
	checkOut: string | null;
	pickupDatetime: string | null;
	returnDatetime: string | null;
	nightsOrDays: number;
	totalAmount: number;
	providerPayout: number;
	commissionAmount: number;
	currency: string;
	status: string;
	cancellationPolicy: string;
	specialRequests: string | null;
	confirmedAt: string | null;
	cancelledAt: string | null;
	createdAt: string;
}

export interface ProviderBookingsResult {
	total: number;
	offset: number;
	limit: number;
	bookings: ProviderBooking[];
}

export async function getProviderBookings(
	params: { offset?: number; limit?: number; status?: string; search?: string } = {}
): Promise<ProviderBookingsResult> {
	const query = new URLSearchParams();
	if (params.offset != null) query.set('offset', String(params.offset));
	if (params.limit != null) query.set('limit', String(params.limit));
	if (params.status && params.status !== 'all') query.set('status', params.status);
	if (params.search) query.set('search', params.search);
	const data = await apiRequest<ProviderBookingsResult>(
		LISTING_API_URL,
		`/provider/bookings${query.size ? `?${query.toString()}` : ''}`
	);
	return data;
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface ProviderReview {
	id: string;
	guestId: string;
	rating: number;
	title: string | null;
	body: string | null;
	providerReply: string | null;
	providerRepliedAt: string | null;
	createdAt: string;
	listingName: string;
	isHidden: boolean;
}

export async function getProviderReviews(
	params: { offset?: number; limit?: number; rating?: number; replied?: string } = {}
): Promise<{ total: number; reviews: ProviderReview[] }> {
	const query = new URLSearchParams();
	if (params.offset != null) query.set('offset', String(params.offset));
	if (params.limit != null) query.set('limit', String(params.limit));
	if (params.rating) query.set('rating', String(params.rating));
	if (params.replied) query.set('replied', params.replied);
	const data = await apiRequest<{ total?: number; reviews?: unknown }>(
		LISTING_API_URL,
		`/provider/reviews${query.size ? `?${query.toString()}` : ''}`
	);
	return {
		total: data.total ?? 0,
		reviews: (Array.isArray(data.reviews) ? data.reviews : []) as ProviderReview[]
	};
}

export async function replyToReview(reviewId: string, reply: string): Promise<void> {
	await apiRequest<unknown>(LISTING_API_URL, `/reviews/${encodeURIComponent(reviewId)}/reply`, {
		method: 'POST',
		body: JSON.stringify({ reply })
	});
}

// ── Earnings ─────────────────────────────────────────────────────────────────

export interface ProviderEarnings {
	allTime: { revenue: number; commission: number; payout: number };
	monthly: { month: string; revenue: number; commission: number; payout: number; bookings: number }[];
	recentPayouts: {
		id: string;
		reference: string;
		listingName: string;
		category: string;
		totalAmount: number;
		commission: number;
		payout: number;
		currency: string;
		status: string;
		confirmedAt: string | null;
	}[];
}

export async function getProviderEarnings(): Promise<ProviderEarnings> {
	const data = await apiRequest<ProviderEarnings>(LISTING_API_URL, '/provider/earnings');
	return data;
}

// ── Merchant / Stripe Connect (payment service) ─────────────────────────────

export interface MerchantProfile {
	id: string;
	userId: string;
	businessName: string | null;
	country: string | null;
	payoutMethod: string | null;
	stripeConnectAccountId: string | null;
	mobileMoneyNumber: string | null;
	bankName: string | null;
	bankAccountNumber: string | null;
	bankAccountName: string | null;
	verified: boolean;
}

export interface StripeConnectOnboardingResponse {
	onboardingUrl: string;
}

export interface StripeConnectStatusResponse {
	status: 'active' | 'incomplete' | 'error';
}

export async function getMerchantProfile(): Promise<MerchantProfile | null> {
	try {
		const data = await apiRequest<{ merchant?: MerchantProfile }>(PAYMENT_API_URL, '/merchant/me');
		return data.merchant ?? null;
	} catch {
		return null;
	}
}

export async function updateMerchantProfile(
	body: Partial<
		Pick<
			MerchantProfile,
			| 'businessName'
			| 'country'
			| 'payoutMethod'
			| 'mobileMoneyNumber'
			| 'bankName'
			| 'bankAccountNumber'
			| 'bankAccountName'
		>
	>
): Promise<MerchantProfile | null> {
	const data = await apiRequest<{ merchant?: MerchantProfile }>(PAYMENT_API_URL, '/merchant/me', {
		method: 'PATCH',
		body: JSON.stringify(body)
	});
	return data.merchant ?? null;
}

export async function startStripeConnect(): Promise<{ onboardingUrl: string }> {
	const data = await apiRequest<StripeConnectOnboardingResponse>(
		PAYMENT_API_URL,
		'/merchant/me/stripe/connect',
		{ method: 'POST', body: JSON.stringify({}) }
	);
	return data;
}

export async function refreshStripeConnect(): Promise<{ onboardingUrl: string }> {
	const data = await apiRequest<StripeConnectOnboardingResponse>(
		PAYMENT_API_URL,
		'/merchant/me/stripe/connect/refresh'
	);
	return data;
}

export async function getStripeConnectStatus(): Promise<StripeConnectStatusResponse | null> {
	try {
		return await apiRequest<StripeConnectStatusResponse>(
			PAYMENT_API_URL,
			'/merchant/me/stripe/connect/status'
		);
	} catch {
		return null;
	}
}

// ── Payouts (payment service) ────────────────────────────────────────────────

export interface ProviderPayout {
	id: string;
	reference?: string;
	amount: number;
	currency: string;
	status: string;
	createdAt: string;
	method?: string | null;
}

export async function getPayouts(): Promise<ProviderPayout[]> {
	try {
		const data = await apiRequest<{ data?: unknown; payouts?: unknown }>(
			PAYMENT_API_URL,
			'/provider/me/payouts'
		);
		const raw = Array.isArray(data?.payouts)
			? data.payouts
			: Array.isArray(data?.data)
				? data.data
				: [];
		return raw as ProviderPayout[];
	} catch {
		return [];
	}
}
