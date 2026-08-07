import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";

const STALE_PAYMENT_THRESHOLD_MS = 15 * 60 * 1000;
const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

// Only these PaymentIntent statuses can still be cancelled. A payment that
// already succeeded, is processing, or is awaiting capture must never be
// cancelled by a stale-payment sweep.
const CANCELABLE_STATUSES = ["requires_payment_method", "requires_confirmation", "requires_action"];

// Safety net for abandoned Stripe payments. The clients cancel intents when
// the user navigates away; this sweep catches the rest (page crash, killed
// tab, network drop) by cancelling any open intent older than 15 minutes.
// The payment_intent.canceled webhook reconciles local state idempotently.
export async function cancelStaleStripePayments() {
  const cutoff = new Date(Date.now() - STALE_PAYMENT_THRESHOLD_MS);

  const payments = await prisma.payment.findMany({
    where: {
      paymentProvider: "stripe",
      status: { in: ["initiated", "pending"] },
      createdAt: { lt: cutoff },
      providerPaymentId: { not: null },
    },
    take: 50,
  });

  for (const payment of payments) {
    try {
      const intent = await stripe.paymentIntents.retrieve(payment.providerPaymentId!);
      if (!CANCELABLE_STATUSES.includes(intent.status)) {
        continue; // already paid, processing, or cancelled — leave it alone
      }

      await stripe.paymentIntents.cancel(intent.id);

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "timed_out",
          failureCode: "EXPIRED",
          failureMessage: "Payment was not completed within 15 minutes and was cancelled.",
        },
      });

      // Best-effort: release the booking back to draft so the guest can retry.
      await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${payment.bookingId}/revert-to-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-service-key": INTERNAL_SERVICE_KEY },
      }).catch(() => {});
    } catch (err: any) {
      console.error(`[cancel-stale-payments] Failed to cancel payment ${payment.id}:`, err?.message ?? err);
    }
  }

  if (payments.length > 0) {
    console.log(`[cancel-stale-payments] Processed ${payments.length} stale payment(s).`);
  }
}
