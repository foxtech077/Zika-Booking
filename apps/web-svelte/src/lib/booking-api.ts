import { LISTING_API_URL } from '$lib/config';
import {
	getToken,
	setToken,
	clearToken,
	isAnonymousTokenValid,
	hasAccountToken,
	apiRequest,
	requestAnonymousToken,
	type ApiError
} from '$lib/http';

export type { ApiError };

export interface PricingPreview {
	units: number;
	baseAmount: number;
	nightlyRate?: number;
	dailyRate?: number;
	promotionDiscount: number;
	voucherDiscount: number;
	serviceFee: number;
	taxAmount: number;
	deliveryFee: number;
	securityDeposit: number;
	totalAmount: number;
	currency: string;
	commissionRate?: number;
	taxRate?: number;
	platformCurrency?: string;
	platformAmount?: number;
	platformRate?: number;
	bufferApplied?: boolean;
	listingCurrencyAmount?: number;
	localizedCurrency?: string | null;
	localizedBaseAmount?: number | null;
	localizedNightlyRate?: number | null;
	localizedPromotionDiscount?: number | null;
	localizedVoucherDiscount?: number | null;
	localizedServiceFee?: number | null;
	localizedTaxAmount?: number | null;
	localizedDeliveryFee?: number | null;
	localizedSecurityDeposit?: number | null;
	localizedTotalAmount?: number | null;
	roomType?: string;
	roomTypeName?: string;
}

export interface InitiateResult {
	lockToken: string;
	expiresAt: string;
	resumed: boolean;
	pricingPreview: PricingPreview;
}

export interface CreateBookingResult {
	bookingId: string;
	bookingReference: string;
	totalAmount: number;
	currency: string;
	status: string;
	voucherDiscount?: number;
	pointsDiscount?: number;
}

export interface VoucherValidation {
	valid: boolean;
	discountAmount: number;
	voucherDiscount: number;
	message: string;
	voucher?: {
		code: string;
		discountType: 'percentage' | 'fixed';
		discountValue: number;
		maxDiscount: number | null;
		validUntil: string;
	} | null;
}

export function getStoredToken(): string | null {
	return getToken();
}

export function storeToken(token: string): void {
	setToken(token);
}

export function removeToken(): void {
	clearToken();
}

/** Re-export for existing consumers that cleared tokens directly. */
export { clearToken };

/**
 * Ensures a valid token exists for a checkout session.
 *
 * A logged-in user keeps their account token — using it for the lock/booking
 * is what attaches the booking to their real account (the listing service
 * derives guestId from the JWT). A guest reuses a valid anonymous token or
 * mints a fresh one (same stable sub).
 */
export async function ensureAnonymousToken(): Promise<string> {
	const existing = getToken();
	if (hasAccountToken(existing)) return existing!;
	if (isAnonymousTokenValid(existing)) return existing!;
	clearToken();
	const { accessToken } = await requestAnonymousToken();
	return accessToken;
}

export interface InitiateBookingInput {
	listingId: string;
	roomTypeId?: string;
	checkIn?: string;
	checkOut?: string;
	pickupDatetime?: string;
	returnDatetime?: string;
	guests?: number;
	deliveryRequested?: boolean;
	deliveryAddress?: string;
	currency?: string;
}

export async function initiateBooking(input: InitiateBookingInput): Promise<InitiateResult> {
	return apiRequest<InitiateResult>(LISTING_API_URL, '/bookings/initiate', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export interface CreateBookingInput {
	lockToken: string;
	listingId: string;
	roomTypeId?: string;
	checkIn?: string;
	checkOut?: string;
	pickupDatetime?: string;
	returnDatetime?: string;
	guestFirstName: string;
	guestLastName: string;
	guestEmail: string;
	guestPhone?: string;
	adults?: number;
	children?: number;
	specialRequests?: string;
	driverFirstName?: string;
	driverLastName?: string;
	driverAge?: number;
	deliveryRequested?: boolean;
	deliveryAddress?: string;
	voucherCode?: string;
	currency?: string;
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
	return apiRequest<CreateBookingResult>(LISTING_API_URL, '/bookings', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function renewLock(lockToken: string): Promise<{ expiresAt: string }> {
	return apiRequest<{ expiresAt: string }>(LISTING_API_URL, '/bookings/lock/renew', {
		method: 'POST',
		body: JSON.stringify({ lockToken })
	});
}

export async function releaseLock(lockToken: string): Promise<void> {
	try {
		await apiRequest<null>(LISTING_API_URL, `/bookings/lock/${encodeURIComponent(lockToken)}`, {
			method: 'DELETE'
		});
	} catch {
		// best-effort — the lock expires on its own anyway
	}
}

export interface ValidateVoucherInput {
	code: string;
	totalAmount: number;
	activity: 'hotels' | 'apartments' | 'cars' | 'hotels_apartments' | 'universal';
	guestId: string;
	guestTier?: string;
	guestCountry?: string;
}

export async function validateVoucher(input: ValidateVoucherInput): Promise<VoucherValidation> {
	return apiRequest<VoucherValidation>(LISTING_API_URL, '/vouchers/validate', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}
