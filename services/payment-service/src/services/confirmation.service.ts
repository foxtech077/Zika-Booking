import { buildInvoice } from "./invoice.service.js";
import { generateVoucherPDF } from "./pdf.services.js";
import { getPublicUrl, downloadBuffer } from "../lib/s3.js";
import { prisma } from "../lib/prisma.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

// ── Helpers shared by the synchronous confirmation handler and the durable
// email-retry job, so booking normalization / invoice / voucher generation are
// defined in exactly one place. ──────────────────────────────────────────────

export function paymentMethodLabel(payment: {
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

export function normalizeBooking(booking: any) {
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

export async function fetchInternalBooking(bookingId: string): Promise<any> {
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

  if (!rawBooking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  return rawBooking;
}

// Actual platform-currency charge (EUR for Stripe, XAF for Tara) captured on the
// payment record. Used to render the invoice/email/PDF in the charged currency.
export function buildCharge(dbPayment: any) {
  return {
    currency: (dbPayment.chargedCurrency ?? "EUR").toUpperCase(),
    amount: dbPayment.chargedAmount != null ? Number(dbPayment.chargedAmount) : null,
    rate: dbPayment.chargedRate != null ? Number(dbPayment.chargedRate) : null,
  };
}

// Fetch the booking + build the invoice and (idempotently) the voucher PDF.
// If the voucher was already generated it is reconstructed from S3, otherwise it
// is generated and the `voucherGenerated` flag is set. Returns everything the
// guest/host email senders need. `rawBooking` may be supplied to avoid a second
// booking-service fetch when the caller already has it.
export async function prepareConfirmation(
  paymentId: string,
  rawBooking?: any,
): Promise<{ booking: any; invoice: any; voucher: any }> {
  const dbPayment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!dbPayment) {
    throw new Error(`Payment record not found for ID: ${paymentId}`);
  }

  const raw = rawBooking ?? (await fetchInternalBooking(dbPayment.bookingId));
  const booking = normalizeBooking(raw);
  booking.paymentMethod = paymentMethodLabel(dbPayment);
  booking.status = raw.status;
  // Override transactionId with the payment displayId (human-readable) or id.
  booking.transactionId = dbPayment.displayId ?? dbPayment.id;

  const charge = buildCharge(dbPayment);
  const invoice = buildInvoice(booking, charge);

  let voucher: { fileName: string; pdfUrl: string; pdfBuffer: Buffer; s3Key: string };

  if (!dbPayment.voucherGenerated) {
    voucher = await generateVoucherPDF(booking, invoice);
    await prisma.payment.update({
      where: { id: paymentId },
      data: { voucherGenerated: true, voucherPdfKey: voucher.s3Key },
    });
  } else {
    const s3Key = dbPayment.voucherPdfKey ?? `invoice/${booking.id}/KAIN-${booking.code}.pdf`;
    const pdfUrl = await getPublicUrl(s3Key);
    const fileName = `KAIN-${booking.code}.pdf`;
    const pdfBuffer = await downloadBuffer(s3Key);
    voucher = { fileName, pdfUrl, pdfBuffer, s3Key };

    // Backfill the stored key if it was missing on an older payment record
    if (!dbPayment.voucherPdfKey) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { voucherPdfKey: s3Key },
      });
    }
  }

  return { booking, invoice, voucher };
}
