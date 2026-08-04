import { PAYMENT_API_URL, LISTING_API_URL } from '$lib/config';
import { apiRequest } from '$lib/http';

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

/** Creates a Stripe PaymentIntent for a freshly-created booking. */
export async function createPaymentIntent(bookingId: string): Promise<CreateIntentResult> {
	return apiRequest<CreateIntentResult>(PAYMENT_API_URL, '/payments/create-intent', {
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
	return apiRequest<InitiatePaymentResult>(PAYMENT_API_URL, '/payments/initiate', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

/** Polls the status of a payment until captured/failed/timed out. */
export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatus> {
	return apiRequest<PaymentStatus>(
		PAYMENT_API_URL,
		`/payments/${encodeURIComponent(paymentId)}/status`,
		{
			method: 'GET'
		}
	);
}

/** Cancels an abandoned Stripe payment (idempotent, best-effort). */
export async function cancelPayment(paymentId: string): Promise<void> {
	try {
		await apiRequest<null>(PAYMENT_API_URL, `/payments/${encodeURIComponent(paymentId)}/cancel`, {
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
		return await apiRequest<FxConvertResult>(LISTING_API_URL, `/fx/convert?${query.toString()}`, {
			method: 'GET'
		});
	} catch {
		return null;
	}
}
