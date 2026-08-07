import { buildInvoice } from "../services/invoice.service.js";
import { generateVoucherPDF } from "../services/pdf.services.js";
import { sendGuestEmail, sendAdminAlert } from "../services/email.services.js";
import { sendHostEmail } from "../services/hostemail.service.js";
import { prisma } from "../lib/prisma.js";
import { getPublicUrl, downloadBuffer } from "../lib/s3.js";
import { createPendingPayout } from "../services/payout.service.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

// ── Guest email: attempt 1 is awaited; attempts 2 & 3 run in the background ──

function scheduleGuestEmailRetry(
  booking: any,
  invoice: any,
  voucher: { fileName: string; pdfUrl: string; pdfBuffer: Buffer; s3Key: string },
  paymentId: string,
  attempt: number,
): void {
  const delayMs = attempt === 2 ? 5 * 60_000 : 30 * 60_000;

  setTimeout(async () => {
    try {
      await sendGuestEmail(booking, invoice, voucher, booking.manageToken);
      await prisma.payment.update({
        where: { id: paymentId },
        data: { confirmationEmailsSent: true },
      });
      console.log(`[email] Guest email sent (attempt ${attempt}/3) for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Attempt ${attempt}/3 failed for booking ${booking.code}:`, err);
      if (attempt < 3) {
        scheduleGuestEmailRetry(booking, invoice, voucher, paymentId, attempt + 1);
      } else {
        const context = `booking ${booking.code} | guest: ${booking.user.email} | ref: ${booking.code} | time: ${new Date().toISOString()}`;
        console.error(`[email] All 3 attempts exhausted — alerting admin. ${context}`);
        await sendAdminAlert(context, err).catch((alertErr) => {
          console.error(`[email] Admin alert also failed:`, alertErr);
        });
      }
    }
  }, delayMs);
}

console.log("BEFORE CONFIRM");
async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string, charge?: { currency?: string | null; amount?: number | null; rate?: number | null }) {
  console.log("CONFIRM API CALLED");
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
  console.log("CONFIRM STATUS =", response.status);

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
console.log("AFTER CONFIRM");

function paymentMethodLabel(payment: {
  paymentProvider: string;
  paymentMethodType?: string | null;
  mobileNumberMasked?: string | null;
  mobileNumber?: string | null;
  cardLast4?: string | null;
}): string {
  const isMobileMoney =
    payment.paymentProvider === "tara" || payment.paymentMethodType === "mobile_money";
  if (isMobileMoney) {
    const tail =
      payment.mobileNumberMasked ??
      (payment.mobileNumber ? payment.mobileNumber.slice(-4) : null);
    return tail ? `Mobile Money •••• ${tail}` : "Mobile Money";
  }
  return payment.cardLast4 ? `Card •••• ${payment.cardLast4}` : "Card";
}

function normalizeBooking(booking: any) {
  const isCar = booking.listingType === "car";
  const checkInVal = isCar 
    ? (booking.pickupDatetime ? new Date(booking.pickupDatetime).toISOString().slice(0, 10) : null)
    : (booking.checkIn ? new Date(booking.checkIn).toISOString().slice(0, 10) : null);
  const checkOutVal = isCar 
    ? (booking.returnDatetime ? new Date(booking.returnDatetime).toISOString().slice(0, 10) : null)
    : (booking.checkOut ? new Date(booking.checkOut).toISOString().slice(0, 10) : null);

  return {
    ...booking,
    code: booking.reference,
    user: {
      name: `${booking.guestFirstName} ${booking.guestLastName}`,
      email: booking.guestEmail,
    },
    checkIn: checkInVal,
    checkOut: checkOutVal,
    listing: {
      ...booking.listing,
      title: booking.listing?.name ?? "Your listing",
      hostEmail: booking.listing?.hostEmail ?? "",
    },
    payoutAmount: booking.providerPayout ? Number(booking.providerPayout) : 0,
    transactionId: booking.paymentId ?? "N/A",
    paymentMethod: booking.paymentMethod ?? "Card",
    manageToken: booking.manageToken ?? null,
  };
}

export async function bookingConfirmedHandler(payment: any) {
  const bookingId = payment?.metadata?.bookingId;

  if (!bookingId) {
    throw new Error("Missing bookingId in payment metadata");
  }

  // Retrieve the payment record from the database to check current flags
  const dbPayment = await prisma.payment.findUnique({
    where: { id: payment.id }
    
  });
  console.log(
    `[payout] Payout already exists for booking ${bookingId}`
  );

  if (!dbPayment) {
    throw new Error(`Payment record not found for ID: ${payment.id}`);
  }

  // Actual platform-currency charge (EUR for Stripe, XAF for Tara) captured on
  // the payment record. Used to render the invoice/email/PDF in the charged
  // currency and to persist `charged*` back onto the booking for reference.
  const charge = {
    currency: (dbPayment.chargedCurrency ?? "EUR").toUpperCase(),
    amount: dbPayment.chargedAmount != null ? Number(dbPayment.chargedAmount) : null,
    rate: dbPayment.chargedRate != null ? Number(dbPayment.chargedRate) : null,
  };

  // 1. GET BOOKING
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${bookingId}`, {
    headers: {
      "x-service-key": INTERNAL_SERVICE_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Booking service failed to fetch booking: ${res.status}`);
  }

  const json = await res.json();
  const rawBooking = json.data;

  console.log("========== PAYOUT TRACE START ==========");
  console.log("[PAYOUT TRACE] bookingId =", bookingId);
  console.log("[PAYOUT TRACE] rawBooking =", JSON.stringify(rawBooking, null, 2));

  if (!rawBooking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const booking = normalizeBooking(rawBooking);

  // Use the actual payment method recorded on the payment record (the booking
  // row has no method column, so this drives the email/PDF display).
  booking.paymentMethod = paymentMethodLabel(dbPayment);

  console.log("[PAYOUT TRACE] providerId =", rawBooking.providerId);
  console.log("[PAYOUT TRACE] providerPayout =", rawBooking.providerPayout);
  console.log("[PAYOUT TRACE] currency =", rawBooking.currency);
  console.log("[PAYOUT TRACE] listingType =", rawBooking.listingType);

  // Create pending payout (idempotent, does not schedule yet)
  if (rawBooking.providerId && Number(rawBooking.providerPayout) > 0) {
    console.log("[PAYOUT TRACE] About to call createPendingPayout()");
    try {
      await createPendingPayout({
        bookingId: rawBooking.id,
        providerId: rawBooking.providerId,
        amount: Number(rawBooking.providerPayout),
        currency: rawBooking.currency,
        countryCode: rawBooking.listing?.country ?? null,
      });
      console.log("[PAYOUT TRACE] createPendingPayout() completed");
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
    // 2. CONFIRM BOOKING FIRST
    console.log("STEP-3 CONFIRM SUCCESS");
    await confirmBooking(bookingId, payment.id, payment.paymentProvider || "stripe", charge);
    console.log("STEP-4 BEFORE PDF");

  } else {
    const err: any = new Error(`Booking ${bookingId} has unexpected status: ${booking.status}`);
    err.statusCode = 409;
    err.code = `UNEXPECTED_BOOKING_STATUS_${booking.status}`;
    err.definitive = true;
    throw err;
  }

  // Override transactionId with the payment displayId (human-readable) or internal ID
  // (booking.paymentId is null at fetch time, set only after confirm)
  booking.transactionId = dbPayment.displayId ?? payment.id;

  // Generate invoice (breakdown in listing currency + platform total)
  const invoice = buildInvoice(booking, charge);

  // 3. PDF/Voucher generation and S3 upload
  let voucher: { fileName: string; pdfUrl: string; pdfBuffer: Buffer; s3Key: string };

  if (!dbPayment.voucherGenerated) {
    console.log(`[webhook] Voucher not generated. Executing PDF generation and S3 upload.`);
    voucher = await generateVoucherPDF(booking, invoice);

    // Update flag in database
    await prisma.payment.update({
      where: { id: payment.id },
      data: { voucherGenerated: true, voucherPdfKey: voucher.s3Key }
    });
    console.log(`[webhook] Voucher generated successfully for booking ${bookingId}`);
  } else {
    console.log(`[webhook] Voucher already generated. Skipping PDF generation and S3 upload.`);
    // Recovery behavior: reconstruct metadata and download the voucher PDF from S3
    const s3Key = dbPayment.voucherPdfKey ?? `invoice/${booking.id}/KAIN-${booking.code}.pdf`;
    const pdfUrl = await getPublicUrl(s3Key);
    const fileName = `KAIN-${booking.code}.pdf`;

    const pdfBuffer = await downloadBuffer(s3Key);
    voucher = { fileName, pdfUrl, pdfBuffer, s3Key };

    // Backfill the stored key if it was missing on an older payment record
    if (!dbPayment.voucherPdfKey) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { voucherPdfKey: s3Key },
      });
    }
  }

  // 4. SEND EMAILS
  if (!dbPayment.confirmationEmailsSent) {
    console.log(`[webhook] Sending guest and host confirmation emails.`);

    // Guest email — attempt 1 (immediate, awaited).
    // On failure, retries 2 and 3 fire in the background after 5 min / 30 min.
    // On 3rd failure an admin alert is sent.
    try {
      await sendGuestEmail(booking, invoice, voucher, booking.manageToken);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { confirmationEmailsSent: true },
      });
      console.log(`[email] Guest email sent (attempt 1/3) for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Attempt 1/3 failed for booking ${booking.code}:`, err);
      scheduleGuestEmailRetry(booking, invoice, voucher, payment.id, 2);
    }

    // Host email — single attempt (failure is logged, not fatal to the flow)
    try {
      await sendHostEmail(booking);
      console.log(`[email] Host email sent successfully for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Host email sending failed for booking ${booking.code}:`, err);
    }

    console.log(`[webhook] Confirmation flow completed for booking ${bookingId}`);
  } else {
    console.log(`[webhook] Confirmation emails already sent. Skipping email sending.`);
  }
}

console.log("BOOKING_SERVICE_URL =", BOOKING_SERVICE_URL);
console.log("INTERNAL_SERVICE_KEY =", INTERNAL_SERVICE_KEY);
