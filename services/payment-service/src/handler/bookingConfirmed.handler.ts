import { buildInvoice } from "../services/invoice.service.js";
import { generateVoucherPDF } from "../services/pdf.services.js";
import { sendGuestEmail } from "../services/email.services.js";
import { sendHostEmail } from "../services/hostemail.service.js";
import { prisma } from "../lib/prisma.js";
import { cdnUrl, downloadBuffer } from "../lib/s3.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

console.log("BEFORE CONFIRM");
async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  console.log("CONFIRM API CALLED");
  const response = await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-service-key": INTERNAL_SERVICE_KEY,
    },
    body: JSON.stringify({ paymentId, paymentProvider }),
  });
  console.log("CONFIRM STATUS =", response.status);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    
    throw new Error(`Failed to confirm booking: status ${response.status}. Response: ${errorText}`);
  }
 
}
console.log("AFTER CONFIRM");

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

  // Retrieve the payment record from the database to check current flags
  const dbPayment = await prisma.payment.findUnique({
    where: { id: payment.id }
  });

  if (!dbPayment) {
    throw new Error(`Payment record not found for ID: ${payment.id}`);
  }

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

  if (!rawBooking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const booking = normalizeBooking(rawBooking);

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
    await confirmBooking(bookingId, payment.id, payment.paymentProvider || "stripe");
    console.log("STEP-4 BEFORE PDF");

  } else {
    throw new Error(`Booking ${bookingId} has unexpected status: ${booking.status}`);
  }

  // Generate invoice
  const invoice = buildInvoice(booking);

  // 3. PDF/Voucher generation and S3 upload
  let voucher: { fileName: string; pdfUrl: string; pdfBuffer: Buffer };

  if (!dbPayment.voucherGenerated) {
    console.log(`[webhook] Voucher not generated. Executing PDF generation and S3 upload.`);
    voucher = await generateVoucherPDF(booking, invoice);

    // Update flag in database
    await prisma.payment.update({
      where: { id: payment.id },
      data: { voucherGenerated: true }
    });
    console.log(`[webhook] Voucher generated successfully for booking ${bookingId}`);
  } else {
    console.log(`[webhook] Voucher already generated. Skipping PDF generation and S3 upload.`);
    // Recovery behavior: reconstruct metadata and download the voucher PDF from S3
    const s3Key = `vouchers/${booking.code}.pdf`;
    const pdfUrl = cdnUrl(s3Key);
    const fileName = `ZikaBooking-${booking.code}.pdf`;
    
    const pdfBuffer = await downloadBuffer(s3Key);
    voucher = { fileName, pdfUrl, pdfBuffer };
  }

  // 4. SEND EMAILS
  if (!dbPayment.confirmationEmailsSent) {
    console.log(`[webhook] Sending guest and host confirmation emails.`);
    // Failures propagate (errors are not swallowed)
    try {
      await sendGuestEmail(booking, invoice, voucher);
      console.log(`[email] Guest email sent successfully for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Guest email sending failed:`, err);
      throw err;
    }

    try {
      await sendHostEmail(booking);
      console.log(`[email] Host email sent successfully for booking ${booking.code}`);
    } catch (err: any) {
      console.error(`[email] Host email sending failed:`, err);
      throw err;
    }

    // Update flag in database
    await prisma.payment.update({
      where: { id: payment.id },
      data: { confirmationEmailsSent: true }
    });
    console.log(`[webhook] Confirmation flags updated successfully for booking ${bookingId}`);
  } else {
    console.log(`[webhook] Confirmation emails already sent. Skipping email sending.`);
  }
}

console.log("BOOKING_SERVICE_URL =", BOOKING_SERVICE_URL);
console.log("INTERNAL_SERVICE_KEY =", INTERNAL_SERVICE_KEY);
