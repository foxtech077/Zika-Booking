import { buildInvoice } from "../services/invoice.service";
import { generateVoucherPDF } from "../services/pdf.services";
import { sendGuestEmail } from "../services/email.services";
import { sendHostEmail } from "../services/hostemail.service";


const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";

async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  try {
    await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, paymentProvider }),
    });
  } catch (err) {
    console.error("[webhook] Failed to confirm booking", bookingId, err);
  }
}

export async function bookingConfirmedHandler(payment: any) {
    const bookingId = payment.metadata.bookingId;
  
    // 1. GET BOOKING
    const booking = await fetch(
      `${BOOKING_SERVICE_URL}/bookings/${bookingId}`
    ).then(res => res.json());
  
    if (!booking) throw new Error("Booking not found");
  
    // 2. CONFIRM BOOKING (ONLY THIS)
    await confirmBooking(bookingId, payment.id, "stripe");

  
    //  invoice
    const invoice = buildInvoice(booking);
  
    //  pdf
    const voucher = await generateVoucherPDF(booking, invoice);

    await sendGuestEmail(
      booking,
      invoice,
      voucher.filePath
    );
    await sendHostEmail(booking);
  }