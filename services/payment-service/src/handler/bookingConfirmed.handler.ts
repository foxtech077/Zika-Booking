import { buildInvoice } from "../services/invoice.service.js";
import { generateVoucherPDF } from "../services/pdf.services.js";
import { sendGuestEmail, sendAdminAlert } from "../services/email.services.js";
import { sendHostEmail } from "../services/hostemail.service.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  try {
    await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify({ paymentId, paymentProvider }),
    });
  } catch (err) {
    console.error("[webhook] Failed to confirm booking", bookingId, err);
  }
}

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
  };
}

export async function bookingConfirmedHandler(payment: any) {
  const bookingId = payment?.metadata?.bookingId;

  if (!bookingId) {
    throw new Error("Missing bookingId in payment metadata");
  }

  // 1. GET BOOKING
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${bookingId}`, {
    headers: {
      "x-service-key": INTERNAL_SERVICE_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Booking service failed: ${res.status}`);
  }

  const json = await res.json();
  const rawBooking = json.data;

  if (!rawBooking) {
    throw new Error("Booking not found");
  }

  const booking = normalizeBooking(rawBooking);

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
  await confirmBooking(bookingId, payment.id, payment.paymentProvider || "stripe");
}