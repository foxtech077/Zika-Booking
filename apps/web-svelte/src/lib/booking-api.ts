import { browser } from '$app/environment';
import { AUTH_API_URL, LISTING_API_URL } from '$lib/config';

const TOKEN_KEY = 'kainook:access_token';
const REQUEST_TIMEOUT_MS = 12_000;

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

export function getToken(): string | null {
	if (!browser) return null;
	try {
		return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

function setToken(token: string): void {
	if (!browser) return;
	try {
		sessionStorage.setItem(TOKEN_KEY, token);
		localStorage.setItem(TOKEN_KEY, token);
	} catch {
		// ignore storage errors
	}
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			...(init.headers as Record<string, string> | undefined)
		};
		const token = getToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(url, { ...init, headers, signal: controller.signal });
		const json = (await res.json().catch(() => ({}))) as {
			success?: boolean;
			data?: unknown;
			error?: { code?: string; message?: string };
		};
		if (!res.ok || json?.success === false) {
			const code = json?.error?.code;
			const message = json?.error?.message ?? `Request failed (${res.status})`;
			const err = new Error(message) as Error & { code?: string; status?: number };
			err.code = code;
			err.status = res.status;
			throw err;
		}
		return json.data as T;
	} finally {
		clearTimeout(timer);
	}
}

/** Mints a stateless guest access token for anonymous checkout (no sign-in). */
export async function requestGuestToken(
	deviceId?: string
): Promise<{ accessToken: string; expiresIn: number }> {
	const data = await request<{ accessToken: string; expiresIn: number }>(
		`${AUTH_API_URL}/auth/guest-token`,
		{
			method: 'POST',
			body: JSON.stringify(deviceId ? { deviceId } : {})
		}
	);
	setToken(data.accessToken);
	return data;
}

/** Ensures a token exists (reuses an existing one; otherwise mints a guest token). */
export async function ensureGuestToken(): Promise<string> {
	const existing = getToken();
	if (existing) return existing;
	const { accessToken } = await requestGuestToken();
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
	currency?: string;
}

export async function initiateBooking(input: InitiateBookingInput): Promise<InitiateResult> {
	return request<InitiateResult>(`${LISTING_API_URL}/bookings/initiate`, {
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
	return request<CreateBookingResult>(`${LISTING_API_URL}/bookings`, {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function renewLock(lockToken: string): Promise<{ expiresAt: string }> {
	return request<{ expiresAt: string }>(`${LISTING_API_URL}/bookings/lock/renew`, {
		method: 'POST',
		body: JSON.stringify({ lockToken })
	});
}

export async function releaseLock(lockToken: string): Promise<void> {
	try {
		await request<null>(`${LISTING_API_URL}/bookings/lock/${encodeURIComponent(lockToken)}`, {
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
	return request<VoucherValidation>(`${LISTING_API_URL}/vouchers/validate`, {
		method: 'POST',
		body: JSON.stringify(input)
	});
}
