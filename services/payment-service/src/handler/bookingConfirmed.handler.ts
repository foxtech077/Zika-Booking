import { buildInvoice } from "../services/invoice.service.js";
import { generateVoucherPDF } from "../services/pdf.services.js";
import { sendGuestEmail, sendAdminAlert } from "../services/email.services.js";
import { sendHostEmail } from "../services/hostemail.service.js";
import { confirmBooking, fetchBooking } from "../lib/booking.js";

// ── RETRY HELPER ──────────────────────────────────────────────────────────
async function sendEmailWithRetry(
  sendFn: () => Promise<void>,
  context: string,
  attempt = 1
): Promise<void> {
  try {
    await sendFn();
    console.log(`[email] ${context} sent successfully`);
  } catch (err) {
    console.error(`[email] ${context} failed (attempt ${attempt}):`, err);

    if (attempt === 1) {
      setTimeout(() => sendEmailWithRetry(sendFn, context, 2), 5 * 60 * 1000); // 5 min
    } else if (attempt === 2) {
      setTimeout(() => sendEmailWithRetry(sendFn, context, 3), 30 * 60 * 1000); // 30 min
    } else {
      await sendAdminAlert(context, err);
    }
  }
}

export async function bookingConfirmedHandler(payment: any) {
  const bookingId = payment?.metadata?.bookingId;

  if (!bookingId) {
    throw new Error("Missing bookingId in payment metadata");
  }

  // 1. GET BOOKING
  const booking = await fetchBooking(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  // 2. INVOICE
  const invoice = buildInvoice(booking);

  // 3. PDF
  const voucher = await generateVoucherPDF(booking, invoice);

  // 4. EMAILS (with retry)
  await sendEmailWithRetry(
    async () => { await sendGuestEmail(booking, invoice, voucher); },
    `Guest email for ${booking.code}`
  );
  
  await sendEmailWithRetry(
    async () => { await sendHostEmail(booking); },
    `Host email for ${booking.code}`
  );

  // 5. CONFIRM BOOKING LAST (SAFE)
  const provider = payment.paymentProvider || "stripe";
  await confirmBooking(bookingId, payment.id, provider);
}