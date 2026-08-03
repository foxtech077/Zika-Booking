import { PAYMENT_API_URL, LISTING_API_URL } from '$lib/config';
import { getToken, clearToken, requestAnonymousToken } from '$lib/booking-api';

const REQUEST_TIMEOUT_MS = 15_000;

export interface CreateIntentResult {
	paymentId: string;
	displayId?: string;
	clientSecret: string;
	publishableKey?: string;
}

export interface InitiatePaymentResult {
	paymentId: string;
	displayId?: string;
	taraReference?: string;
	message?: string;
	requiresAction?: boolean;
	clientSecret?: string;
}

export interface PaymentStatus {
	id: string;
	displayId?: string;
	status: string;
	bookingId: string;
	amount: number;
	currency: string;
	transactionId?: string;
	capturedAt?: string | null;
}

export interface FxConvertResult {
	amount: number;
	converted: number;
	rate: number;
	from: string;
	to: string;
}

type RequestInitWithRetry = RequestInit & { _retried?: boolean };

/** Shared request helper for the payment service (and listing-service FX). */
async function request<T>(url: string, init: RequestInitWithRetry = {}): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...(init.headers as Record<string, string> | undefined)
		};
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
			// Recover from an expired/invalid anonymous token by minting a fresh
			// one (same stable sub) and retrying once.
			if (res.status === 401 && !init._retried) {
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

/** Creates a Stripe PaymentIntent for a freshly-created booking. */
export async function createPaymentIntent(bookingId: string): Promise<CreateIntentResult> {
	return request<CreateIntentResult>(`${PAYMENT_API_URL}/payments/create-intent`, {
		method: 'POST',
		body: JSON.stringify({ bookingId })
	});
}

/** Initiates a payment — Stripe saved card or Tara mobile money. */
export async function initiatePayment(input: {
	bookingId: string;
	paymentProvider: 'stripe' | 'tara';
	mobileNumber?: string;
	paymentMethodId?: string;
}): Promise<InitiatePaymentResult> {
	return request<InitiatePaymentResult>(`${PAYMENT_API_URL}/payments/initiate`, {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

/** Polls the status of a payment until captured/failed/timed out. */
export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatus> {
	return request<PaymentStatus>(
		`${PAYMENT_API_URL}/payments/${encodeURIComponent(paymentId)}/status`,
		{
			method: 'GET'
		}
	);
}

/** Cancels an abandoned Stripe payment (idempotent, best-effort). */
export async function cancelPayment(paymentId: string): Promise<void> {
	try {
		await request<null>(`${PAYMENT_API_URL}/payments/${encodeURIComponent(paymentId)}/cancel`, {
			method: 'POST',
			body: JSON.stringify({})
		});
	} catch {
		// best-effort — the intent expires or completes on its own
	}
}

/** Converts an amount to another currency for display (e.g. listing → XAF). */
export async function convertFx(
	amount: number,
	from: string,
	to: string
): Promise<FxConvertResult | null> {
	try {
		const query = new URLSearchParams({ amount: String(amount), from, to });
		return await request<FxConvertResult>(`${LISTING_API_URL}/fx/convert?${query.toString()}`, {
			method: 'GET'
		});
	} catch {
		return null;
	}
}
