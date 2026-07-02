// services/paymentRouting.service.ts
import { paymentRoutingConfig } from "../config/payment.config";

export type PaymentProvider = "stripe" | "tara";

const PAYMENT_SERVICE_URL = process.env["PAYMENT_SERVICE_URL"] ?? "http://localhost:3004";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

export function getPaymentProvider(country: string): PaymentProvider {
  const normalized = country.toUpperCase();

  if (paymentRoutingConfig.taraCountries.has(normalized)) {
    return "tara";
  }

  return "stripe";
}

export function generateRefundIdempotencyKey(bookingId: string, refundType: string): string {
  return `refund:${bookingId}:${refundType}`;
}

export async function triggerPaymentRefund(
  bookingId: string,
  refundAmount: number,
  reason: string,
  idempotencyKey: string
): Promise<void> {
  try {
    const res = await fetch(`${PAYMENT_SERVICE_URL}/payments/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        bookingId,
        refundAmount,
        reason,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[refund-trigger] Booking=${bookingId}, Status=${res.status}, Response=${txt}`
      );
    } else {
      console.log(`[refund-trigger] Refund triggered successfully via API for booking ${bookingId}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[refund-trigger] Network error calling refund trigger for booking ${bookingId}: ${message}`
    );
  }
}