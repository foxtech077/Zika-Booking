import { sendGuestEmail } from "../services/email.services.js";
import { sendHostEmail } from "../services/hostemail.service.js";
import { createPendingPayout } from "../services/payout.service.js";
import { prisma } from "../lib/prisma.js";
import { enqueueEmailJob } from "../lib/emailQueue.js";
import {
  prepareConfirmation,
  normalizeBooking,
  paymentMethodLabel,
  fetchInternalBooking,
  buildCharge,
} from "../services/confirmation.service.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string, charge?: { currency?: string | null; amount?: number | null; rate?: number | null }) {
  const response = await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-service-key": INTERNAL_SERVICE_KEY,
    },
    body: JSON.stringify({
      paymentId,
      paymentProvider,
      chargedCurrency: charge?.currency ?? undefined,
      chargedAmount: charge?.amount ?? undefined,
      chargedRate: charge?.rate ?? undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let code: string | undefined;
    try {
      const body = JSON.parse(errorText);
      code = body?.error?.code;
    } catch {
      // non-JSON error body — code stays undefined
    }
    const err = new Error(`Failed to confirm booking: status ${response.status}. Response: ${errorText}`) as any;
    err.statusCode = response.status;
    err.code = code;
    err.definitive = response.status < 500;
    throw err;
  }
}

export async function bookingConfirmedHandler(payment: any) {
  const bookingId = payment?.metadata?.bookingId;

  if (!bookingId) {
    throw new Error("Missing bookingId in payment metadata");
  }

  const dbPayment = await prisma.payment.findUnique({
    where: { id: payment.id },
  });

  if (!dbPayment) {
    throw new Error(`Payment record not found for ID: ${payment.id}`);
  }

  // 1. GET BOOKING
  const rawBooking = await fetchInternalBooking(bookingId);
  const booking = normalizeBooking(rawBooking);
  booking.paymentMethod = paymentMethodLabel(dbPayment);

  // Create pending payout (idempotent, does not schedule yet)
  if (rawBooking.providerId && Number(rawBooking.providerPayout) > 0) {
    try {
      await createPendingPayout({
        bookingId: rawBooking.id,
        providerId: rawBooking.providerId,
        amount: Number(rawBooking.providerPayout),
        currency: rawBooking.currency,
        countryCode: rawBooking.listing?.country ?? null,
      });
    } catch (err) {
      console.error("[PAYOUT TRACE] createPendingPayout() failed", err);
    }
  }

  // Smart Idempotency:
  // If booking status = confirmed:
  //   skip confirmation request, continue recovery path.
  // If booking status = pending_payment:
  //   execute confirmation flow.
  if (booking.status === "confirmed") {
    console.log(`[webhook] Booking ${bookingId} is already confirmed. Skipping confirmation request, continuing recovery path.`);
  } else if (booking.status === "pending_payment") {
    console.log(`[webhook] Booking ${bookingId} status is pending_payment. Executing confirmation flow first.`);
    await confirmBooking(bookingId, payment.id, payment.paymentProvider || "stripe", buildCharge(dbPayment));
  } else {
    const err: any = new Error(`Booking ${bookingId} has unexpected status: ${booking.status}`);
    err.statusCode = 409;
    err.code = `UNEXPECTED_BOOKING_STATUS_${booking.status}`;
    err.definitive = true;
    throw err;
  }

  // 3. Build invoice + voucher (idempotent, reused by the email-retry job)
  const { invoice, voucher } = await prepareConfirmation(payment.id, rawBooking);

  // 4. SEND EMAILS — each email tracked independently and retried durably.
  //    The first attempt is awaited (low latency); failures are handed to the
  //    BullMQ email queue so they survive restarts and are not lost. The host
  //    email is no longer gated by the guest flag, so a host failure can never
  //    be masked by a successful guest send.
  if (!dbPayment.confirmationEmailsSent) {
    try {
      await sendGuestEmail(booking, invoice, voucher, booking.manageToken);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { confirmationEmailsSent: true },
      });
      console.log(`[email] Guest email sent (attempt 1) for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Guest email attempt 1 failed for booking ${booking.code}:`, err);
      await enqueueEmailJob(payment.id, "guest");
    }
  }

  if (!dbPayment.hostEmailSent) {
    try {
      await sendHostEmail(booking);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { hostEmailSent: true },
      });
      console.log(`[email] Host email sent successfully for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Host email sending failed for booking ${booking.code}:`, err);
      await enqueueEmailJob(payment.id, "host");
    }
  }
}
