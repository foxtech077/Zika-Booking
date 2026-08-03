import { browser } from '$app/environment';
import { AUTH_API_URL, LISTING_API_URL } from '$lib/config';

const TOKEN_KEY = 'kainook:access_token';
const DEVICE_ID_KEY = 'kainook:device_id';
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

export function clearToken(): void {
	if (!browser) return;
	try {
		sessionStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(TOKEN_KEY);
	} catch {
		// ignore storage errors
	}
}

/** Best-effort JWT payload decode (client-side, no signature verification). */
function decodeJwtPayload(token: string): { exp?: number; type?: string; sub?: string } | null {
	if (typeof atob !== 'function') return null;
	try {
		const parts = token.split('.');
		if (parts.length < 2) return null;
		const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
		return JSON.parse(json) as { exp?: number; type?: string; sub?: string };
	} catch {
		return null;
	}
}

/** True when the token is missing, malformed, not anonymous, or past its exp. */
export function isAnonymousTokenValid(token: string | null | undefined): boolean {
	if (!token) return false;
	const payload = decodeJwtPayload(token);
	if (!payload || payload.type !== 'anonymous' || !payload.exp) return false;
	return payload.exp * 1000 > Date.now();
}

/** Returns a stable device id so re-minted anonymous tokens keep the same sub. */
function getOrCreateDeviceId(): string {
	if (!browser) return '';
	try {
		let id = localStorage.getItem(DEVICE_ID_KEY);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(DEVICE_ID_KEY, id);
		}
		return id;
	} catch {
		return '';
	}
}

type RequestInitWithRetry = RequestInit & { _retried?: boolean };

async function request<T>(url: string, init: RequestInitWithRetry = {}): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...(init.headers as Record<string, string> | undefined)
		};
		// Only advertise a JSON body when one is actually sent — a body-less
		// request (e.g. DELETE lock) with Content-Type set fails Fastify with
		// FST_ERR_CTP_EMPTY_JSON_BODY.
		if (init.body) headers['Content-Type'] = 'application/json';
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
			// An expired/invalid anonymous token trips 401 on protected endpoints.
			// Mint a fresh anonymous token (same stable sub) and retry once —
			// never on the token-mint endpoint itself, and never twice.
			if (res.status === 401 && !init._retried && !url.includes('/auth/anonymous-token')) {
				clearToken();
				const { accessToken } = await requestAnonymousToken();
				if (accessToken) {
					init._retried = true;
					return request<T>(url, init);
				}
			}
			throw err;
		}
		return json.data as T;
	} finally {
		clearTimeout(timer);
	}
}

/** Mints a stateless anonymous access token for checkout (no sign-in). */
export async function requestAnonymousToken(): Promise<{ accessToken: string; expiresIn: number }> {
	const deviceId = getOrCreateDeviceId();
	const data = await request<{ accessToken: string; expiresIn: number }>(
		`${AUTH_API_URL}/auth/anonymous-token`,
		{
			method: 'POST',
			body: JSON.stringify(deviceId ? { deviceId } : {})
		}
	);
	setToken(data.accessToken);
	return data;
}

/**
 * Ensures a valid anonymous token exists. Reuses the stored token when it is
 * still valid; otherwise discards it and mints a fresh one (same stable sub).
 */
export async function ensureAnonymousToken(): Promise<string> {
	const existing = getToken();
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
