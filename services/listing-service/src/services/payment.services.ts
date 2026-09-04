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
    const message =
      `[refund-trigger] Booking=${bookingId}, Status=${res.status}, Response=${txt}`;
    console.error(message);
    throw new Error(message);
  }
  console.log(`[refund-trigger] Refund triggered successfully via API for booking ${bookingId}`);
}

// Settle the payout row on cancellation: cancel in full when nothing is kept,
// otherwise adjust the pending/scheduled row down to the kept share.
// Throws on transport failure so callers can fail loud instead of stranding money.
export async function settlePayoutOnCancel(
  bookingId: string,
  keptAmount: number | null,
): Promise<void> {
  const res = await fetch(
    `${PAYMENT_SERVICE_URL}/payments/internal/bookings/${bookingId}/settle-payout-on-cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify({ keptAmount }),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const message =
      `[payout-settle] Booking=${bookingId}, Status=${res.status}, Response=${txt}`;
    console.error(message);
    throw new Error(message);
  }
}